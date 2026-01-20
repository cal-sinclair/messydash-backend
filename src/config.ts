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

// Security check: Require API_KEY in production
if (config.NODE_ENV === 'production' && !config.API_KEY) {
  console.error('❌ FATAL: API_KEY must be set in production environment.');
  process.exit(1);
}

// Log warning if no API key is configured in non-production
if (!config.API_KEY) {
  console.warn('⚠️  WARNING: No API_KEY configured. Authentication is disabled!');
  console.warn('⚠️  This is only acceptable for local development.');
}
