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

describe("notes and favorites integration", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let suffix: string;
  let memberId: string;
  let readonlyId: string;
  let courseId: string;
  let resourceId: string;

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
    const passwordHash = await argon2.hash("ChangeMe-Notes-12345", {
      type: argon2.argon2id
    });
    const [member, readonly] = await Promise.all([
      prisma.user.create({
        data: {
          email: `note-member-${suffix}@example.test`,
          displayName: "Note Member",
          passwordHash
        }
      }),
      prisma.user.create({
        data: {
          email: `note-readonly-${suffix}@example.test`,
          displayName: "Note Readonly",
          passwordHash
        }
      })
    ]);
    memberId = member.id;
    readonlyId = readonly.id;
    const semester = await prisma.semester.create({
      data: {
        name: `Note Integration ${suffix}`,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-30T00:00:00.000Z")
      }
    });
    const course = await prisma.course.create({
      data: {
        semesterId: semester.id,
        code: `N-${suffix.slice(0, 8)}`,
        title: "Note Course"
      }
    });
    courseId = course.id;
    await prisma.courseMember.createMany({
      data: [
        { courseId, userId: memberId, role: "MEMBER" },
        { courseId, userId: readonlyId, role: "READ_ONLY" }
      ]
    });
    resourceId = await createResourceFixture();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("drafts, publishes, sanitizes, restores revisions, and deduplicates favorites", async () => {
    const member = await login(`note-member-${suffix}@example.test`);
    const readonly = await login(`note-readonly-${suffix}@example.test`);

    await readonly.agent
      .post("/api/notes")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readonly.csrfToken)
      .send({
        courseId,
        title: "Readonly draft",
        draftContent: "# Denied",
        visibility: "COURSE_MEMBERS"
      })
      .expect(403);

    const created = await member.agent
      .post("/api/notes")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({
        courseId,
        title: "Integration note",
        draftContent: "# Draft\n\n<script>alert(1)</script>",
        visibility: "COURSE_MEMBERS"
      })
      .expect(201);
    const noteId = readString(readRecord(readRecord(created.body).note).id);

    await readonly.agent.get(`/api/notes/${noteId}`).expect(404);

    const firstContent = [
      "# Published",
      "",
      "```ts",
      "const answer: number = 42;",
      "```",
      "",
      "$x^2$",
      "",
      "```mermaid",
      "graph TD",
      "A-->B",
      "```",
      "",
      '<script>alert("x")</script>',
      "[bad](javascript:alert(1))"
    ].join("\n");
    const firstPublish = await publish(member, noteId, firstContent).expect(200);
    const firstNote = readRecord(readRecord(firstPublish.body).note);
    const firstRevisionId = readString(readRecord(readArray(firstNote.revisions)[0]).id);
    expect(firstNote.publishedAt).not.toBeNull();
    expect(firstNote.draftContent).toBe(firstContent);
    const rendered = readRecord(firstNote.rendered);
    const html = readString(rendered.html);
    expect(html).toContain("Published");
    expect(html).toContain("hljs");
    expect(html).toContain("katex");
    expect(html).toContain("mermaid");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(readArray(rendered.toc).map((item) => readRecord(item).text)).toContain("Published");

    const readonlyDetail = await readonly.agent.get(`/api/notes/${noteId}`).expect(200);
    const readonlyNote = readRecord(readRecord(readonlyDetail.body).note);
    expect(readonlyNote.draftContent).toBeNull();
    expect(readonlyNote.canEdit).toBe(false);

    await readonly.agent
      .patch(`/api/notes/${noteId}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", readonly.csrfToken)
      .send({ draftContent: "# Should fail" })
      .expect(403);

    const revisedContent = "# Revised\n\nPublished update.";
    const secondPublish = await publish(member, noteId, revisedContent).expect(200);
    expect(readArray(readRecord(readRecord(secondPublish.body).note).revisions)).toHaveLength(2);

    const restored = await member.agent
      .post(`/api/notes/${noteId}/revisions/${firstRevisionId}/restore`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({})
      .expect(201);
    const restoredNote = readRecord(readRecord(restored.body).note);
    expect(restoredNote.publishedContent).toBe(firstContent);
    expect(readArray(restoredNote.revisions)).toHaveLength(3);
    const restoreAuditCount = await prisma.auditLog.count({
      where: { action: "NOTE_REVISION_RESTORED", targetId: noteId }
    });
    expect(restoreAuditCount).toBe(1);

    await addFavorite(member, { targetType: "NOTE", noteId }).expect(201);
    await addFavorite(member, { targetType: "NOTE", noteId }).expect(201);
    await addFavorite(member, { targetType: "RESOURCE", resourceId }).expect(201);
    await addFavorite(member, { targetType: "RESOURCE", resourceId }).expect(201);

    expect(
      await prisma.favorite.count({
        where: { userId: memberId, targetType: "NOTE", noteId }
      })
    ).toBe(1);
    expect(
      await prisma.favorite.count({
        where: { userId: memberId, targetType: "RESOURCE", resourceId }
      })
    ).toBe(1);

    const favorites = await member.agent.get("/api/favorites").expect(200);
    const favoriteItems = readArray(readRecord(favorites.body).favorites);
    expect(favoriteItems).toHaveLength(2);
    expect(favoriteItems.map((item) => readRecord(item).targetType).sort()).toEqual([
      "NOTE",
      "RESOURCE"
    ]);

    await member.agent
      .post("/api/favorites/remove")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({ targetType: "NOTE", noteId })
      .expect(201);
    expect(
      await prisma.favorite.count({
        where: { userId: memberId, targetType: "NOTE", noteId }
      })
    ).toBe(0);
  });

  it("enforces private and all-member note visibility", async () => {
    const member = await login(`note-member-${suffix}@example.test`);
    const readonly = await login(`note-readonly-${suffix}@example.test`);
    const outsider = await createAndLoginUser("outsider");

    const privateNote = await member.agent
      .post("/api/notes")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({
        courseId,
        title: "Private note",
        draftContent: "# Private",
        visibility: "PRIVATE"
      })
      .expect(201);
    const privateNoteId = readString(readRecord(readRecord(privateNote.body).note).id);
    await publish(member, privateNoteId, "# Private published").expect(200);
    await readonly.agent.get(`/api/notes/${privateNoteId}`).expect(404);
    await outsider.agent.get(`/api/notes/${privateNoteId}`).expect(404);

    const allMemberNote = await member.agent
      .post("/api/notes")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", member.csrfToken)
      .send({
        courseId,
        title: "All member note",
        draftContent: "# Shared",
        visibility: "ALL_MEMBERS"
      })
      .expect(201);
    const allMemberNoteId = readString(readRecord(readRecord(allMemberNote.body).note).id);
    await publish(member, allMemberNoteId, "# Shared with authenticated members").expect(200);
    await outsider.agent.get(`/api/notes/${allMemberNoteId}`).expect(200);
  });

  async function createResourceFixture(): Promise<string> {
    const category = await prisma.resourceCategory.upsert({
      where: { key: "NOTES" },
      update: { label: "Notes" },
      create: { key: "NOTES", label: "Notes", sortOrder: 1 }
    });
    const content = `resource favorite ${suffix}`;
    const resource = await prisma.resource.create({
      data: {
        courseId,
        categoryId: category.id,
        uploaderId: memberId,
        title: "Favorite resource",
        visibility: "COURSE_MEMBERS"
      }
    });
    const version = await prisma.resourceVersion.create({
      data: {
        resourceId: resource.id,
        versionNumber: 1,
        uploaderId: memberId,
        objectKey: `test/resources/${suffix}`,
        originalFilename: "favorite.md",
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

  async function createAndLoginUser(prefix: string): Promise<LoginResult> {
    const passwordHash = await argon2.hash("ChangeMe-Notes-12345", {
      type: argon2.argon2id
    });
    await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}@example.test`,
        displayName: `${prefix} user`,
        passwordHash
      }
    });
    return login(`${prefix}-${suffix}@example.test`);
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
        password: "ChangeMe-Notes-12345"
      })
      .expect(201);
    return { agent, csrfToken: cookieValue(loginResponse, "studyhub_csrf") };
  }

  function publish(loginResult: LoginResult, noteId: string, content: string): request.Test {
    return loginResult.agent
      .patch(`/api/notes/${noteId}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", loginResult.csrfToken)
      .send({
        draftContent: content,
        publishedContent: content,
        publish: true
      });
  }

  function addFavorite(
    loginResult: LoginResult,
    input: { targetType: "RESOURCE"; resourceId: string } | { targetType: "NOTE"; noteId: string }
  ): request.Test {
    return loginResult.agent
      .post("/api/favorites")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", loginResult.csrfToken)
      .send(input);
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

function readString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected string response value.");
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
