import { loadEnv } from './config/env';
import 'dotenv/config';
import buildApp from './app';

const start = async (): Promise<void> => {
  const env = loadEnv();
  const app = await buildApp(env);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info({ port: env.PORT }, 'Server started');
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

void start();
