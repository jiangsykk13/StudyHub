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

describe("course and invitation integration", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let suffix: string;
  let adminId: string;
  let courseAdminId: string;
  let memberId: string;
  let readonlyId: string;
  let courseAId: string;
  let courseBId: string;
  let semesterId: string;

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
    const passwordHash = await argon2.hash("ChangeMe-Course-12345", {
      type: argon2.argon2id
    });
    const [admin, courseAdmin, member, readonly] = await Promise.all([
      prisma.user.create({
        data: {
          email: `admin-${suffix}@example.test`,
          displayName: "Course Test Admin",
          passwordHash,
          role: "SYSTEM_ADMIN"
        }
      }),
      prisma.user.create({
        data: {
          email: `course-admin-${suffix}@example.test`,
          displayName: "Course Admin",
          passwordHash
        }
      }),
      prisma.user.create({
        data: {
          email: `member-${suffix}@example.test`,
          displayName: "Member",
          passwordHash
        }
      }),
      prisma.user.create({
        data: {
          email: `readonly-${suffix}@example.test`,
          displayName: "Read Only",
          passwordHash
        }
      })
    ]);
    adminId = admin.id;
    courseAdminId = courseAdmin.id;
    memberId = member.id;
    readonlyId = readonly.id;

    const semester = await prisma.semester.create({
      data: {
        name: `Course Integration ${suffix}`,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-30T00:00:00.000Z")
      }
    });
    semesterId = semester.id;
    const [courseA, courseB] = await Promise.all([
      prisma.course.create({
        data: {
          semesterId,
          code: `A-${suffix.slice(0, 8)}`,
          title: "Authorized Course"
        }
      }),
      prisma.course.create({
        data: {
          semesterId,
          code: `B-${suffix.slice(0, 8)}`,
          title: "Unrelated Course"
        }
      })
    ]);
    courseAId = courseA.id;
    courseBId = courseB.id;

    await prisma.courseMember.createMany({
      data: [
        { courseId: courseAId, userId: courseAdminId, role: "COURSE_ADMIN" },
        { courseId: courseAId, userId: memberId, role: "MEMBER" },
        { courseId: courseAId, userId: readonlyId, role: "READ_ONLY" }
      ]
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lets system administrators manage semesters and courses while members cannot", async () => {
    const admin = await login(`admin-${suffix}@example.test`);
    const createdSemester = await admin.agent
      .post("/api/semesters")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({
        name: `Created ${suffix}`,
        startsAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-12-31T00:00:00.000Z"
      })
      .expect(201);
    const createdSemesterId = readRecord(readRecord(createdSemester.body).semester).id;
    expect(typeof createdSemesterId).toBe("string");

    const createdCourse = await admin.agent
      .post("/api/courses")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({
        semesterId: createdSemesterId,
        code: "phys-200",
        title: "Physics Review",
        description: "Admin-created course"
      })
      .expect(201);
    expect(readRecord(readRecord(createdCourse.body).course).code).toBe("PHYS-200");

    const member = await login(`member-${suffix}@example.test`);
    await member.agent
      .post("/api/courses")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({
        semesterId,
        code: "DENY-1",
        title: "Denied Course"
      })
      .expect(403);

    const memberCourses = await member.agent.get("/api/courses").expect(200);
    const courses = readArray(readRecord(memberCourses.body).courses);
    expect(courses.map((course) => readRecord(course).id)).toContain(courseAId);
    expect(courses.map((course) => readRecord(course).id)).not.toContain(courseBId);
  });

  it("enforces course-admin scope for memberships and invitations", async () => {
    const courseAdmin = await login(`course-admin-${suffix}@example.test`);
    const invite = await courseAdmin.agent
      .post("/api/invitations")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", courseAdmin.csrfToken)
      .send({
        courseId: courseAId,
        membershipRole: "READ_ONLY",
        expiresAt: "2027-01-01T00:00:00.000Z",
        usageLimit: 2
      })
      .expect(201);
    expect(typeof readRecord(invite.body).code).toBe("string");

    const invitations = await courseAdmin.agent
      .get(`/api/invitations?courseId=${courseAId}`)
      .expect(200);
    expect(JSON.stringify(invitations.body)).not.toContain(readRecord(invite.body).code as string);
    expect(JSON.stringify(invitations.body)).not.toContain("codeHash");

    await courseAdmin.agent
      .post("/api/invitations")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", courseAdmin.csrfToken)
      .send({
        courseId: courseBId,
        membershipRole: "MEMBER",
        expiresAt: "2027-01-01T00:00:00.000Z",
        usageLimit: 1
      })
      .expect(403);

    await courseAdmin.agent
      .post("/api/invitations")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", courseAdmin.csrfToken)
      .send({
        membershipRole: "MEMBER",
        expiresAt: "2027-01-01T00:00:00.000Z",
        usageLimit: 1
      })
      .expect(403);

    await courseAdmin.agent
      .patch(`/api/courses/${courseAId}/members/${memberId}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", courseAdmin.csrfToken)
      .send({ role: "READ_ONLY" })
      .expect(200);
    await expectMembershipRole(courseAId, memberId, "READ_ONLY");

    await courseAdmin.agent
      .patch(`/api/courses/${courseBId}/members/${memberId}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", courseAdmin.csrfToken)
      .send({ role: "MEMBER" })
      .expect(403);

    const readonly = await login(`readonly-${suffix}@example.test`);
    await readonly.agent
      .post("/api/invitations")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readonly.csrfToken)
      .send({
        courseId: courseAId,
        membershipRole: "MEMBER",
        expiresAt: "2027-01-01T00:00:00.000Z",
        usageLimit: 1
      })
      .expect(403);
  });

  it("stores invitation codes only as hashes and respects expiry, revocation, and usage", async () => {
    const admin = await login(`admin-${suffix}@example.test`);
    const created = await admin.agent
      .post("/api/invitations")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", admin.csrfToken)
      .send({
        courseId: courseAId,
        membershipRole: "READ_ONLY",
        expiresAt: "2027-01-01T00:00:00.000Z",
        usageLimit: 1
      })
      .expect(201);
    const code = readRecord(created.body).code;
    if (typeof code !== "string") throw new Error("Expected one-time invitation code.");
    const invitation = readRecord(readRecord(created.body).invitation);
    const invitationId = invitation.id;
    if (typeof invitationId !== "string") throw new Error("Expected invitation id.");

    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(stored.codeHash).toBe(hashSecret(code));
    expect(stored.codeHash).not.toBe(code);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "INVITATION_CREATED", targetId: invitationId }
    });
    expect(JSON.stringify(audit.metadata)).not.toContain(code);

    await registerWithCode(code, `invited-${suffix}@example.test`, 201);
    await expectMembershipRole(
      courseAId,
      await userIdFor(`invited-${suffix}@example.test`),
      "READ_ONLY"
    );
    await registerWithCode(code, `second-${suffix}@example.test`, 403);

    const expiredCode = `expired-${suffix}`;
    const revokedCode = `revoked-${suffix}`;
    await prisma.invitation.createMany({
      data: [
        {
          codeHash: hashSecret(expiredCode),
          scope: "COURSE",
          courseId: courseAId,
          membershipRole: "MEMBER",
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
          usageLimit: 1,
          createdById: adminId
        },
        {
          codeHash: hashSecret(revokedCode),
          scope: "COURSE",
          courseId: courseAId,
          membershipRole: "MEMBER",
          expiresAt: new Date("2027-01-01T00:00:00.000Z"),
          usageLimit: 1,
          revokedAt: new Date(),
          createdById: adminId
        }
      ]
    });
    await registerWithCode(expiredCode, `expired-${suffix}@example.test`, 403);
    await registerWithCode(revokedCode, `revoked-${suffix}@example.test`, 403);
  });

  async function login(
    email: string
  ): Promise<{ agent: ReturnType<typeof request.agent>; csrfToken: string }> {
    const agent = request.agent(server);
    const csrf = await agent.get("/api/auth/csrf").expect(200);
    const loginResponse = await agent
      .post("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readCsrfToken(csrf.body))
      .send({
        email,
        password: "ChangeMe-Course-12345"
      })
      .expect(201);
    return { agent, csrfToken: cookieValue(loginResponse, "studyhub_csrf") };
  }

  async function registerWithCode(
    code: string,
    email: string,
    expectedStatus: number
  ): Promise<void> {
    const agent = request.agent(server);
    const csrf = await agent.get("/api/auth/csrf").expect(200);
    await agent
      .post("/api/auth/register")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readCsrfToken(csrf.body))
      .send({
        invitationCode: code,
        email,
        displayName: "Invited Student",
        password: "ChangeMe-Invited-12345"
      })
      .expect(expectedStatus);
  }

  async function expectMembershipRole(
    courseId: string,
    userId: string,
    role: "COURSE_ADMIN" | "MEMBER" | "READ_ONLY"
  ): Promise<void> {
    const membership = await prisma.courseMember.findUniqueOrThrow({
      where: { courseId_userId: { courseId, userId } }
    });
    expect(membership.role).toBe(role);
  }

  async function userIdFor(email: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return user.id;
  }
});

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
