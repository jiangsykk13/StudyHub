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
process.env.MAX_UPLOAD_BYTES = "256";
process.env.USER_STORAGE_QUOTA_BYTES = "180";
process.env.TEXT_PREVIEW_LIMIT_BYTES = "262144";
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

describe("resource integration", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let suffix: string;
  let memberId: string;
  let readonlyId: string;
  let courseId: string;

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
    const passwordHash = await argon2.hash("ChangeMe-Resources-12345", {
      type: argon2.argon2id
    });
    await prisma.resourceCategory.upsert({
      where: { key: "NOTES" },
      update: { label: "Notes" },
      create: { key: "NOTES", label: "Notes", sortOrder: 1 }
    });
    const [member, readonly] = await Promise.all([
      prisma.user.create({
        data: {
          email: `resource-member-${suffix}@example.test`,
          displayName: "Resource Member",
          passwordHash
        }
      }),
      prisma.user.create({
        data: {
          email: `resource-readonly-${suffix}@example.test`,
          displayName: "Resource Readonly",
          passwordHash
        }
      })
    ]);
    memberId = member.id;
    readonlyId = readonly.id;
    const semester = await prisma.semester.create({
      data: {
        name: `Resource Integration ${suffix}`,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-30T00:00:00.000Z")
      }
    });
    const course = await prisma.course.create({
      data: {
        semesterId: semester.id,
        code: `R-${suffix.slice(0, 8)}`,
        title: "Resource Course"
      }
    });
    courseId = course.id;
    await prisma.courseMember.createMany({
      data: [
        { courseId, userId: memberId, role: "MEMBER" },
        { courseId, userId: readonlyId, role: "READ_ONLY" }
      ]
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("uploads, downloads with authorization, and preserves immutable versions", async () => {
    const member = await login(`resource-member-${suffix}@example.test`);
    const upload = await uploadResource(member, {
      title: "Limits upload",
      filename: "limits.md",
      content: Buffer.from("# Limits\n\nA safe uploaded note.\n")
    }).expect(201);

    const resource = readRecord(readRecord(upload.body).resource);
    const resourceId = resource.id;
    if (typeof resourceId !== "string") throw new Error("Expected resource id.");
    const currentVersion = readRecord(resource.currentVersion);
    expect(currentVersion.originalFilename).toBe("limits.md");
    expect(currentVersion.versionNumber).toBe(1);

    const stored = await prisma.resource.findUniqueOrThrow({
      where: { id: resourceId },
      include: { currentVersion: true, versions: true }
    });
    if (!stored.currentVersion) throw new Error("Expected current resource version.");
    expect(stored.currentVersion.objectKey).not.toContain("limits.md");
    const unsigned = await fetch(
      `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${stored.currentVersion.objectKey}`
    );
    expect(unsigned.status).toBe(403);

    const download = await member.agent
      .post(`/api/resources/${resourceId}/download`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({})
      .expect(201);
    const downloadBody = readRecord(readRecord(download.body).download);
    if (typeof downloadBody.url !== "string") throw new Error("Expected signed download URL.");
    expect(downloadBody.expiresInSeconds).toBe(300);
    const signed = await fetch(downloadBody.url);
    expect(signed.status).toBe(200);
    expect(await signed.text()).toContain("safe uploaded note");

    const version = await uploadVersion(member, resourceId, {
      filename: "limits-v2.md",
      content: Buffer.from("# Limits\n\nUpdated version.\n")
    }).expect(201);
    const updatedResource = readRecord(readRecord(version.body).resource);
    expect(readRecord(updatedResource.currentVersion).versionNumber).toBe(2);
    const versions = await prisma.resourceVersion.findMany({
      where: { resourceId },
      orderBy: { versionNumber: "asc" }
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.objectKey).not.toBe(versions[1]?.objectKey);
  });

  it("blocks read-only, executable, oversized, duplicate, and over-quota uploads", async () => {
    const readonly = await login(`resource-readonly-${suffix}@example.test`);
    await uploadResource(readonly, {
      title: "Readonly upload",
      filename: "readonly.md",
      content: Buffer.from("# Denied\n")
    }).expect(403);

    const member = await login(`resource-member-${suffix}@example.test`);
    await uploadResource(member, {
      title: "Executable upload",
      filename: "tool.exe",
      content: Buffer.from("MZ")
    }).expect(400);

    await uploadResource(member, {
      title: "Oversized upload",
      filename: "large.md",
      content: Buffer.from(`# Large\n${"x".repeat(300)}\n`)
    }).expect(413);

    const duplicateContent = Buffer.from("# Duplicate\nsame content\n");
    await uploadResource(member, {
      title: "Duplicate one",
      filename: "dup-one.md",
      content: duplicateContent
    }).expect(201);
    await uploadResource(member, {
      title: "Duplicate two",
      filename: "dup-two.md",
      content: duplicateContent
    }).expect(409);

    const otherMember = await createAndLoginMember("quota");
    await uploadResource(otherMember, {
      title: "Quota one",
      filename: "quota-one.md",
      content: Buffer.from(`# Quota\n${"a".repeat(100)}\n`)
    }).expect(201);
    await uploadResource(otherMember, {
      title: "Quota two",
      filename: "quota-two.md",
      content: Buffer.from(`# Quota\n${"b".repeat(90)}\n`)
    }).expect(403);
  });

  it("searches visible metadata and returns safe preview states", async () => {
    const member = await login(`resource-member-${suffix}@example.test`);
    const previewToken = randomUUID().slice(0, 8);
    const markdown = await uploadResource(member, {
      title: `Preview Safe ${previewToken}`,
      filename: `preview-${previewToken}.md`,
      content: Buffer.from("# Safe\n<script>x</script>\n[bad](javascript:alert(1))\n")
    }).expect(201);
    const markdownId = readResourceId(markdown.body);

    const image = await uploadResource(member, {
      title: "Diagram Preview",
      filename: "diagram.png",
      content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    }).expect(201);
    const imageId = readResourceId(image.body);

    const archive = await uploadResource(member, {
      title: "Archive Preview",
      filename: "archive.zip",
      content: Buffer.from([0x50, 0x4b, 0x03, 0x04])
    }).expect(201);
    const archiveId = readResourceId(archive.body);

    const search = await member.agent
      .get(`/api/resources?q=${previewToken}&page=1&pageSize=1`)
      .expect(200);
    expect(readRecord(search.body).total).toBeGreaterThanOrEqual(1);
    expect(
      readArray(readRecord(search.body).resources).map((item) => readRecord(item).id)
    ).toContain(markdownId);

    const tagFilter = await member.agent.get("/api/resources?tag=integration").expect(200);
    expect(
      readArray(readRecord(tagFilter.body).resources).map((item) => readRecord(item).id)
    ).toContain(markdownId);

    const markdownPreview = await member.agent
      .get(`/api/resources/${markdownId}/preview`)
      .expect(200);
    const markdownBody = readRecord(readRecord(markdownPreview.body).preview);
    expect(markdownBody.kind).toBe("markdown");
    expect(markdownBody.html).toContain("Safe");
    expect(markdownBody.html).not.toContain("<script");
    expect(markdownBody.html).not.toContain("javascript:");

    const imagePreview = await member.agent.get(`/api/resources/${imageId}/preview`).expect(200);
    const imageBody = readRecord(readRecord(imagePreview.body).preview);
    expect(imageBody.kind).toBe("image");
    expect(typeof imageBody.url).toBe("string");

    const archivePreview = await member.agent
      .get(`/api/resources/${archiveId}/preview`)
      .expect(200);
    expect(readRecord(readRecord(archivePreview.body).preview).kind).toBe("unsupported");

    const outsider = await createAndLoginMember("outsider");
    await prisma.courseMember.delete({
      where: {
        courseId_userId: {
          courseId,
          userId: await userIdFor(`outsider-${suffix}@example.test`)
        }
      }
    });
    await outsider.agent.get(`/api/resources/${markdownId}/preview`).expect(404);
  });

  async function createAndLoginMember(prefix: string): Promise<LoginResult> {
    const passwordHash = await argon2.hash("ChangeMe-Resources-12345", {
      type: argon2.argon2id
    });
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}@example.test`,
        displayName: `${prefix} user`,
        passwordHash
      }
    });
    await prisma.courseMember.create({
      data: { courseId, userId: user.id, role: "MEMBER" }
    });
    return login(`${prefix}-${suffix}@example.test`);
  }

  async function userIdFor(email: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return user.id;
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
        password: "ChangeMe-Resources-12345"
      })
      .expect(201);
    return { agent, csrfToken: cookieValue(loginResponse, "studyhub_csrf") };
  }

  function uploadResource(
    loginResult: LoginResult,
    input: { title: string; filename: string; content: Buffer }
  ): request.Test {
    return loginResult.agent
      .post("/api/resources")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", loginResult.csrfToken)
      .field("title", input.title)
      .field("courseId", courseId)
      .field("categoryKey", "NOTES")
      .field("visibility", "COURSE_MEMBERS")
      .field("tags", "upload, integration")
      .attach("file", input.content, {
        filename: input.filename,
        contentType: "text/markdown"
      });
  }

  function uploadVersion(
    loginResult: LoginResult,
    resourceId: string,
    input: { filename: string; content: Buffer }
  ): request.Test {
    return loginResult.agent
      .post(`/api/resources/${resourceId}/versions`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", loginResult.csrfToken)
      .attach("file", input.content, {
        filename: input.filename,
        contentType: "text/markdown"
      });
  }
});

type LoginResult = {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
};

function readResourceId(body: unknown): string {
  const id = readRecord(readRecord(body).resource).id;
  if (typeof id !== "string") {
    throw new Error("Expected resource id.");
  }
  return id;
}

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
