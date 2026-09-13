import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LlmClient } from './llm.client';

/**
 * ตรวจการประกอบ request, การอ่าน response ของทั้งสามตระกูล API
 * และ fallback chain — โดยไม่ยิงเน็ตจริง (mock HttpService)
 */
function makeClient(env: Record<string, string>) {
  const post = jest.fn();
  const httpService = { post } as any;
  const configService = { get: (key: string) => env[key] } as any;
  return { client: new LlmClient(httpService, configService), post };
}

const okOpenAi = (text: string) =>
  of({ data: { choices: [{ message: { content: text } }] } });

const timeoutError = () =>
  throwError(() => ({
    code: 'ECONNABORTED',
    message: 'timeout of 25000ms exceeded',
  }));

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

/** chain จริงแบบที่ตั้งใน .env.dev: OpenRouter ก่อน แล้วตกไป dotBLUE */
const CHAIN_ENV = {
  LLM_CHAIN: 'OPENROUTER_MINIMAX, DOTBLUE_GEMMA',

  OPENROUTER_MINIMAX_PROVIDER: 'openai',
  OPENROUTER_MINIMAX_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_MINIMAX_API_KEY: 'or-key',
  OPENROUTER_MINIMAX_MODEL: 'minimax/minimax-m1:free',
  OPENROUTER_MINIMAX_TIMEOUT_MS: '25000',

  DOTBLUE_GEMMA_PROVIDER: 'openai',
  DOTBLUE_GEMMA_BASE_URL: 'https://ai.psu.blue/v1',
  DOTBLUE_GEMMA_API_KEY: 'psu-key',
  DOTBLUE_GEMMA_MODEL: 'PSU-LLM/psu-gemma',
  DOTBLUE_GEMMA_TIMEOUT_MS: '60000',
};

