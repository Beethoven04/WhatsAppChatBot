import { describe, expect, it } from 'vitest';
import { parseAiReply } from '../src/utils/responseParser';

describe('parseAiReply', () => {
  it('parses strict JSON', () => {
    const raw = JSON.stringify({
      intent: 'product_question',
      reply: 'Yes, we have jackets in stock 👌',
      needs_escalation: false,
      escalation_reason: ''
    });

    const parsed = parseAiReply(raw);
    expect(parsed?.intent).toBe('product_question');
    expect(parsed?.needs_escalation).toBe(false);
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const raw = '```json\n{\n  "intent":"shipping",\n  "reply":"Shipping takes 5-7 days 🚚",\n  "needs_escalation":"false",\n  "escalation_reason":""\n}\n```';
    const parsed = parseAiReply(raw);
    expect(parsed?.intent).toBe('shipping');
    expect(parsed?.needs_escalation).toBe(false);
  });

  it('extracts JSON when extra text surrounds object', () => {
    const raw = 'Here is your JSON: {"intent":"returns","reply":"30-day returns ✅","needs_escalation":false,"escalation_reason":""}';
    const parsed = parseAiReply(raw);
    expect(parsed?.intent).toBe('returns');
  });
});
