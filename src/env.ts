import dotenv from 'dotenv';
import { z } from 'zod';
import bunyan from 'bunyan'
dotenv.config();
const log = bunyan.createLogger({ name: 'env' })

const envSchema = z.object({
  PORT: z.string(),
  LND_HOST: z.string(),
  LND_CERT: z.string(),
  LND_MACAROON: z.string(),
})

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  log.error(JSON.stringify(parsedEnv.error, null, 2));
  throw new Error('Invalid environment variables. Please check your .env file');
}

export const env = parsedEnv.data;
