import cookieParser from "cookie-parser";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { AppModule } from "../src/app.module";
import { SafeErrorFilter } from "../src/common/safe-error.filter";
import { PrismaService } from "../src/common/prisma.service";
import { hashSecret } from "../src/auth/token";

process.env.NODE_ENV = "test";
process.env.API_PORT = "4010";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.TRUSTED_ORIGINS = "http://localhost:3000,http://localhost:4010";
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
process.env.S3_REGION = process.env.S3_REGION ?? "us-east-1";
process.env.S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? "studyhub_minio";
process.env.S3_SECRET_ACCESS_KEY =
  process.env.S3_SECRET_ACCESS_KEY ?? "studyhub_minio_dev_password";
process.env.S3_BUCKET = process.env.S3_BUCKET ?? "studyhub-private";
process.env.S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE ?? "true";
process.env.S3_PRESIGNED_TTL_SECONDS = "300";
process.env.SESSION_COOKIE_NAME = "studyhub_session";
process.env.CSRF_COOKIE_NAME = "studyhub_csrf";
process.env.COOKIE_SECRET = "integration-cookie-secret-at-least-32-bytes";
process.env.CSRF_SECRET = "integration-csrf-secret-at-least-32-bytes";
process.env.SESSION_TTL_HOURS = "168";
process.env.MAX_UPLOAD_BYTES = "104857600";
process.env.USER_STORAGE_QUOTA_BYTES = "5368709120";
process.env.TEXT_PREVIEW_LIMIT_BYTES = "262144";
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

describe("auth integration", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let adminId: string;
  let courseId: string;
  let suffix: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL or TEST_DATABASE_URL is required for auth integration tests.");
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalFilters(new SafeErrorFilter());
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    suffix = randomUUID();
    const passwordHash = await argon2.hash("ChangeMe-Integration-12345", {
      type: argon2.argon2id
    });
    const admin = await prisma.user.create({
      data: {
        email: `admin-${suffix}@example.test`,
        displayName: "Integration Admin",
        passwordHash,
        role: "SYSTEM_ADMIN"
      }
    });
    adminId = admin.id;
    const semester = await prisma.semester.create({
      data: {
        name: `Integration ${suffix}`,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-30T00:00:00.000Z")
      }
    });
    const course = await prisma.course.create({
      data: {
        semesterId: semester.id,
        code: `T-${suffix.slice(0, 8)}`,
        title: "Integration Course"
      }
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("registers with a valid invitation, authenticates, and logs out", async () => {
    const invitationCode = `invite-${suffix}`;
    await prisma.invitation.create({
      data: {
        codeHash: hashSecret(invitationCode),
        scope: "COURSE",
        courseId,
        membershipRole: "MEMBER",
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        usageLimit: 1,
        createdById: adminId
      }
    });

    const agent = request.agent(server);
    const csrf = await agent.get("/api/auth/csrf").expect(200);
    const csrfToken = readCsrfToken(csrf.body);
    const register = await agent
      .post("/api/auth/register")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", csrfToken)
      .send({
        invitationCode,
        email: `student-${suffix}@example.test`,
        displayName: "Integration Student",
        password: "ChangeMe-Student-12345"
      })
      .expect(201);

    expect(setCookieHeader(register).join(";")).toContain("HttpOnly");
    const me = await agent.get("/api/auth/me").expect(200);
    const meBody = readRecord(me.body);
    expect(readRecord(meBody.user).email).toBe(`student-${suffix}@example.test`);
    if (!Array.isArray(meBody.memberships)) {
      throw new Error("Expected memberships array.");
    }
    expect(meBody.memberships).toHaveLength(1);

    const csrfAfterLogin = cookieValue(register, "studyhub_csrf");
    await agent
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", csrfAfterLogin)
      .expect(201);
    await agent.get("/api/auth/me").expect(401);
  });

  it("rejects invalid invitations and disabled users", async () => {
    const badAgent = request.agent(server);
    const badCsrf = await badAgent.get("/api/auth/csrf").expect(200);
    await badAgent
      .post("/api/auth/register")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readCsrfToken(badCsrf.body))
      .send({
        invitationCode: "missing-invite-code",
        email: `bad-${suffix}@example.test`,
        displayName: "Bad Invite",
        password: "ChangeMe-Student-12345"
      })
      .expect(403);

    const passwordHash = await argon2.hash("ChangeMe-Member-12345", {
      type: argon2.argon2id
    });
    const member = await prisma.user.create({
      data: {
        email: `member-${suffix}@example.test`,
        displayName: "Member",
        passwordHash,
        role: "MEMBER"
      }
    });

    const adminAgent = request.agent(server);
    const adminCsrf = await adminAgent.get("/api/auth/csrf").expect(200);
    const adminLogin = await adminAgent
      .post("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readCsrfToken(adminCsrf.body))
      .send({
        email: `admin-${suffix}@example.test`,
        password: "ChangeMe-Integration-12345"
      })
      .expect(201);

    await adminAgent
      .post(`/api/admin/users/${member.id}/disable`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", cookieValue(adminLogin, "studyhub_csrf"))
      .expect(201);

    const memberAgent = request.agent(server);
    const memberCsrf = await memberAgent.get("/api/auth/csrf").expect(200);
    await memberAgent
      .post("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readCsrfToken(memberCsrf.body))
      .send({
        email: `member-${suffix}@example.test`,
        password: "ChangeMe-Member-12345"
      })
      .expect(401);
  });
});

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Expected object response body.");
  }
  return value as Record<string, unknown>;
}

function readCsrfToken(value: unknown): string {
  const token = readRecord(value).csrfToken;
  if (typeof token !== "string") {
    throw new Error("Expected csrfToken in response body.");
  }
  return token;
}

function setCookieHeader(response: {
  headers: Record<string, string | string[] | undefined>;
}): string[] {
  const value = response.headers["set-cookie"];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function cookieValue(
  response: { headers: Record<string, string | string[] | undefined> },
  name: string
): string {
  const cookie = setCookieHeader(response).find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Expected ${name} cookie.`);
  }
  const pair = cookie.split(";")[0];
  if (!pair) {
    throw new Error(`Expected ${name} cookie pair.`);
  }
  const [, value] = pair.split("=");
  if (!value) {
    throw new Error(`Expected ${name} cookie value.`);
  }
  return decodeURIComponent(value);
}
