/** Central location for magic values and shared constants. */
export const APP_VERSION = '1.0.0';
export const REQUEST_TIMEOUT_MS = 15_000;
export const AI_RETRY_DELAY_MS = 30_000;
export const MAX_MESSAGE_LENGTH = 1_000;
export const MAX_REPLY_LENGTH = 300;
export const MESSAGE_PREVIEW_LENGTH = 120;
export const PHONE_MASK_VISIBLE_DIGITS = 4;
export const RATE_LIMIT_MAX = 60;
export const RATE_LIMIT_WINDOW = '1 minute';
export const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';
export const WHATSAPP_API_BASE = 'https://graph.facebook.com/v21.0';
export const JSON_CONTENT_TYPE = 'application/json';
export const SIGNATURE_HEADER = 'x-hub-signature-256';
export const SIGNATURE_PREFIX = 'sha256=';
