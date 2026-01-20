import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_KEY: z.string().optional(),
  DATABASE_PATH: z.string().default('./data/messydash.db'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Log warning if no API key is configured
if (!config.API_KEY) {
  console.warn('⚠️  No API_KEY configured - authentication is disabled!');
}
