import { z } from 'zod';
import { MAX_REPLY_LENGTH } from '../config/constants';
import type { AiReply } from '../types/ai.types';

const aiReplySchema = z.object({
  intent: z.enum(['greeting', 'product_question', 'shipping', 'returns', 'escalate', 'other']),
  reply: z.string().min(1).max(MAX_REPLY_LENGTH),
  needs_escalation: z.boolean(),
  escalation_reason: z.string()
});

export const parseAiReply = (raw: string): AiReply | null => {
  try {
    const parsed = JSON.parse(raw);
    return aiReplySchema.parse(parsed);
  } catch {
    return null;
  }
};
