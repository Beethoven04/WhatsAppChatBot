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
import type { AiService } from '../services/ai.service';
import type { WhatsAppService } from '../services/whatsapp.service';

interface HandlerDeps {
  env: AppEnv;
  logger: FastifyBaseLogger;
  productRepository: ProductRepository;
  aiService: AiService;
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

const buildSystemPrompt = (store: StoreConfig, products: Product[]): string => `You are a WhatsApp customer support agent for ${store.storeName}.
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

const shouldForceEscalation = (messageText: string): boolean => {
  const text = messageText.toLowerCase();
  return ['human', 'agent', 'manager', 'someone real', 'call me', 'support'].some((keyword) =>
    text.includes(keyword)
  );
};

const categoryKeywordMap: Record<string, string> = {
  jacket: 'Jackets',
  jackets: 'Jackets',
  shoe: 'Shoes',
  shoes: 'Shoes',
  sneaker: 'Sneakers',
  sneakers: 'Sneakers',
  hoodie: 'Hoodies',
  hoodies: 'Hoodies',
  pant: 'Pants',
  pants: 'Pants',
  dress: 'Dresses',
  dresses: 'Dresses',
  swimwear: 'Swimwear',
  accessory: 'Accessories',
  accessories: 'Accessories'
};

const genderKeywordMap: Record<string, string> = {
  men: 'Men',
  man: 'Men',
  male: 'Men',
  women: 'Women',
  woman: 'Women',
  female: 'Women',
  kids: 'Kids',
  kid: 'Kids',
  child: 'Kids',
  children: 'Kids',
  boy: 'Kids',
  girl: 'Kids'
};

const inferIntentFromText = (messageText: string): { category?: string; gender?: string } => {
  const text = messageText.toLowerCase();
  const category = Object.entries(categoryKeywordMap).find(([k]) => text.includes(k))?.[1];
  const gender = Object.entries(genderKeywordMap).find(([k]) => text.includes(k))?.[1];
  return { category, gender };
};

const selectRelevantProduct = (messageText: string, products: Product[]): Product | null => {
  if (products.length > 0) return products[0];
  return null;
};

const buildDeterministicFallbackReply = (
  messageText: string,
  products: Product[],
  storeConfig: StoreConfig
): AiReply => {
  const lower = messageText.toLowerCase();
  if (lower.includes('ship')) {
    return {
      intent: 'shipping',
      reply: `🚚 ${storeConfig.shippingPolicy.slice(0, 260)}`,
      needs_escalation: false,
      escalation_reason: ''
    };
  }

  if (lower.includes('return') || lower.includes('refund')) {
    return {
      intent: 'returns',
      reply: `↩️ ${storeConfig.returnPolicy.slice(0, 260)}`,
      needs_escalation: false,
      escalation_reason: ''
    };
  }

  const { category, gender } = inferIntentFromText(messageText);
  const top = selectRelevantProduct(messageText, products);
  if (top) {
    const reply = `✨ ${top.name} is ${top.price} ${top.currency}, stock ${top.stock_quantity}. Colors: ${top.color_options.slice(0, 3).join(', ')}. Sizes: ${top.size_options.slice(0, 4).join(', ')}.`;
    return {
      intent: 'product_question',
      reply: reply.slice(0, 300),
      needs_escalation: false,
      escalation_reason: ''
    };
  }

  if (category || gender) {
    const categoryPart = category ? `${category}` : 'items';
    const genderPart = gender ? ` for ${gender.toLowerCase()}` : '';
    return {
      intent: 'product_question',
      reply: `Yes 👍 We have ${categoryPart}${genderPart}. Tell me preferred color, size, and budget, and I’ll suggest the best options.`,
      needs_escalation: false,
      escalation_reason: ''
    };
  }

  return {
    intent: 'other',
    reply: `Hi 👋 I can help you find products by category, color, size, and budget. You can also ask about shipping or returns.`,
    needs_escalation: false,
    escalation_reason: ''
  };
};

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

      const systemPrompt = buildSystemPrompt(storeConfig, products);
      const aiResult = deps.env.DEMO_FORCE_FALLBACK
        ? { ok: false as const, error: 'Forced deterministic fallback mode' }
        : await deps.aiService.generateReply(systemPrompt, parsed.messageText);
      const aiReply = aiResult.ok && aiResult.reply ? parseAiReply(aiResult.reply) : null;
      if (aiResult.ok && aiResult.reply && !aiReply) {
        deps.logger.warn(
          {
            phone: maskedPhone,
            aiReplyPreview: aiResult.reply.slice(0, 300)
          },
          'AI reply JSON parse failed; using deterministic fallback reply'
        );
      }

      if (!aiResult.ok) {
        deps.logger.warn(
          {
            phone: maskedPhone,
            aiError: aiResult.error
          },
          'AI generation failed; using deterministic fallback reply'
        );
      }

      const finalReply = shouldForceEscalation(parsed.messageText)
        ? fallbackEscalation('Customer explicitly requested human support')
        : aiReply ?? buildDeterministicFallbackReply(parsed.messageText, products, storeConfig);
      const sentToCustomer = await deps.whatsappService.sendMessage(parsed.phone, finalReply.reply);

      if (finalReply.needs_escalation) {
        await deps.whatsappService.sendEscalationAlert({
          customerPhone: parsed.phone,
          customerName: parsed.customerName,
          message: parsed.messageText,
          reason: finalReply.escalation_reason || 'Manual follow-up required'
        });
      }

      if (!sentToCustomer) {
        deps.logger.error({ phone: maskedPhone }, 'Final reply could not be delivered to customer');
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
