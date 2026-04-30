import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_RETRY_DELAY_MS } from '../src/config/constants';
import { AiService } from '../src/services/ai.service';

const env = {
  WHATSAPP_TOKEN: 'x',
  WHATSAPP_PHONE_ID: 'x',
  WHATSAPP_VERIFY_TOKEN: 'x',
  WHATSAPP_APP_SECRET: 'x',
  GROQ_API_KEY: 'key',
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  DEMO_FORCE_FALLBACK: false,
  MANAGER_PHONE: '212700000001',
  PORT: 3000,
  NODE_ENV: 'test' as const,
  LOG_LEVEL: 'info' as const
};

vi.mock('groq-sdk', () => {
  return {
    default: class MockGroq {
      static responder: () => Promise<unknown> = async () => ({ choices: [{ message: { content: 'ok' } }] });
      public chat = {
        completions: {
          create: () => MockGroq.responder()
        }
      };
    }
  };
});

describe('AiService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns AI text on success', async () => {
    const { default: MockGroq } = await import('groq-sdk');
    (MockGroq as unknown as { responder: () => Promise<unknown> }).responder = async () => ({
      choices: [{ message: { content: '{"intent":"other","reply":"ok","needs_escalation":false,"escalation_reason":""}' } }]
    });

    const service = new AiService(env);
    const result = await service.generateReply('system', 'hello');
    expect(result.ok).toBe(true);
    expect(result.reply).toContain('intent');
  });

  it('retries once on 429', async () => {
    const { default: MockGroq } = await import('groq-sdk');
    let callCount = 0;
    (MockGroq as unknown as { responder: () => Promise<unknown> }).responder = async () => {
      callCount += 1;
      if (callCount === 1) {
        const error = new Error('rate limited') as Error & { status?: number };
        error.status = 429;
        throw error;
      }
      return {
        choices: [{ message: { content: '{"intent":"other","reply":"retry","needs_escalation":false,"escalation_reason":""}' } }]
      };
    };

    const sleep = vi.fn(async (_ms: number) => undefined);
    const service = new AiService(env, sleep);
    const result = await service.generateReply('system', 'hello');

    expect(result.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(AI_RETRY_DELAY_MS);
  });
});
