import { PrismaClient } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import argon2 from "argon2";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

const s3Client =
  process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? "us-east-1",
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        }
      })
    : null;

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const categories = [
  ["LECTURE_SLIDES", "Lecture slides"],
  ["NOTES", "Notes"],
  ["REFERENCES", "References"],
  ["ASSIGNMENTS", "Assignments"],
  ["LABS", "Labs"],
  ["PAST_EXAMS", "Past exams"],
  ["PROJECT_CODE", "Project code"],
  ["REVIEW_SUMMARIES", "Review summaries"],
  ["OTHER", "Other"]
] as const;

async function upsertUser(input: {
  email: string;
  displayName: string;
  password: string;
  role?: "SYSTEM_ADMIN" | "MEMBER";
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      displayName: input.displayName,
      role: input.role ?? "MEMBER",
      disabledAt: null
    },
    create: {
      email: input.email,
      displayName: input.displayName,
      passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      role: input.role ?? "MEMBER"
    }
  });
}

async function main(): Promise<void> {
  const admin = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test",
    displayName: "System Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Admin-DevOnly-12345",
    role: "SYSTEM_ADMIN"
  });
  const member = await upsertUser({
    email: process.env.SEED_MEMBER_EMAIL ?? "member@example.test",
    displayName: "Member Student",
    password: process.env.SEED_MEMBER_PASSWORD ?? "ChangeMe-Member-DevOnly-12345"
  });
  const readonly = await upsertUser({
    email: process.env.SEED_READONLY_EMAIL ?? "readonly@example.test",
    displayName: "Read Only Student",
    password: process.env.SEED_READONLY_PASSWORD ?? "ChangeMe-Readonly-DevOnly-12345"
  });
  const courseAdmin = await upsertUser({
    email: process.env.SEED_COURSE_ADMIN_EMAIL ?? "course-admin@example.test",
    displayName: "Course Admin",
    password: process.env.SEED_COURSE_ADMIN_PASSWORD ?? "ChangeMe-CourseAdmin-DevOnly-12345"
  });

  const semester = await prisma.semester.upsert({
    where: { name: "2026 Spring" },
    update: {},
    create: {
      name: "2026 Spring",
      startsAt: new Date("2026-02-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-30T23:59:59.000Z")
    }
  });

  const math = await prisma.course.upsert({
    where: { semesterId_code: { semesterId: semester.id, code: "MATH101" } },
    update: { title: "Calculus I", description: "Seed course for private material sharing." },
    create: {
      semesterId: semester.id,
      code: "MATH101",
      title: "Calculus I",
      description: "Seed course for private material sharing."
    }
  });

  const cs = await prisma.course.upsert({
    where: { semesterId_code: { semesterId: semester.id, code: "CS102" } },
    update: { title: "Intro Programming", description: "Seed programming course." },
    create: {
      semesterId: semester.id,
      code: "CS102",
      title: "Intro Programming",
      description: "Seed programming course."
    }
  });

  for (const [key, label] of categories) {
    await prisma.resourceCategory.upsert({
      where: { key },
      update: { label },
      create: { key, label, sortOrder: categories.findIndex((entry) => entry[0] === key) }
    });
  }

  await prisma.courseMember.upsert({
    where: { courseId_userId: { courseId: math.id, userId: member.id } },
    update: { role: "MEMBER" },
    create: { courseId: math.id, userId: member.id, role: "MEMBER" }
  });
  await prisma.courseMember.upsert({
    where: { courseId_userId: { courseId: math.id, userId: readonly.id } },
    update: { role: "READ_ONLY" },
    create: { courseId: math.id, userId: readonly.id, role: "READ_ONLY" }
  });
  await prisma.courseMember.upsert({
    where: { courseId_userId: { courseId: math.id, userId: courseAdmin.id } },
    update: { role: "COURSE_ADMIN" },
    create: { courseId: math.id, userId: courseAdmin.id, role: "COURSE_ADMIN" }
  });
  await prisma.courseMember.upsert({
    where: { courseId_userId: { courseId: cs.id, userId: member.id } },
    update: { role: "MEMBER" },
    create: { courseId: cs.id, userId: member.id, role: "MEMBER" }
  });

  const notesCategory = await prisma.resourceCategory.findUniqueOrThrow({
    where: { key: "NOTES" }
  });
  const tagNames = ["week-1", "calculus", "review"];
  const tags = await Promise.all(
    tagNames.map((name) => prisma.tag.upsert({ where: { name }, update: {}, create: { name } }))
  );

  const seedContent =
    "# Limits review\n\nThis harmless seed fixture represents a Markdown resource.\n";
  const seedHash = hashToken(seedContent);
  const resource = await prisma.resource.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {
      title: "Limits review notes",
      description: "Generated harmless Markdown fixture."
    },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      courseId: math.id,
      categoryId: notesCategory.id,
      uploaderId: member.id,
      title: "Limits review notes",
      description: "Generated harmless Markdown fixture.",
      visibility: "COURSE_MEMBERS"
    }
  });

  const version = await prisma.resourceVersion.upsert({
    where: { objectKey: "seed/resources/limits-review.md" },
    update: {
      originalFilename: "limits-review.md",
      sizeBytes: BigInt(Buffer.byteLength(seedContent)),
      mimeType: "text/markdown",
      sha256: seedHash
    },
    create: {
      resourceId: resource.id,
      versionNumber: 1,
      uploaderId: member.id,
      objectKey: "seed/resources/limits-review.md",
      originalFilename: "limits-review.md",
      sizeBytes: BigInt(Buffer.byteLength(seedContent)),
      mimeType: "text/markdown",
      sha256: seedHash
    }
  });
  await prisma.resource.update({
    where: { id: resource.id },
    data: { currentVersionId: version.id }
  });
  if (s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "studyhub-private",
        Key: version.objectKey,
        Body: Buffer.from(seedContent, "utf8"),
        ContentType: version.mimeType
      })
    );
  }
  for (const tag of tags) {
    await prisma.resourceTag.upsert({
      where: { resourceId_tagId: { resourceId: resource.id, tagId: tag.id } },
      update: {},
      create: { resourceId: resource.id, tagId: tag.id }
    });
  }

  const note = await prisma.note.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {
      title: "Week 1 study note",
      draftContent: "# Week 1\n\nDraft autosave seed content.",
      publishedContent: "# Week 1\n\nPublished safe Markdown with `code` and math $x^2$.",
      publishedAt: new Date("2026-02-10T12:00:00.000Z")
    },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      courseId: math.id,
      authorId: member.id,
      title: "Week 1 study note",
      draftContent: "# Week 1\n\nDraft autosave seed content.",
      publishedContent: "# Week 1\n\nPublished safe Markdown with `code` and math $x^2$.",
      publishedAt: new Date("2026-02-10T12:00:00.000Z"),
      visibility: "COURSE_MEMBERS"
    }
  });

  await prisma.noteRevision.upsert({
    where: { id: "00000000-0000-4000-8000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000003",
      noteId: note.id,
      authorId: member.id,
      title: note.title,
      content: note.publishedContent ?? "",
      createdAt: note.publishedAt ?? new Date()
    }
  });

  const invitationCode = process.env.SEED_INVITATION_CODE ?? "DEV-INVITE-STUDYHUB-ONLY";
  await prisma.invitation.upsert({
    where: { codeHash: hashToken(invitationCode) },
    update: {
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      usageLimit: 25,
      revokedAt: null
    },
    create: {
      codeHash: hashToken(invitationCode),
      scope: "COURSE",
      courseId: math.id,
      membershipRole: "MEMBER",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      usageLimit: 25,
      createdById: admin.id
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "COURSE_CREATED",
      targetType: "seed",
      targetId: math.id,
      courseId: math.id,
      metadata: { seed: true }
    }
  });

  console.log("Seed complete. Accounts are configured from .env seed variables.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