describe('LlmClient — configuration', () => {
  it('ยังไม่ configured เมื่อไม่ได้ตั้งค่าอะไรเลย', () => {
    expect(makeClient({}).client.isConfigured()).toBe(false);
  });

  it('provider openai ต้องมี base url ถึงจะ configured', () => {
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
    expect(client.getChainSummary()[0].provider).toBe('openai');
  });

  it('โยน error ที่อ่านรู้เรื่องเมื่อยังไม่ตั้งค่า', async () => {
    await expect(makeClient({}).client.complete('sys', 'user')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('ตัด / ท้าย base url ทิ้ง', async () => {
    const { client, post } = makeClient({
      ...OPENAI_ENV,
      LLM_BASE_URL: 'https://openrouter.ai/api/v1///',
    });
    post.mockReturnValue(okOpenAi('ok'));
    await client.complete('sys', 'user');
    expect(post.mock.calls[0][0]).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
  });

  it('ตัด /chat/completions ที่เผลอใส่มาใน base url ออกให้', async () => {
    const { client, post } = makeClient({
      ...OPENAI_ENV,
      LLM_BASE_URL: 'https://ai.psu.blue/v1/chat/completions',
    });
    post.mockReturnValue(okOpenAi('ok'));
    await client.complete('sys', 'user');
    expect(post.mock.calls[0][0]).toBe(
      'https://ai.psu.blue/v1/chat/completions',
    );
  });
});

describe('LlmClient — fallback chain', () => {
  it('อ่าน chain ตามลำดับที่เขียนใน LLM_CHAIN และตัดช่องว่างให้', () => {
    const summary = makeClient(CHAIN_ENV).client.getChainSummary();
    expect(summary.map((c) => c.name)).toEqual([
      'OPENROUTER_MINIMAX',
      'DOTBLUE_GEMMA',
    ]);
    expect(summary[0].timeoutMs).toBe(25000);
    expect(summary[1].timeoutMs).toBe(60000);
  });

  it('chain summary ไม่มี API key ติดออกมา', () => {
    const summary = makeClient(CHAIN_ENV).client.getChainSummary();
    expect(JSON.stringify(summary)).not.toContain('or-key');
    expect(JSON.stringify(summary)).not.toContain('psu-key');
  });

  it('ตั้ง timeout ต่อตัวตามที่กำหนดของแต่ละ candidate', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post.mockReturnValueOnce(timeoutError()).mockReturnValueOnce(okOpenAi('ok'));

    await client.complete('sys', 'user');

    expect(post.mock.calls[0][2].timeout).toBe(25000);
    expect(post.mock.calls[1][2].timeout).toBe(60000);
  });

  it('ตัวแรก timeout → สลับไปตัวที่สองแล้วสำเร็จ', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post
      .mockReturnValueOnce(timeoutError())
      .mockReturnValueOnce(okOpenAi('[{"a":1}]'));

    const result = await client.complete('sys', 'user');

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('[{"a":1}]');
    expect(result.candidate).toBe('DOTBLUE_GEMMA');
    expect(result.model).toBe('PSU-LLM/psu-gemma');
  });

  it('ตัวแรกสำเร็จ ไม่ยิงตัวที่สอง', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post.mockReturnValue(okOpenAi('ok'));

    const result = await client.complete('sys', 'user');

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.candidate).toBe('OPENROUTER_MINIMAX');
  });

  it('สลับเมื่อเจอ HTTP error ไม่ใช่แค่ timeout', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post
      .mockReturnValueOnce(
        throwError(() => ({
          response: { status: 429, data: { error: { message: 'rate limited' } } },
        })),
      )
      .mockReturnValueOnce(okOpenAi('ok'));

    expect((await client.complete('sys', 'user')).candidate).toBe(
      'DOTBLUE_GEMMA',
    );
  });

  it('สลับเมื่อ response อ่านไม่ได้', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post
      .mockReturnValueOnce(of({ data: { unexpected: true } }))
      .mockReturnValueOnce(okOpenAi('ok'));

    expect((await client.complete('sys', 'user')).candidate).toBe(
      'DOTBLUE_GEMMA',
    );
  });

  it('พังหมดทุกตัว → error เดียวที่บอกว่าแต่ละตัวพังเพราะอะไร', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post.mockReturnValueOnce(timeoutError()).mockReturnValueOnce(
      throwError(() => ({
        response: { status: 500, data: { detail: 'engine down' } },
      })),
    );

    await expect(client.complete('sys', 'user')).rejects.toThrow(
      /OPENROUTER_MINIMAX: ไม่ตอบภายใน 25000 ms.*DOTBLUE_GEMMA: HTTP 500: engine down/s,
    );
  });

  it('ไม่เผย API key ในข้อความ error ตอนพังหมด', async () => {
    const { client, post } = makeClient(CHAIN_ENV);
    post.mockReturnValue(timeoutError());

    await expect(client.complete('sys', 'user')).rejects.not.toThrow(
      /or-key|psu-key/,
    );
  });

  it('ข้าม candidate ที่ตัวแปรไม่ครบ แต่ยังใช้ตัวที่เหลือได้', async () => {
    const { client, post } = makeClient({
      LLM_CHAIN: 'BROKEN, DOTBLUE_GEMMA',
      BROKEN_PROVIDER: 'openai',
      BROKEN_BASE_URL: 'https://example.com/v1',
      // ไม่มี BROKEN_API_KEY / BROKEN_MODEL
      DOTBLUE_GEMMA_BASE_URL: 'https://ai.psu.blue/v1',
      DOTBLUE_GEMMA_API_KEY: 'psu-key',
      DOTBLUE_GEMMA_MODEL: 'PSU-LLM/psu-gemma',
    });
    post.mockReturnValue(okOpenAi('ok'));

    expect(client.getChainSummary().map((c) => c.name)).toEqual([
      'DOTBLUE_GEMMA',
    ]);
    expect((await client.complete('sys', 'user')).candidate).toBe(
      'DOTBLUE_GEMMA',
    );
  });

  it('LLM_TIMEOUT_MS ใช้เป็นค่ากลางเมื่อ candidate ไม่ได้ตั้งของตัวเอง', () => {
    const { client } = makeClient({
      LLM_TIMEOUT_MS: '45000',
      LLM_CHAIN: 'DOTBLUE_GEMMA',
      DOTBLUE_GEMMA_BASE_URL: 'https://ai.psu.blue/v1',
      DOTBLUE_GEMMA_API_KEY: 'psu-key',
      DOTBLUE_GEMMA_MODEL: 'PSU-LLM/psu-gemma',
    });
    expect(client.getChainSummary()[0].timeoutMs).toBe(45000);
  });

  it('ผสม provider ต่างตระกูลใน chain เดียวกันได้', async () => {
    const { client, post } = makeClient({
      LLM_CHAIN: 'PRIMARY, BACKUP',
      PRIMARY_PROVIDER: 'anthropic',
      PRIMARY_API_KEY: 'a-key',
      PRIMARY_MODEL: 'claude-opus-5',
      BACKUP_PROVIDER: 'gemini',
      BACKUP_API_KEY: 'g-key',
      BACKUP_MODEL: 'gemini-2.5-flash',
    });
    post.mockReturnValueOnce(timeoutError()).mockReturnValueOnce(
      of({ data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } }),
    );

    const result = await client.complete('sys', 'user');

    expect(post.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(post.mock.calls[1][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(result.model).toBe('gemini-2.5-flash');
  });
});

