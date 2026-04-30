import { setTimeout as delay } from 'node:timers/promises';
import Groq from 'groq-sdk';
import { AI_RETRY_DELAY_MS, GROQ_DEFAULT_MODEL, REQUEST_TIMEOUT_MS } from '../config/constants';
import type { AppEnv } from '../config/env';
import type { AiGenerateResult } from '../types/ai.types';

export class AiService {
  constructor(
    private readonly env: AppEnv,
    private readonly sleep: (ms: number) => Promise<unknown> = delay
  ) {}

  /** Executes one Groq chat completion call with timeout protection. */
  private async callGroq(systemPrompt: string, userMessage: string): Promise<string> {
    const client = new Groq({ apiKey: this.env.GROQ_API_KEY });

    const completionPromise = client.chat.completions.create({
      model: this.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1,
      max_tokens: 600
    });

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`AI timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
    });

    const completion = await Promise.race([completionPromise, timeoutPromise]);
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty AI response');
    }

    return content;
  }

  /**
   * Generates AI output and applies one retry on HTTP 429.
   * Returns an error object instead of throwing to keep caller flows stable.
   */
  public async generateReply(systemPrompt: string, userMessage: string): Promise<AiGenerateResult> {
    try {
      const firstReply = await this.callGroq(systemPrompt, userMessage);
      return { ok: true, reply: firstReply };
    } catch (error) {
      const firstStatus = (error as { status?: number })?.status;
      if (firstStatus === 429) {
        await this.sleep(AI_RETRY_DELAY_MS);
        try {
          const secondReply = await this.callGroq(systemPrompt, userMessage);
          return { ok: true, reply: secondReply };
        } catch (secondError) {
          const secondStatus = (secondError as { status?: number })?.status;
          return {
            ok: false,
            error: secondStatus === 429 ? 'AI retry failed with status 429' : secondError instanceof Error ? secondError.message : 'Unknown AI retry error'
          };
        }
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown AI error'
      };
    }
  }
}
