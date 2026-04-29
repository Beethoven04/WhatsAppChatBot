import { setTimeout as delay } from 'node:timers/promises';
import { GEMINI_API_BASE, GEMINI_RETRY_DELAY_MS, JSON_CONTENT_TYPE, REQUEST_TIMEOUT_MS } from '../config/constants';
import type { AppEnv } from '../config/env';
import type { GeminiGenerateResult } from '../types/ai.types';

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

export class GeminiService {
  constructor(
    private readonly env: AppEnv,
    private readonly sleep: (ms: number) => Promise<unknown> = delay
  ) {}

  /** Executes one Gemini REST request with timeout protection. */
  private async callGemini(prompt: string): Promise<{ status: number; body: GeminiResponse | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${this.env.GEMINI_MODEL}:generateContent?key=${this.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': JSON_CONTENT_TYPE },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        signal: controller.signal
      });

      const body = (await response.json().catch(() => null)) as GeminiResponse | null;
      return { status: response.status, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Generates AI output and applies one retry on HTTP 429.
   * Returns an error object instead of throwing to keep caller flows stable.
   */
  public async generateReply(prompt: string): Promise<GeminiGenerateResult> {
    try {
      const first = await this.callGemini(prompt);
      if (first.status === 429) {
        await this.sleep(GEMINI_RETRY_DELAY_MS);
        const second = await this.callGemini(prompt);
        if (second.status >= 200 && second.status < 300) {
          const reply = second.body?.candidates?.[0]?.content?.parts?.[0]?.text;
          return reply ? { ok: true, reply } : { ok: false, error: 'Empty AI response after retry' };
        }
        return { ok: false, error: `Gemini retry failed with status ${second.status}` };
      }

      if (first.status >= 200 && first.status < 300) {
        const reply = first.body?.candidates?.[0]?.content?.parts?.[0]?.text;
        return reply ? { ok: true, reply } : { ok: false, error: 'Empty AI response' };
      }

      return { ok: false, error: `Gemini failed with status ${first.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Gemini error';
      return { ok: false, error: message };
    }
  }
}