describe('LlmClient — openai-compatible', () => {
  it('ยิงไป /chat/completions พร้อม Bearer token และอ่านคำตอบได้', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(okOpenAi('[{"a":1}]'));

    const result = await client.complete('system text', 'user text');

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(config.headers.Authorization).toBe('Bearer test-key');
    expect(body.messages).toEqual([
      { role: 'system', content: 'system text' },
      { role: 'user', content: 'user text' },
    ]);
    expect(result.text).toBe('[{"a":1}]');
  });

  it('ส่ง stream:false เสมอ — dotBLUE สตรีมทุกครั้งถ้าไม่ระบุ', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(okOpenAi('ok'));

    await client.complete('sys', 'user');

    expect(post.mock.calls[0][1].stream).toBe(false);
  });

  it('ประกอบ body แบบ SSE กลับเป็นข้อความเดียวได้ เผื่อ gateway ไม่สนใจ stream:false', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"[{\\"ok\\":"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"true}]"}}]}',
      '',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      '',
      'data: [DONE]',
    ].join('\n');
    post.mockReturnValue(of({ data: sse }));

    expect((await client.complete('sys', 'user')).text).toBe('[{"ok":true}]');
  });

  it('ข้าม chunk SSE ที่พัง แทนที่จะทิ้งทั้งคำตอบ', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    const sse = [
      'data: {"choices":[{"delta":{"content":"a"}}]}',
      'data: {not valid json',
      'data: {"choices":[{"delta":{"content":"b"}}]}',
      'data: [DONE]',
    ].join('\n');
    post.mockReturnValue(of({ data: sse }));

    expect((await client.complete('sys', 'user')).text).toBe('ab');
  });

  it('body เป็นสตริงที่ไม่ใช่ SSE → error ที่อ่านรู้เรื่อง ไม่ใช่ index เป็นพันตัว', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(of({ data: '<html>502 Bad Gateway</html>' }));

    await expect(client.complete('sys', 'user')).rejects.toThrow(
      /body เป็นสตริงยาว 28 ตัวอักษร/,
    );
  });
});

describe('LlmClient — anthropic', () => {
  it('ยิงไป /v1/messages พร้อม x-api-key และ anthropic-version', async () => {
    const { client, post } = makeClient(ANTHROPIC_ENV);
    post.mockReturnValue(of({ data: { content: [{ type: 'text', text: '[]' }] } }));

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
    post.mockReturnValue(of({ data: { content: [{ type: 'text', text: '[]' }] } }));

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

    expect((await client.complete('sys', 'user')).text).toBe('[{"a":1}]');
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
      of({ data: { candidates: [{ content: { parts: [{ text: '[]' }] } }] } }),
    );

    await client.complete('system text', 'user text');

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(url).not.toContain('test-key');
    expect(config.headers['x-goog-api-key']).toBe('test-key');
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'system text' }] });
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

    expect((await client.complete('sys', 'user')).text).toBe('[{"a":1}]');
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
    await expect(client.complete('sys', 'user')).rejects.not.toThrow(/test-key/);
  });

  it('response รูปแบบแปลก ๆ ถือเป็น error ไม่คืนสตริงว่าง', async () => {
    const { client, post } = makeClient(OPENAI_ENV);
    post.mockReturnValue(of({ data: { unexpected: true } }));

    await expect(client.complete('sys', 'user')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
