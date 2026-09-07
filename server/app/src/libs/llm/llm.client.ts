import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * ตระกูล API ที่รองรับ — เลือกด้วย LLM_PROVIDER ใน .env
 *
 *  openai    รูปแบบ OpenAI-compatible /chat/completions
 *            ใช้กับ OpenRouter, PSU dotBLUE, OpenAI, LM Studio ฯลฯ
 *  anthropic Claude Messages API  POST /v1/messages
 *  gemini    Google AI Studio     POST /v1beta/models/{model}:generateContent
 */
export type LlmProvider = 'openai' | 'anthropic' | 'gemini';

const DEFAULT_BASE_URL: Record<LlmProvider, string> = {
  openai: '', // ไม่มีค่าเริ่มต้น เพราะแต่ละ gateway คนละ host
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
};

/** เวอร์ชัน Messages API ของ Anthropic ที่ผูกไว้ (header บังคับ) */
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Client กลางสำหรับเรียก LLM
 *
 * ตั้งค่าใน .env:
 *   LLM_PROVIDER    openai | anthropic | gemini   (ไม่ใส่ = openai)
 *   LLM_BASE_URL    ไม่ใส่ก็ได้ถ้าเป็น anthropic/gemini (มีค่าเริ่มต้นให้)
 *   LLM_API_KEY     key ของเจ้านั้น
 *   LLM_MODEL       เช่น claude-opus-5, gemini-2.5-flash, openai/gpt-5
 *   LLM_TIMEOUT_MS  ไม่ใส่ = 120000
 *
 * เรียกผ่าน HTTP ตรง (ไม่ใช้ SDK ของแต่ละเจ้า) โดยตั้งใจ — เพื่อให้ timeout,
 * การจัดการ error และการปิดบัง key อยู่ทางเดียวกันหมดทั้งสามเจ้า และเพิ่มเจ้าใหม่
 * ได้โดยแตะแค่ไฟล์นี้ ถ้าวันหนึ่งต้องใช้ฟีเจอร์เฉพาะทาง (streaming, tool use,
 * extended thinking) ค่อยพิจารณาย้ายมาใช้ SDK ของเจ้านั้นแทน
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly provider: LlmProvider;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const rawProvider = (
      this.configService.get<string>('LLM_PROVIDER') || 'openai'
    )
      .trim()
      .toLowerCase();
    this.provider = (
      ['openai', 'anthropic', 'gemini'].includes(rawProvider)
        ? rawProvider
        : 'openai'
    ) as LlmProvider;

    const configuredBase = (
      this.configService.get<string>('LLM_BASE_URL') || ''
    ).trim();
    this.baseUrl = (configuredBase || DEFAULT_BASE_URL[this.provider]).replace(
      /\/+$/,
      '',
    );

    this.apiKey = (this.configService.get<string>('LLM_API_KEY') || '').trim();
    this.model = (this.configService.get<string>('LLM_MODEL') || '').trim();
    this.timeoutMs = Number(
      this.configService.get<string>('LLM_TIMEOUT_MS') || 120000,
    );
  }

  /** ให้ service เช็คก่อนเรียก จะได้แจ้ง admin ว่ายังไม่ได้ตั้งค่า แทนที่จะ error ตอนยิงจริง */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.model);
  }

  getModelName(): string {
    return this.model;
  }

  getProvider(): LlmProvider {
    return this.provider;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'ยังไม่ได้ตั้งค่า LLM — ต้องกำหนด LLM_API_KEY, LLM_MODEL และ (สำหรับ provider openai) LLM_BASE_URL ใน .env',
      );
    }

    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 4096;

    const { url, body, headers } = this.buildRequest(
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers,
          timeout: this.timeoutMs,
        }),
      );
      return this.parseResponse(response.data);
    } catch (error) {
      // ห้าม log body หรือ header เพราะมี API key อยู่ข้างใน
      if (error instanceof ServiceUnavailableException) throw error;
      const detail =
        error?.response?.data?.error?.message ?? // openai / gemini
        error?.response?.data?.error?.detail ??
        error?.response?.data?.detail ?? // dotBLUE / FastAPI style
        error?.message ??
        'unknown error';
      const status = error?.response?.status;
      this.logger.error(
        `LLM request failed (provider=${this.provider}, model=${this.model}, status=${status ?? 'n/a'}): ${detail}`,
      );
      throw new ServiceUnavailableException(`เรียก LLM ไม่สำเร็จ: ${detail}`);
    }
  }

  // ───────────────────────────── request ─────────────────────────────

  private buildRequest(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number,
  ): { url: string; body: Record<string, any>; headers: Record<string, string> } {
    switch (this.provider) {
      case 'anthropic':
        return {
          url: `${this.baseUrl}/v1/messages`,
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json',
          },
          body: {
            model: this.model,
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
          url: `${this.baseUrl}/v1beta/models/${this.model}:generateContent`,
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          },
        };

      case 'openai':
      default:
        return {
          url: `${this.baseUrl}/chat/completions`,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature,
            max_tokens: maxTokens,
          },
        };
    }
  }

  // ───────────────────────────── response ─────────────────────────────

  private parseResponse(data: any): string {
    switch (this.provider) {
      case 'anthropic':
        return this.parseAnthropic(data);
      case 'gemini':
        return this.parseGemini(data);
      case 'openai':
      default:
        return this.parseOpenAi(data);
    }
  }

  private parseOpenAi(data: any): string {
    const content = data?.choices?.[0]?.message?.content;
    return this.requireText(content, data);
  }

  private parseAnthropic(data: any): string {
    // ถ้าโดน safety classifier ปฏิเสธ จะได้ HTTP 200 พร้อม stop_reason 'refusal'
    // ไม่ใช่ error — ต้องเช็คเอง ไม่งั้นจะไปเจอ "ไม่พบ JSON" ที่ปลายทางแทน
    if (data?.stop_reason === 'refusal') {
      const category = data?.stop_details?.category ?? 'ไม่ระบุ';
      throw new ServiceUnavailableException(
        `Claude ปฏิเสธคำขอนี้ด้วยเหตุผลด้านความปลอดภัย (${category}) — ลองปรับคำอธิบายเพิ่มเติมแล้วสั่งใหม่`,
      );
    }
    // content เป็น array ของ block หลายชนิด (thinking, text, ...) เอาเฉพาะ text
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const text = blocks
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('');
    return this.requireText(text, data);
  }

  private parseGemini(data: any): string {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new ServiceUnavailableException(
        `Gemini ปฏิเสธคำขอนี้ (${blockReason}) — ลองปรับคำอธิบายเพิ่มเติมแล้วสั่งใหม่`,
      );
    }
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      // MAX_TOKENS / SAFETY / RECITATION — คำตอบอาจขาดกลางคัน บอกให้รู้ตรง ๆ
      this.logger.warn(
        `Gemini finished with reason ${candidate.finishReason} (model=${this.model})`,
      );
    }
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    const text = parts
      .filter((p: any) => typeof p?.text === 'string')
      .map((p: any) => p.text)
      .join('');
    return this.requireText(text, data);
  }

  private requireText(text: unknown, data: any): string {
    if (typeof text !== 'string' || text.trim() === '') {
      this.logger.error(
        `LLM returned an unexpected response shape (provider=${this.provider}, top-level keys: ${Object.keys(data ?? {}).join(', ')})`,
      );
      throw new ServiceUnavailableException(
        'LLM ตอบกลับมาในรูปแบบที่อ่านไม่ได้',
      );
    }
    return text;
  }
}
