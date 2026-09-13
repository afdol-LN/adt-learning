import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * ตระกูล API ที่รองรับ
 *
 *  openai    รูปแบบ OpenAI-compatible /chat/completions
 *            ใช้กับ OpenRouter, PSU dotBLUE, OpenAI, LM Studio ฯลฯ
 *  anthropic Claude Messages API  POST /v1/messages
 *  gemini    Google AI Studio     POST /v1beta/models/{model}:generateContent
 */
export type LlmProvider = 'openai' | 'anthropic' | 'gemini';

/** ผู้ให้บริการหนึ่งตัวใน chain */
export interface LlmCandidate {
  /** ชื่อที่ใช้อ้างใน LLM_CHAIN เช่น OPENROUTER_MINIMAX */
  name: string;
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface LlmCompletion {
  text: string;
  /** model ที่ตอบสำเร็จจริง อาจไม่ใช่ตัวแรกใน chain */
  model: string;
  /** ชื่อ candidate ที่ตอบสำเร็จ */
  candidate: string;
}

const DEFAULT_BASE_URL: Record<LlmProvider, string> = {
  openai: '', // ไม่มีค่าเริ่มต้น เพราะแต่ละ gateway คนละ host
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
};

/** เวอร์ชัน Messages API ของ Anthropic ที่ผูกไว้ (header บังคับ) */
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Client กลางสำหรับเรียก LLM พร้อม fallback chain
 *
 * ── ตั้งค่าแบบ chain (แนะนำ) ────────────────────────────────────────
 *   LLM_CHAIN=OPENROUTER_MINIMAX,DOTBLUE_GEMMA
 *
 *   OPENROUTER_MINIMAX_PROVIDER=openai
 *   OPENROUTER_MINIMAX_BASE_URL=https://openrouter.ai/api/v1
 *   OPENROUTER_MINIMAX_API_KEY=...
 *   OPENROUTER_MINIMAX_MODEL=minimax/minimax-m1:free
 *   OPENROUTER_MINIMAX_TIMEOUT_MS=25000
 *
 *   DOTBLUE_GEMMA_PROVIDER=openai
 *   DOTBLUE_GEMMA_BASE_URL=https://ai.psu.blue/v1
 *   DOTBLUE_GEMMA_API_KEY=...
 *   DOTBLUE_GEMMA_MODEL=PSU-LLM/psu-gemma
 *   DOTBLUE_GEMMA_TIMEOUT_MS=60000
 *
 * ยิงตัวแรกก่อน ถ้าไม่ตอบภายใน TIMEOUT_MS ของตัวนั้น (หรือ error อะไรก็ตาม)
 * จะเลื่อนไปตัวถัดไปทันที ต่อเมื่อพังหมดทุกตัวถึงจะโยน error ออกไป
 * พร้อมสรุปว่าแต่ละตัวพังเพราะอะไร
 *
 * ── ตั้งค่าแบบตัวเดียว (ของเดิม ยังใช้ได้) ─────────────────────────
 *   LLM_PROVIDER / LLM_BASE_URL / LLM_API_KEY / LLM_MODEL / LLM_TIMEOUT_MS
 *
 * เรียกผ่าน HTTP ตรง (ไม่ใช้ SDK ของแต่ละเจ้า) โดยตั้งใจ — เพื่อให้ timeout,
 * การจัดการ error และการปิดบัง key อยู่ทางเดียวกันหมด และเพิ่มเจ้าใหม่ได้
 * โดยแตะแค่ไฟล์นี้
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly candidates: LlmCandidate[];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.candidates = this.loadCandidates();

