import { z } from 'zod';

export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  AI_PROVIDER: z.enum(['openrouter', 'anthropic']).default('openrouter'),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().default('google/gemini-2.5-flash-preview'),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
