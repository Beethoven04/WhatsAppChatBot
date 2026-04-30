import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import { APP_VERSION, MESSAGE_PREVIEW_LENGTH } from '../config/constants';
import type { AppEnv } from '../config/env';
import type { AiReply, StoreConfig } from '../types/ai.types';
import type { ProductRepository, Product } from '../types/product.types';
import type { WhatsAppWebhookPayload } from '../types/whatsapp.types';
import { parseIncomingMessage } from '../utils/messageParser';
import { maskPhone } from '../utils/logger';
import { parseAiReply } from '../utils/responseParser';
import type { GeminiService } from '../services/gemini.service';
import type { WhatsAppService } from '../services/whatsapp.service';

interface HandlerDeps {
  env: AppEnv;
  logger: FastifyBaseLogger;
  productRepository: ProductRepository;
  geminiService: GeminiService;
  whatsappService: WhatsAppService;
}

const readStoreConfig = async (): Promise<StoreConfig> => {
  const filePath = path.resolve(process.cwd(), 'data/store-config.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as StoreConfig;
};

const renderProducts = (products: Product[]): string => {
  if (!products.length) return 'No exact product match found from query.';
  return products
    .map(
      (p) =>
        `- ${p.name} (${p.product_id}) | ${p.price} ${p.currency} | Stock: ${p.stock_quantity} | Category: ${p.category} | Colors: ${p.color_options.join(', ')} | Sizes: ${p.size_options.join(', ')}`
    )
    .join('\n');
};

const buildPrompt = (store: StoreConfig, products: Product[], message: string): string => `You are a WhatsApp customer support agent for ${store.storeName}.
Answer ONLY using the product information and store policies provided.
Never invent prices, stock levels, or product details.
Be friendly and concise - this is WhatsApp, keep replies under 300 characters.
Use emojis naturally.

STORE POLICIES:
${store.shippingPolicy}
${store.returnPolicy}
Support hours: ${store.supportHours}

RELEVANT PRODUCTS:
${renderProducts(products)}

Customer message:
${message}

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "intent": "greeting|product_question|shipping|returns|escalate|other",
  "reply": "your WhatsApp reply max 300 chars",
  "needs_escalation": false,
  "escalation_reason": ""
}

If you cannot answer accurately from the provided data, set needs_escalation to true.`;

const fallbackEscalation = (reason: string): AiReply => ({
  intent: 'escalate',
  reply: 'Sorry, I need a human teammate to answer this accurately. We will follow up shortly 🙏',
  needs_escalation: true,
  escalation_reason: reason
});

export const createWebhookHandlers = (deps: HandlerDeps) => {
  const getHealth = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await reply.code(200).send({ status: 'ok', timestamp: new Date().toISOString(), version: APP_VERSION });
  };

  const verifyWebhook = async (
    request: FastifyRequest<{ Querystring: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = request.query;
    if (mode === 'subscribe' && token === deps.env.WHATSAPP_VERIFY_TOKEN && challenge) {
      await reply.code(200).send(challenge);
      return;
    }

    await reply.code(403).send('Forbidden');
  };

  const processMessage = async (payload: WhatsAppWebhookPayload): Promise<void> => {
    const parsed = parseIncomingMessage(payload);
    if (!parsed) return;

    const maskedPhone = maskPhone(parsed.phone);

    try {
      const [storeConfig, products] = await Promise.all([
        readStoreConfig(),
        deps.productRepository.search(parsed.messageText)
      ]);

      const prompt = buildPrompt(storeConfig, products, parsed.messageText);
      const aiResult = await deps.geminiService.generateReply(prompt);
      const aiReply = aiResult.ok && aiResult.reply ? parseAiReply(aiResult.reply) : null;
      if (aiResult.ok && aiResult.reply && !aiReply) {
        deps.logger.warn(
          {
            phone: maskedPhone,
            aiReplyPreview: aiResult.reply.slice(0, 300)
          },
          'AI reply JSON parse failed; falling back to escalation'
        );
      }

      if (!aiResult.ok) {
        deps.logger.warn(
          {
            phone: maskedPhone,
            aiError: aiResult.error
          },
          'AI generation failed; falling back to escalation'
        );
      }

      const finalReply = aiReply ?? fallbackEscalation(aiResult.error ?? 'Invalid AI response');

      await deps.whatsappService.sendMessage(parsed.phone, finalReply.reply);

      if (finalReply.needs_escalation) {
        await deps.whatsappService.sendEscalationAlert({
          customerPhone: parsed.phone,
          customerName: parsed.customerName,
          message: parsed.messageText,
          reason: finalReply.escalation_reason || 'Manual follow-up required'
        });
      }

      // Fire-and-forget by design: read receipts should never delay customer responses.
      void deps.whatsappService.markAsRead(parsed.messageId);

      deps.logger.info(
        {
          phone: maskedPhone,
          customerName: parsed.customerName,
          messagePreview: parsed.messageText.slice(0, MESSAGE_PREVIEW_LENGTH),
          intent: finalReply.intent,
          escalated: finalReply.needs_escalation
        },
        'Webhook message processed'
      );
    } catch (error) {
      deps.logger.error(
        {
          phone: maskedPhone,
          messagePreview: parsed.messageText.slice(0, MESSAGE_PREVIEW_LENGTH),
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'Webhook processing failed'
      );

      await deps.whatsappService.sendMessage(
        parsed.phone,
        'Sorry, something went wrong. Our team has been notified and will help you shortly 🙏'
      );

      await deps.whatsappService.sendEscalationAlert({
        customerPhone: parsed.phone,
        customerName: parsed.customerName,
        message: parsed.messageText,
        reason: 'Unhandled processing error'
      });
    }
  };

  const postWebhook = async (
    request: FastifyRequest<{ Body: string }>,
    reply: FastifyReply
  ): Promise<void> => {
    await reply.code(200).send({ received: true });

    try {
      const payload = JSON.parse(request.body) as WhatsAppWebhookPayload;
      void processMessage(payload);
    } catch {
      deps.logger.warn('Invalid webhook JSON body; ignored');
    }
  };

  return { getHealth, verifyWebhook, postWebhook };
};