    if (this.candidates.length === 0) {
      this.logger.warn(
        'ยังไม่ได้ตั้งค่า LLM — กำหนด LLM_CHAIN (หรือ LLM_PROVIDER/LLM_API_KEY/LLM_MODEL) ใน .env',
      );
    } else {
      this.logger.log(
        `LLM chain: ${this.candidates
          .map((c) => `${c.name}(${c.provider}:${c.model}, ${c.timeoutMs}ms)`)
          .join(' → ')}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.candidates.length > 0;
  }

  /** ไว้ให้ UI/log แสดงว่ามีอะไรใน chain บ้าง — ไม่มี key ติดออกไป */
  getChainSummary(): { name: string; provider: LlmProvider; model: string; timeoutMs: number }[] {
    return this.candidates.map(({ name, provider, model, timeoutMs }) => ({
      name,
      provider,
      model,
      timeoutMs,
    }));
  }

  /** model ตัวแรกใน chain — ใช้ตอนยังไม่รู้ว่าตัวไหนจะตอบ */
  getModelName(): string {
    return this.candidates[0]?.model ?? '';
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<LlmCompletion> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'ยังไม่ได้ตั้งค่า LLM — กำหนด LLM_CHAIN (หรือ LLM_PROVIDER/LLM_API_KEY/LLM_MODEL) ใน .env',
      );
    }

    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 4096;
    const failures: string[] = [];

    for (let i = 0; i < this.candidates.length; i++) {
      const candidate = this.candidates[i];
      const isLast = i === this.candidates.length - 1;

      try {
        const text = await this.callCandidate(
          candidate,
          systemPrompt,
          userPrompt,
          temperature,
          maxTokens,
        );
        if (i > 0) {
          this.logger.log(
            `LLM สำเร็จด้วยตัวสำรอง ${candidate.name} (${candidate.model}) หลังจากตัวก่อนหน้าพัง ${i} ตัว`,
          );
        }
        return { text, model: candidate.model, candidate: candidate.name };
      } catch (error) {
        const reason = this.describeFailure(error, candidate);
        failures.push(`${candidate.name}: ${reason}`);
        this.logger.warn(
          `LLM candidate ${candidate.name} (${candidate.provider}:${candidate.model}) ล้มเหลว — ${reason}${
            isLast ? ' (หมด chain แล้ว)' : ' กำลังลองตัวถัดไป'
          }`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `เรียก LLM ไม่สำเร็จทุกตัวใน chain — ${failures.join(' | ')}`,
    );
  }

  // ───────────────────────────── config ─────────────────────────────

  private loadCandidates(): LlmCandidate[] {
    const chain = (this.configService.get<string>('LLM_CHAIN') || '').trim();

    const names = chain
      ? chain
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
      : [];

    // ไม่ได้ตั้ง LLM_CHAIN → ถอยไปอ่านแบบตัวเดียวของเดิม
    if (names.length === 0) {
      const legacy = this.buildCandidate('LLM', 'LLM');
      return legacy ? [legacy] : [];
    }

    const candidates: LlmCandidate[] = [];
    for (const name of names) {
      const candidate = this.buildCandidate(name, name);
      if (candidate) {
        candidates.push(candidate);
      } else {
        // ตั้งชื่อไว้ใน chain แต่ตัวแปรไม่ครบ — บอกให้รู้ ไม่ข้ามเงียบ ๆ
        this.logger.warn(
          `LLM_CHAIN อ้างถึง "${name}" แต่ตัวแปร ${name}_API_KEY / ${name}_MODEL ไม่ครบ — ข้ามตัวนี้`,
        );
      }
    }
    return candidates;
  }

  /** อ่านชุดตัวแปรที่ขึ้นต้นด้วย prefix; คืน null ถ้าไม่ครบ */
  private buildCandidate(name: string, prefix: string): LlmCandidate | null {
    const read = (suffix: string): string =>
      (this.configService.get<string>(`${prefix}_${suffix}`) || '').trim();

    const rawProvider = read('PROVIDER').toLowerCase();
    const provider: LlmProvider = (
      ['openai', 'anthropic', 'gemini'].includes(rawProvider)
        ? rawProvider
        : 'openai'
    ) as LlmProvider;

    const apiKey = read('API_KEY');
    const model = read('MODEL');
    const baseUrl = this.normalizeBaseUrl(
      read('BASE_URL') || DEFAULT_BASE_URL[provider],
      provider,
    );

    if (!apiKey || !model || !baseUrl) return null;

    const ownTimeout = Number(read('TIMEOUT_MS'));
    const sharedTimeout = Number(
      (this.configService.get<string>('LLM_TIMEOUT_MS') || '').trim(),
    );
    const timeoutMs =
      Number.isFinite(ownTimeout) && ownTimeout > 0
        ? ownTimeout
        : Number.isFinite(sharedTimeout) && sharedTimeout > 0
          ? sharedTimeout
          : DEFAULT_TIMEOUT_MS;

    return { name, provider, baseUrl, apiKey, model, timeoutMs };
  }

  /**
   * ตัด / ท้ายทิ้ง และตัด path ของ endpoint ออกถ้าเผลอใส่มาด้วย
   * (เขียน https://ai.psu.blue/v1/chat/completions ใน .env เป็นเรื่องที่เกิดง่าย
   *  แล้วจะกลายเป็น .../chat/completions/chat/completions ตอนยิงจริง)
   */
  private normalizeBaseUrl(raw: string, provider: LlmProvider): string {
    let url = raw.trim().replace(/\/+$/, '');
    if (provider === 'openai') {
      url = url.replace(/\/chat\/completions$/, '');
    } else if (provider === 'anthropic') {
      url = url.replace(/\/v1\/messages$/, '');
    }
    return url.replace(/\/+$/, '');
  }

  // ───────────────────────────── request ─────────────────────────────

  private async callCandidate(
    candidate: LlmCandidate,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number,
  ): Promise<string> {
    const { url, body, headers } = this.buildRequest(
      candidate,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    );

    const response = await firstValueFrom(
      this.httpService.post(url, body, {
        headers,
        timeout: candidate.timeoutMs,
      }),
    );
    return this.parseResponse(candidate.provider, response.data);
  }

  private buildRequest(
    candidate: LlmCandidate,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number,
  ): {
    url: string;
    body: Record<string, any>;
    headers: Record<string, string>;
  } {
    const { provider, baseUrl, apiKey, model } = candidate;

    switch (provider) {
      case 'anthropic':
        return {
          url: `${baseUrl}/v1/messages`,
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json',
          },
          body: {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            // ไม่ส่ง temperature โดยตั้งใจ — Claude รุ่น 4.7 ขึ้นไป (Opus 5, Sonnet 5)
            // ตอบ 400 ถ้ามี sampling parameter ส่งมาด้วย
          },
        };

      case 'gemini':
        return {
          // ส่ง key ผ่าน header ไม่ใช่ query string จะได้ไม่ติดไปกับ URL ใน log
          url: `${baseUrl}/v1beta/models/${model}:generateContent`,
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          },
        };

      case 'openai':
      default:
        return {
          url: `${baseUrl}/chat/completions`,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature,
            max_tokens: maxTokens,
            // ต้องส่งชัด ๆ — PSU dotBLUE สตรีมเป็น text/event-stream เสมอถ้าไม่ระบุ
            // ทำให้ได้ body เป็นสตริง SSE แทน JSON
            stream: false,
          },
        };
    }
  }

  // ───────────────────────────── response ─────────────────────────────

  private parseResponse(provider: LlmProvider, data: any): string {
    switch (provider) {
      case 'anthropic':
        return this.parseAnthropic(data);
      case 'gemini':
        return this.parseGemini(data);
      case 'openai':
      default:
        // gateway บางเจ้าไม่สนใจ stream:false แล้วส่ง SSE กลับมาเป็นสตริง
        // ประกอบ chunk กลับเป็นข้อความเดียวแทนที่จะทิ้งไปว่าอ่านไม่ได้
        if (typeof data === 'string') {
          return this.requireText(
            this.parseOpenAiSse(data),
            provider,
            data,
          );
        }
        return this.requireText(
          data?.choices?.[0]?.message?.content,
          provider,
          data,
        );
    }
  }

  /** ประกอบข้อความจาก body แบบ text/event-stream ของ OpenAI-compatible */
  private parseOpenAiSse(raw: string): string {
    const pieces: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '' || payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload);
        const choice = chunk?.choices?.[0];
        const piece = choice?.delta?.content ?? choice?.message?.content;
        if (typeof piece === 'string') pieces.push(piece);
      } catch {
        // chunk เดียวพังไม่ควรทำให้ทั้งคำตอบเสีย — ข้ามไป
      }
    }
    return pieces.join('');
  }

  private parseAnthropic(data: any): string {
    // ถ้าโดน safety classifier ปฏิเสธ จะได้ HTTP 200 พร้อม stop_reason 'refusal'
    // ไม่ใช่ error — ต้องเช็คเอง ไม่งั้นจะไปเจอ "ไม่พบ JSON" ที่ปลายทางแทน
    if (data?.stop_reason === 'refusal') {
      const category = data?.stop_details?.category ?? 'ไม่ระบุ';
      throw new ServiceUnavailableException(
        `Claude ปฏิเสธคำขอนี้ด้วยเหตุผลด้านความปลอดภัย (${category})`,
      );
    }
    // content เป็น array ของ block หลายชนิด (thinking, text, ...) เอาเฉพาะ text
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const text = blocks
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('');
    return this.requireText(text, 'anthropic', data);
  }

  private parseGemini(data: any): string {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new ServiceUnavailableException(
        `Gemini ปฏิเสธคำขอนี้ (${blockReason})`,
      );
    }
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      // MAX_TOKENS / SAFETY / RECITATION — คำตอบอาจขาดกลางคัน บอกให้รู้ตรง ๆ
      this.logger.warn(`Gemini finished with reason ${candidate.finishReason}`);
    }
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    const text = parts
      .filter((p: any) => typeof p?.text === 'string')
      .map((p: any) => p.text)
      .join('');
    return this.requireText(text, 'gemini', data);
  }

  private requireText(
    text: unknown,
    provider: LlmProvider,
    data: any,
  ): string {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new ServiceUnavailableException(
        `ตอบกลับมาในรูปแบบที่อ่านไม่ได้ (provider=${provider}, ${this.describeShape(data)})`,
      );
    }
    return text;
  }

  /**
   * อธิบายหน้าตา response แบบสั้น ๆ ไว้ debug
   * ถ้า body เป็นสตริง Object.keys จะให้ index ของตัวอักษรมาเป็นพัน ๆ ตัว
   * จึงต้องแยกเคสและตัดความยาวเสมอ
   */
  private describeShape(data: any): string {
    if (typeof data === 'string') {
      return `body เป็นสตริงยาว ${data.length} ตัวอักษร ขึ้นต้นด้วย: ${data
        .slice(0, 80)
        .replace(/\s+/g, ' ')}`;
    }
    const keys = Object.keys(data ?? {});
    const shown = keys.slice(0, 12).join(', ');
    return `keys: ${shown}${keys.length > 12 ? `, …อีก ${keys.length - 12}` : ''}`;
  }

  // ───────────────────────────── errors ─────────────────────────────

  /** สรุปสาเหตุที่ candidate ตัวนี้พัง โดยไม่เผย API key */
  private describeFailure(error: any, candidate: LlmCandidate): string {
    if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message ?? '')) {
      return `ไม่ตอบภายใน ${candidate.timeoutMs} ms`;
    }
    if (error instanceof ServiceUnavailableException) {
      return error.message;
    }
    const status = error?.response?.status;
    const detail =
      error?.response?.data?.error?.message ?? // openai / gemini
      error?.response?.data?.error?.detail ??
      error?.response?.data?.detail ?? // dotBLUE / FastAPI style
      error?.message ??
      'unknown error';
    return status ? `HTTP ${status}: ${detail}` : String(detail);
  }
}
