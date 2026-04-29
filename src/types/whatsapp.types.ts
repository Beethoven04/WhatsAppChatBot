export interface WhatsAppTextMessage {
  from: string;
  id: string;
  text?: { body?: string };
  type: string;
}

export interface WhatsAppContact {
  profile?: { name?: string };
  wa_id?: string;
}

export interface WhatsAppValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppTextMessage[];
  statuses?: unknown[];
}

export interface WhatsAppChange {
  value?: WhatsAppValue;
  field?: string;
}

export interface WhatsAppEntry {
  id?: string;
  changes?: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}

export interface ParsedIncomingMessage {
  phone: string;
  messageText: string;
  customerName: string;
  messageId: string;
}
