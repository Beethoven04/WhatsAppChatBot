import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { AppEnv } from './config/env';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from './config/constants';
import { createWebhookHandlers } from './handlers/webhook.handler';
import { verifyMetaSignature } from './middleware/signature.middleware';
import { GeminiService } from './services/gemini.service';
import { createProductRepository } from './services/product.service';
import { WhatsAppService } from './services/whatsapp.service';
import { createLoggerOptions } from './utils/logger';

/** Builds and configures the Fastify app with security middleware and routes. */
export const buildApp = async (env: AppEnv) => {
  const app = Fastify({ logger: createLoggerOptions(env), trustProxy: 1 });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW
  });

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  const productRepository = createProductRepository();
  const geminiService = new GeminiService(env);
  const whatsappService = new WhatsAppService(env, app.log);

  const handlers = createWebhookHandlers({
    env,
    logger: app.log,
    productRepository,
    geminiService,
    whatsappService
  });

  app.get('/', handlers.getHealth);
  app.get('/webhook', handlers.verifyWebhook);
  app.post('/webhook', { preHandler: verifyMetaSignature(env) }, handlers.postWebhook);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled server error');
    void reply.code(500).send({ error: 'Internal server error' });
  });

  return app;
};

export default buildApp;
