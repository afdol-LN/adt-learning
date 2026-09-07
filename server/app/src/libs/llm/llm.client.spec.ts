import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LlmClient } from './llm.client';

/**
 * ตรวจการประกอบ request และการอ่าน response ของทั้งสามตระกูล API
 * โดยไม่ยิงเน็ตจริง — mock HttpService
 */
function makeClient(env: Record<string, string>) {
  const post = jest.fn();
  const httpService = { post } as any;
  const configService = {
    get: (key: string) => env[key],
  } as any;
  return { client: new LlmClient(httpService, configService), post };
}

const OPENAI_ENV = {
  LLM_PROVIDER: 'openai',
  LLM_BASE_URL: 'https://openrouter.ai/api/v1',
  LLM_API_KEY: 'test-key',
  LLM_MODEL: 'anthropic/claude-opus-5',
};

const ANTHROPIC_ENV = {
  LLM_PROVIDER: 'anthropic',
  LLM_API_KEY: 'test-key',
  LLM_MODEL: 'claude-opus-5',
};

const GEMINI_ENV = {
  LLM_PROVIDER: 'gemini',
  LLM_API_KEY: 'test-key',
  LLM_MODEL: 'gemini-2.5-flash',
};

describe('LlmClient — configuration', () => {
  it('ยังไม่ configured เมื่อไม่ได้ตั้งค่าอะไรเลย', () => {
    const { client } = makeClient({});
    expect(client.isConfigured()).toBe(false);
  });

  it('provider openai ต้องมี LLM_BASE_URL ถึงจะ configured', () => {
    const { client } = makeClient({
      LLM_PROVIDER: 'openai',
      LLM_API_KEY: 'k',
      LLM_MODEL: 'm',
    });
    expect(client.isConfigured()).toBe(false);
  });

  it('anthropic และ gemini มี base url เริ่มต้นให้ ไม่ต้องตั้งเอง', () => {
    expect(makeClient(ANTHROPIC_ENV).client.isConfigured()).toBe(true);
    expect(makeClient(GEMINI_ENV).client.isConfigured()).toBe(true);
  });

  it('provider ที่สะกดผิดถอยกลับไปใช้ openai', () => {
    const { client } = makeClient({ ...OPENAI_ENV, LLM_PROVIDER: 'claude' });
    expect(client.getProvider()).toBe('openai');
  });

  it('โยน error ที่อ่านรู้เรื่องเมื่อยังไม่ตั้งค่า แทนที่จะยิงแล้วพัง', async () => {
    const { client } = makeClient({});
    await expect(client.complete('sys', 'user')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('ตัด / ท้าย base url ทิ้ง จะได้ไม่เกิด // ใน path', async () => {
    const { client, post } = makeClient({
      ...OPENAI_ENV,
      LLM_BASE_URL: 'https://openrouter.ai/api/v1///',
    });
    post.mockReturnValue(
      of({ data: { choices: [{ message: { content: 'ok' } }] } }),
    );
    await client.complete('sys', 'user');
    expect(post.mock.calls[0][0]).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
  });
});

describe('LlmClient — openai-compatible', () => {
  it('ยิงไป /chat/completions พร้อม Bearer token และอ่านคำตอบได้', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(
      of({ data: { choices: [{ message: { content: '[{"a":1}]' } }] } }),
    );

    const result = await client.complete('system text', 'user text');

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(config.headers.Authorization).toBe('Bearer test-key');
    expect(body.messages).toEqual([
      { role: 'system', content: 'system text' },
      { role: 'user', content: 'user text' },
    ]);
    expect(result).toBe('[{"a":1}]');
  });
});

describe('LlmClient — anthropic', () => {
  it('ยิงไป /v1/messages พร้อม x-api-key และ anthropic-version', async () => {
    const { client, post } = makeClient(ANTHROPIC_ENV);
    post.mockReturnValue(
      of({ data: { content: [{ type: 'text', text: '[]' }] } }),
    );

    await client.complete('system text', 'user text');

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(config.headers['x-api-key']).toBe('test-key');
    expect(config.headers['anthropic-version']).toBe('2023-06-01');
    expect(body.system).toBe('system text');
    expect(body.messages).toEqual([{ role: 'user', content: 'user text' }]);
  });

  it('ไม่ส่ง temperature ไป Claude (รุ่น 4.7 ขึ้นไปตอบ 400 ถ้ามี)', async () => {
    const { client, post } = makeClient(ANTHROPIC_ENV);
    post.mockReturnValue(
      of({ data: { content: [{ type: 'text', text: '[]' }] } }),
    );

    await client.complete('sys', 'user', { temperature: 0.9 });

    const body = post.mock.calls[0][1];
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
    expect(body.max_tokens).toBeDefined();
  });

  it('เก็บเฉพาะ block ชนิด text ข้าม thinking block ไป', async () => {
    const { client, post } = makeClient(ANTHROPIC_ENV);
    post.mockReturnValue(
      of({
        data: {
          content: [
            { type: 'thinking', thinking: 'ครุ่นคิด' },
            { type: 'text', text: '[{"a":' },
            { type: 'text', text: '1}]' },
          ],
        },
      }),
    );

    expect(await client.complete('sys', 'user')).toBe('[{"a":1}]');
  });

  it('แปลง stop_reason refusal (HTTP 200) เป็น error ไม่ปล่อยผ่าน', async () => {
    const { client, post } = makeClient(ANTHROPIC_ENV);
    post.mockReturnValue(
      of({
        data: {
          stop_reason: 'refusal',
          stop_details: { category: 'cyber' },
          content: [],
        },
      }),
    );

    await expect(client.complete('sys', 'user')).rejects.toThrow(/cyber/);
  });
});

describe('LlmClient — gemini', () => {
  it('ยิงไป generateContent พร้อม x-goog-api-key ไม่ใส่ key ใน URL', async () => {
    const { client, post } = makeClient(GEMINI_ENV);
    post.mockReturnValue(
      of({
        data: { candidates: [{ content: { parts: [{ text: '[]' }] } }] },
      }),
    );

    await client.complete('system text', 'user text');

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(url).not.toContain('test-key');
    expect(config.headers['x-goog-api-key']).toBe('test-key');
    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'system text' }],
    });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'user text' }] },
    ]);
  });

  it('ต่อ parts หลายชิ้นเข้าด้วยกัน', async () => {
    const { client, post } = makeClient(GEMINI_ENV);
    post.mockReturnValue(
      of({
        data: {
          candidates: [
            { content: { parts: [{ text: '[{"a":' }, { text: '1}]' }] } },
          ],
        },
      }),
    );

    expect(await client.complete('sys', 'user')).toBe('[{"a":1}]');
  });

  it('แปลง promptFeedback.blockReason เป็น error', async () => {
    const { client, post } = makeClient(GEMINI_ENV);
    post.mockReturnValue(
      of({ data: { promptFeedback: { blockReason: 'SAFETY' } } }),
    );

    await expect(client.complete('sys', 'user')).rejects.toThrow(/SAFETY/);
  });
});

describe('LlmClient — error handling', () => {
  it('ไม่เผย API key ในข้อความ error', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(
      throwError(() => ({
        response: { status: 401, data: { error: { message: 'bad key' } } },
        message: 'Request failed',
      })),
    );

    await expect(client.complete('sys', 'user')).rejects.toThrow(/bad key/);
    await expect(client.complete('sys', 'user')).rejects.not.toThrow(
      /test-key/,
    );
  });

  it('response รูปแบบแปลก ๆ ถือเป็น error ไม่คืนสตริงว่าง', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(of({ data: { unexpected: true } }));

    await expect(client.complete('sys', 'user')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
