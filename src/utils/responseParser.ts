import { z } from 'zod';
import { MAX_REPLY_LENGTH } from '../config/constants';
import type { AiReply } from '../types/ai.types';

const intentSchema = z
  .string()
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(['greeting', 'product_question', 'shipping', 'returns', 'escalate', 'other']));

const aiReplySchema = z
  .object({
    intent: intentSchema,
    reply: z.string().min(1),
    needs_escalation: z.union([z.boolean(), z.string()]),
    escalation_reason: z.string().optional().default('')
  })
  .transform((value) => ({
    intent: value.intent,
    reply: value.reply.trim().slice(0, MAX_REPLY_LENGTH),
    needs_escalation:
      typeof value.needs_escalation === 'boolean'
        ? value.needs_escalation
        : value.needs_escalation.toLowerCase() === 'true',
    escalation_reason: value.escalation_reason
  }));

const extractJsonObject = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch?.[1]) {
    const candidate = codeFenceMatch[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
};

export const parseAiReply = (raw: string): AiReply | null => {
  try {
    const jsonCandidate = extractJsonObject(raw);
    if (!jsonCandidate) return null;
    const parsed = JSON.parse(jsonCandidate);
    return aiReplySchema.parse(parsed);
  } catch {
    return null;
  }
};
