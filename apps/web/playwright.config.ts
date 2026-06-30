import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: `pnpm --dir "${workspaceRoot}" dev`,
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public",
      S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      S3_REGION: process.env.S3_REGION ?? "us-east-1",
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "studyhub_minio",
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "studyhub_minio_dev_password",
      S3_BUCKET: process.env.S3_BUCKET ?? "studyhub-private",
      S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? "true",
      COOKIE_SECRET: process.env.COOKIE_SECRET ?? "dev-cookie-secret-change-me-32-bytes",
      CSRF_SECRET: process.env.CSRF_SECRET ?? "dev-csrf-secret-change-me-32-bytes",
      WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
      TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS ?? "http://localhost:3000,http://localhost:4000",
      API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? "http://localhost:4000"
    }
  }
});
