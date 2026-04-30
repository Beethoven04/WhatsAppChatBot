import { z } from 'zod';

const envSchema = z.object({
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.0-flash'),
  DEMO_FORCE_FALLBACK: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) =>
      typeof value === 'boolean' ? value : value?.toLowerCase() === 'true'
    )
    .default(false),
  MANAGER_PHONE: z.string().min(8),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

export type AppEnv = z.infer<typeof envSchema>;

export const loadEnv = (): AppEnv => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    // eslint-disable-next-line no-console
    console.error(`Environment validation failed: ${formatted}`);
    process.exit(1);
  }

  return parsed.data;
};
