import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "true");

const integerString = (defaultValue: number) =>
  z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .default(String(defaultValue))
    .transform((value) => Number(value));

export const branding = {
  productName: process.env.APP_NAME ?? "StudyHub"
} as const;

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("StudyHub"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  API_PORT: integerString(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString.default("true"),
  S3_PRESIGNED_TTL_SECONDS: integerString(300),
  SESSION_COOKIE_NAME: z.string().min(1).default("studyhub_session"),
  CSRF_COOKIE_NAME: z.string().min(1).default("studyhub_csrf"),
  COOKIE_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: integerString(168),
  CSRF_SECRET: z.string().min(32),
  MAX_UPLOAD_BYTES: integerString(104857600),
  USER_STORAGE_QUOTA_BYTES: integerString(5368709120),
  TEXT_PREVIEW_LIMIT_BYTES: integerString(262144)
});

export type ApiConfig = z.infer<typeof apiEnvSchema> & {
  trustedOrigins: Set<string>;
  isProduction: boolean;
};

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = apiEnvSchema.parse(env);
  return {
    ...parsed,
    trustedOrigins: new Set(parsed.TRUSTED_ORIGINS.split(",").map((origin) => origin.trim())),
    isProduction: parsed.NODE_ENV === "production"
  };
}

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000/api"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("StudyHub")
});

export type WebConfig = z.infer<typeof webEnvSchema>;

export function loadWebConfig(env: NodeJS.ProcessEnv = process.env): WebConfig {
  return webEnvSchema.parse(env);
}
