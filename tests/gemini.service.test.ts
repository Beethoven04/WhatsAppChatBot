import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiService } from '../src/services/gemini.service';

const env = {
  WHATSAPP_TOKEN: 'x',
  WHATSAPP_PHONE_ID: 'x',
  WHATSAPP_VERIFY_TOKEN: 'x',
  WHATSAPP_APP_SECRET: 'x',
  GEMINI_API_KEY: 'key',
  GEMINI_MODEL: 'gemini-2.0-flash',
  DEMO_FORCE_FALLBACK: false,
  MANAGER_PHONE: '212700000001',
  PORT: 3000,
  NODE_ENV: 'test' as const,
  LOG_LEVEL: 'info' as const
};

describe('GeminiService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns AI text on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"intent":"other","reply":"ok","needs_escalation":false,"escalation_reason":""}' }] } }] })
      })
    );

    const service = new GeminiService(env);
    const result = await service.generateReply('hello');
    expect(result.ok).toBe(true);
    expect(result.reply).toContain('intent');
  });

  it('retries once on 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"intent":"other","reply":"retry","needs_escalation":false,"escalation_reason":""}' }] } }] })
      });

    vi.stubGlobal('fetch', fetchMock);

    const service = new GeminiService(env, async () => undefined);
    const result = await service.generateReply('hello');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });
});
