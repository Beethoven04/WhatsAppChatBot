import type { FastifyServerOptions } from 'fastify';
import type { AppEnv } from '../config/env';
import { PHONE_MASK_VISIBLE_DIGITS } from '../config/constants';

export const createLoggerOptions = (env: AppEnv): FastifyServerOptions['logger'] => ({
    level: env.LOG_LEVEL,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.x-hub-signature-256'],
      censor: '[REDACTED]'
    }
  });

export const maskPhone = (phone: string): string => {
  if (phone.length <= PHONE_MASK_VISIBLE_DIGITS) return '*'.repeat(phone.length);
  const visible = phone.slice(-PHONE_MASK_VISIBLE_DIGITS);
  return `${'*'.repeat(phone.length - PHONE_MASK_VISIBLE_DIGITS)}${visible}`;
};
