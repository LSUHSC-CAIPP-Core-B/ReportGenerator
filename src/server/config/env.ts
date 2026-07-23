import { resolve as resolvePath } from 'node:path';
import { cwd } from 'node:process';
import z from 'zod';

const EnvSchema = z
  .object({
    APP_NAME: z.string().default('ReportGenerator'),

    ASSETS_DIRECTORY: z.string().default(resolvePath(cwd(), 'src', 'assets')),

    DATABASE_NAME: z.string(),
    DATABASE_PASS: z.string(),
    DATABASE_URL: z
      .string()
      .url()
      .regex(/^mongodb(?:\+srv)?:\/\//g),
    DATABASE_USER: z.string(),

    NODE_ENV: z.enum(['development', 'test', 'production']),
    WEBSERVER_PORT: z.coerce.number().default(3000),
  })
  .readonly();

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(result.error.format());

  process.exit(1);
}

export const env = result.data;
