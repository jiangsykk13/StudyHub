CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'MEMBER');
CREATE TYPE "CourseMemberRole" AS ENUM ('COURSE_ADMIN', 'MEMBER', 'READ_ONLY');
CREATE TYPE "InvitationScope" AS ENUM ('ALL_SITE', 'COURSE');
CREATE TYPE "ResourceVisibility" AS ENUM ('COURSE_MEMBERS', 'ALL_MEMBERS', 'PRIVATE');
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'COURSE_MEMBERS', 'ALL_MEMBERS');
CREATE TYPE "FavoriteTargetType" AS ENUM ('RESOURCE', 'NOTE');
CREATE TYPE "AuditAction" AS ENUM ('USER_DISABLED', 'USER_ENABLED', 'USER_SESSIONS_REVOKED', 'USER_ROLE_CHANGED', 'COURSE_CREATED', 'COURSE_UPDATED', 'COURSE_ARCHIVED', 'COURSE_MEMBER_CHANGED', 'INVITATION_CREATED', 'INVITATION_REVOKED', 'RESOURCE_CREATED', 'RESOURCE_VERSION_CREATED', 'RESOURCE_DELETED', 'RESOURCE_RESTORED', 'NOTE_CREATED', 'NOTE_UPDATED', 'NOTE_DELETED', 'NOTE_REVISION_RESTORED');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "csrfTokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Semester" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Course" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "semesterId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseMember" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "courseId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "CourseMemberRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "codeHash" TEXT NOT NULL,
  "scope" "InvitationScope" NOT NULL,
  "courseId" UUID,
  "membershipRole" "CourseMemberRole" NOT NULL DEFAULT 'MEMBER',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usageLimit" INTEGER NOT NULL,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceCategory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ResourceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resource" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "courseId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "uploaderId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "visibility" "ResourceVisibility" NOT NULL DEFAULT 'COURSE_MEMBERS',
  "currentVersionId" UUID,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resourceId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "uploaderId" UUID NOT NULL,
  "objectKey" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceTag" (
  "resourceId" UUID NOT NULL,
  "tagId" UUID NOT NULL,
  CONSTRAINT "ResourceTag_pkey" PRIMARY KEY ("resourceId","tagId")
);

CREATE TABLE "Note" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "courseId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "draftContent" TEXT NOT NULL DEFAULT '',
  "publishedContent" TEXT,
  "visibility" "NoteVisibility" NOT NULL DEFAULT 'COURSE_MEMBERS',
  "publishedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "noteId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoteRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Favorite" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "targetType" "FavoriteTargetType" NOT NULL,
  "resourceId" UUID,
  "noteId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DownloadRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "resourceVersionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DownloadRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorId" UUID,
  "action" "AuditAction" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "courseId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");
CREATE UNIQUE INDEX "Semester_name_key" ON "Semester"("name");
CREATE INDEX "Semester_archivedAt_idx" ON "Semester"("archivedAt");
CREATE UNIQUE INDEX "Course_semesterId_code_key" ON "Course"("semesterId","code");
CREATE INDEX "Course_semesterId_idx" ON "Course"("semesterId");
CREATE INDEX "Course_archivedAt_idx" ON "Course"("archivedAt");
CREATE UNIQUE INDEX "CourseMember_courseId_userId_key" ON "CourseMember"("courseId","userId");
CREATE INDEX "CourseMember_courseId_idx" ON "CourseMember"("courseId");
CREATE INDEX "CourseMember_userId_idx" ON "CourseMember"("userId");
CREATE INDEX "CourseMember_role_idx" ON "CourseMember"("role");
CREATE UNIQUE INDEX "Invitation_codeHash_key" ON "Invitation"("codeHash");
CREATE INDEX "Invitation_codeHash_idx" ON "Invitation"("codeHash");
CREATE INDEX "Invitation_courseId_idx" ON "Invitation"("courseId");
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");
CREATE INDEX "Invitation_revokedAt_idx" ON "Invitation"("revokedAt");
CREATE UNIQUE INDEX "ResourceCategory_key_key" ON "ResourceCategory"("key");
CREATE UNIQUE INDEX "Resource_currentVersionId_key" ON "Resource"("currentVersionId");
CREATE INDEX "Resource_courseId_createdAt_idx" ON "Resource"("courseId","createdAt");
CREATE INDEX "Resource_uploaderId_idx" ON "Resource"("uploaderId");
CREATE INDEX "Resource_categoryId_idx" ON "Resource"("categoryId");
CREATE INDEX "Resource_visibility_idx" ON "Resource"("visibility");
CREATE INDEX "Resource_deletedAt_idx" ON "Resource"("deletedAt");
CREATE UNIQUE INDEX "ResourceVersion_objectKey_key" ON "ResourceVersion"("objectKey");
CREATE UNIQUE INDEX "ResourceVersion_resourceId_versionNumber_key" ON "ResourceVersion"("resourceId","versionNumber");
CREATE INDEX "ResourceVersion_resourceId_idx" ON "ResourceVersion"("resourceId");
CREATE INDEX "ResourceVersion_uploaderId_idx" ON "ResourceVersion"("uploaderId");
CREATE INDEX "ResourceVersion_sha256_idx" ON "ResourceVersion"("sha256");
CREATE INDEX "ResourceVersion_createdAt_idx" ON "ResourceVersion"("createdAt");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "ResourceTag_tagId_idx" ON "ResourceTag"("tagId");
CREATE INDEX "Note_courseId_updatedAt_idx" ON "Note"("courseId","updatedAt");
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");
CREATE INDEX "Note_visibility_idx" ON "Note"("visibility");
CREATE INDEX "Note_deletedAt_idx" ON "Note"("deletedAt");
CREATE INDEX "NoteRevision_noteId_createdAt_idx" ON "NoteRevision"("noteId","createdAt");
CREATE INDEX "NoteRevision_authorId_idx" ON "NoteRevision"("authorId");
CREATE UNIQUE INDEX "Favorite_userId_targetType_resourceId_noteId_key" ON "Favorite"("userId","targetType","resourceId","noteId");
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");
CREATE INDEX "Favorite_resourceId_idx" ON "Favorite"("resourceId");
CREATE INDEX "Favorite_noteId_idx" ON "Favorite"("noteId");
CREATE INDEX "DownloadRecord_userId_createdAt_idx" ON "DownloadRecord"("userId","createdAt");
CREATE INDEX "DownloadRecord_resourceId_idx" ON "DownloadRecord"("resourceId");
CREATE INDEX "DownloadRecord_resourceVersionId_idx" ON "DownloadRecord"("resourceVersionId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_courseId_idx" ON "AuditLog"("courseId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseMember" ADD CONSTRAINT "CourseMember_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMember" ADD CONSTRAINT "CourseMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ResourceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ResourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResourceVersion" ADD CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceVersion" ADD CONSTRAINT "ResourceVersion_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NoteRevision" ADD CONSTRAINT "NoteRevision_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteRevision" ADD CONSTRAINT "NoteRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadRecord" ADD CONSTRAINT "DownloadRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DownloadRecord" ADD CONSTRAINT "DownloadRecord_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadRecord" ADD CONSTRAINT "DownloadRecord_resourceVersionId_fkey" FOREIGN KEY ("resourceVersionId") REFERENCES "ResourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
