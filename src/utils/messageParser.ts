import { MAX_MESSAGE_LENGTH } from '../config/constants';
import type { ParsedIncomingMessage, WhatsAppWebhookPayload } from '../types/whatsapp.types';

const sanitizeText = (value: string): string =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);

export const parseIncomingMessage = (payload: WhatsAppWebhookPayload): ParsedIncomingMessage | null => {
  const change = payload.entry?.[0]?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (!message || message.type !== 'text') {
    return null;
  }

  const phone = message.from?.trim();
  const text = sanitizeText(message.text?.body ?? '');
  const messageId = message.id?.trim();
  const customerName = sanitizeText(change?.value?.contacts?.[0]?.profile?.name ?? 'Customer');

  if (!phone || !text || !messageId) {
    return null;
  }

  return {
    phone,
    messageText: text,
    customerName,
    messageId
  };
};
