import cookieParser from "cookie-parser";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { AppModule } from "../src/app.module";
import { SafeErrorFilter } from "../src/common/safe-error.filter";
import { PrismaService } from "../src/common/prisma.service";

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

describe("admin integration", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let suffix: string;
  let adminId: string;
  let courseAdminId: string;
  let memberId: string;
  let courseAId: string;
  let courseBId: string;
  let resourceAId: string;
  let resourceBId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL or TEST_DATABASE_URL is required for integration tests.");
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
    const passwordHash = await argon2.hash("ChangeMe-Admin-12345", {
      type: argon2.argon2id
    });
    const [admin, courseAdmin, member] = await Promise.all([
      prisma.user.create({
        data: {
          email: `admin-${suffix}@example.test`,
          displayName: "Admin Test User",
          passwordHash,
          role: "SYSTEM_ADMIN"
        }
      }),
      prisma.user.create({
        data: {
          email: `course-admin-${suffix}@example.test`,
          displayName: "Scoped Admin",
          passwordHash
        }
      }),
      prisma.user.create({
        data: {
          email: `member-${suffix}@example.test`,
          displayName: "Plain Member",
          passwordHash
        }
      })
    ]);
    adminId = admin.id;
    courseAdminId = courseAdmin.id;
    memberId = member.id;

    const semester = await prisma.semester.create({
      data: {
        name: `Admin Integration ${suffix}`,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-30T00:00:00.000Z")
      }
    });
    const [courseA, courseB] = await Promise.all([
      prisma.course.create({
        data: {
          semesterId: semester.id,
          code: `AA-${suffix.slice(0, 8)}`,
          title: "Administered Course"
        }
      }),
      prisma.course.create({
        data: {
          semesterId: semester.id,
          code: `BB-${suffix.slice(0, 8)}`,
          title: "Other Course"
        }
      })
    ]);
    courseAId = courseA.id;
    courseBId = courseB.id;
    await prisma.courseMember.createMany({
      data: [
        { courseId: courseAId, userId: courseAdminId, role: "COURSE_ADMIN" },
        { courseId: courseAId, userId: memberId, role: "MEMBER" },
        { courseId: courseBId, userId: memberId, role: "MEMBER" }
      ]
    });
    resourceAId = await createResourceFixture(courseAId, memberId, "duplicate");
    resourceBId = await createResourceFixture(courseBId, memberId, "unique-other");
    await createResourceFixture(courseAId, courseAdminId, "duplicate");
    await prisma.auditLog.create({
      data: {
        actorId: courseAdminId,
        action: "COURSE_MEMBER_CHANGED",
        targetType: "course_member",
        targetId: memberId,
        courseId: courseAId,
        metadata: { role: "MEMBER" }
      }
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "COURSE_CREATED",
        targetType: "course",
        targetId: courseBId,
        courseId: courseBId
      }
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lets system administrators search users, disable accounts, and revoke sessions", async () => {
    const admin = await login(`admin-${suffix}@example.test`);
    const member = await login(`member-${suffix}@example.test`);

    const list = await admin.agent.get(`/api/admin/users?q=Plain&pageSize=5`).expect(200);
    const users = readArray(readRecord(list.body).users);
    const listed = users.find((user) => readRecord(user).id === memberId);
    if (!listed) throw new Error("Expected member in admin user search.");
    expect(readRecord(listed).activeSessionCount).toBeGreaterThanOrEqual(1);
    expect(readArray(readRecord(listed).memberships)).toHaveLength(2);

    await admin.agent
      .post(`/api/admin/users/${memberId}/disable`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({})
      .expect(201);
    await member.agent.get("/api/auth/me").expect(401);

    await admin.agent
      .post(`/api/admin/users/${memberId}/enable`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({})
      .expect(201);
    const memberAgain = await login(`member-${suffix}@example.test`);
    await admin.agent
      .post(`/api/admin/users/${memberId}/revoke-sessions`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({})
      .expect(201);
    await memberAgain.agent.get("/api/auth/me").expect(401);
  });

  it("does not let administrators disable system administrator accounts", async () => {
    const admin = await login(`admin-${suffix}@example.test`);

    await admin.agent
      .post(`/api/admin/users/${adminId}/disable`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({})
      .expect(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).disabledAt).toBeNull();
  });

  it("moderates resources globally and exposes duplicate inspection", async () => {
    const admin = await login(`admin-${suffix}@example.test`);
    const list = await admin.agent
      .get(`/api/admin/resources?q=AdminFixture&pageSize=10&status=all`)
      .expect(200);
    const resources = readArray(readRecord(list.body).resources);
    const administered = resources.find((resource) => readRecord(resource).id === resourceAId);
    if (!administered) throw new Error("Expected administered resource in admin list.");
    expect(readRecord(administered).duplicateCount).toBe(2);
    expect(resources.map((resource) => readRecord(resource).id)).toContain(resourceBId);

    await admin.agent
      .post(`/api/admin/resources/${resourceAId}/delete`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({})
      .expect(201);
    expect(
      (await prisma.resource.findUniqueOrThrow({ where: { id: resourceAId } })).deletedAt
    ).not.toBeNull();

    const deletedList = await admin.agent
      .get(`/api/admin/resources?status=deleted&pageSize=10`)
      .expect(200);
    expect(
      readArray(readRecord(deletedList.body).resources).map((item) => readRecord(item).id)
    ).toContain(resourceAId);

    await admin.agent
      .post(`/api/admin/resources/${resourceAId}/restore`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({})
      .expect(201);
    expect(
      (await prisma.resource.findUniqueOrThrow({ where: { id: resourceAId } })).deletedAt
    ).toBeNull();
  });

  it("scopes course administrators to their resources and audit records", async () => {
    const courseAdmin = await login(`course-admin-${suffix}@example.test`);
    const resources = await courseAdmin.agent
      .get(`/api/admin/resources?status=all&pageSize=20`)
      .expect(200);
    const resourceIds = readArray(readRecord(resources.body).resources).map(
      (item) => readRecord(item).id
    );
    expect(resourceIds).toContain(resourceAId);
    expect(resourceIds).not.toContain(resourceBId);

    await courseAdmin.agent
      .post(`/api/admin/resources/${resourceBId}/delete`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", courseAdmin.csrfToken)
      .send({})
      .expect(403);

    const audit = await courseAdmin.agent.get("/api/admin/audit?pageSize=20").expect(200);
    const courseIds = readArray(readRecord(audit.body).auditLogs).map(
      (entry) => readRecord(entry).courseId
    );
    expect(courseIds).toContain(courseAId);
    expect(courseIds).not.toContain(courseBId);
  });

  it("blocks ordinary members from administrative endpoints", async () => {
    const member = await login(`member-${suffix}@example.test`);
    await member.agent.get("/api/admin/users").expect(403);
    await member.agent.get("/api/admin/resources").expect(403);
    await member.agent.get("/api/admin/audit").expect(403);
  });

  async function createResourceFixture(
    courseId: string,
    uploaderId: string,
    contentKey: string
  ): Promise<string> {
    const category = await prisma.resourceCategory.upsert({
      where: { key: "NOTES" },
      update: { label: "Notes" },
      create: { key: "NOTES", label: "Notes", sortOrder: 1 }
    });
    const content = `AdminFixture ${contentKey}`;
    const resource = await prisma.resource.create({
      data: {
        courseId,
        categoryId: category.id,
        uploaderId,
        title: `AdminFixture ${contentKey}`,
        visibility: "COURSE_MEMBERS"
      }
    });
    const version = await prisma.resourceVersion.create({
      data: {
        resourceId: resource.id,
        versionNumber: 1,
        uploaderId,
        objectKey: `test/admin/${suffix}/${resource.id}`,
        originalFilename: `${contentKey}.md`,
        sizeBytes: BigInt(Buffer.byteLength(content)),
        mimeType: "text/markdown",
        sha256: createHash("sha256").update(content).digest("hex")
      }
    });
    await prisma.resource.update({
      where: { id: resource.id },
      data: { currentVersionId: version.id }
    });
    return resource.id;
  }

  async function login(email: string): Promise<LoginResult> {
    const agent = request.agent(server);
    const csrf = await agent.get("/api/auth/csrf").expect(200);
    const loginResponse = await agent
      .post("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readCsrfToken(csrf.body))
      .send({
        email,
        password: "ChangeMe-Admin-12345"
      })
      .expect(201);
    return { agent, csrfToken: cookieValue(loginResponse, "studyhub_csrf") };
  }
});

type LoginResult = {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
};

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Expected object response body.");
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected array response body.");
  }
  return value;
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
