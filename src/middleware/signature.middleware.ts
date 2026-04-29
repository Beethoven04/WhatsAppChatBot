import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SIGNATURE_HEADER, SIGNATURE_PREFIX } from '../config/constants';
import type { AppEnv } from '../config/env';

export const verifyMetaSignature = (env: AppEnv) =>
  async (request: FastifyRequest<{ Body: string }>, reply: FastifyReply): Promise<void> => {
    const signature = request.headers[SIGNATURE_HEADER] as string | undefined;
    const rawBody = request.body;

    if (!signature || !rawBody || !signature.startsWith(SIGNATURE_PREFIX)) {
      await reply.code(403).send({ error: 'Invalid signature' });
      return;
    }

    const expected = crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
    const incoming = signature.slice(SIGNATURE_PREFIX.length);

    if (incoming.length !== expected.length) {
      await reply.code(403).send({ error: 'Signature verification failed' });
      return;
    }

    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incoming));
    if (!valid) {
      await reply.code(403).send({ error: 'Signature verification failed' });
    }
  };
