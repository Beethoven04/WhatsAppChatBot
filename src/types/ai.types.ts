export type AiIntent = 'greeting' | 'product_question' | 'shipping' | 'returns' | 'escalate' | 'other';

export interface AiReply {
  intent: AiIntent;
  reply: string;
  needs_escalation: boolean;
  escalation_reason: string;
}

export interface GeminiGenerateResult {
  ok: boolean;
  reply?: string;
  error?: string;
}

export interface StoreConfig {
  storeName: string;
  supportHours: string;
  shippingPolicy: string;
  returnPolicy: string;
  currency: string;
  languages: string[];
}
