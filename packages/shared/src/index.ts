import { z } from "zod";

export const userRoleSchema = z.enum(["SYSTEM_ADMIN", "MEMBER"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const courseMemberRoleSchema = z.enum(["COURSE_ADMIN", "MEMBER", "READ_ONLY"]);
export type CourseMemberRole = z.infer<typeof courseMemberRoleSchema>;

export const visibilitySchema = z.enum(["COURSE_MEMBERS", "ALL_MEMBERS", "PRIVATE"]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const noteVisibilitySchema = z.enum(["PRIVATE", "COURSE_MEMBERS", "ALL_MEMBERS"]);
export type NoteVisibility = z.infer<typeof noteVisibilitySchema>;

export const resourceCategorySchema = z.enum([
  "LECTURE_SLIDES",
  "NOTES",
  "REFERENCES",
  "ASSIGNMENTS",
  "LABS",
  "PAST_EXAMS",
  "PROJECT_CODE",
  "REVIEW_SUMMARIES",
  "OTHER"
]);
export type ResourceCategoryKey = z.infer<typeof resourceCategorySchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const registerSchema = z.object({
  invitationCode: z.string().min(8).max(256),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  displayName: z.string().min(2).max(120),
  password: z.string().min(10).max(256)
});

export const createSemesterSchema = z
  .object({
    name: z.string().min(2).max(120),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime()
  })
  .strict();

export const updateSemesterSchema = createSemesterSchema.partial().strict();

export const createCourseSchema = z
  .object({
    semesterId: z.string().uuid(),
    code: z.string().min(2).max(40),
    title: z.string().min(2).max(160),
    description: z.string().max(2000).optional()
  })
  .strict();

export const updateCourseSchema = z
  .object({
    semesterId: z.string().uuid().optional(),
    code: z.string().min(2).max(40).optional(),
    title: z.string().min(2).max(160).optional(),
    description: z.string().max(2000).nullable().optional()
  })
  .strict();

export const updateCourseMembershipSchema = z
  .object({
    userId: z.string().uuid(),
    role: courseMemberRoleSchema
  })
  .strict();

export const createInvitationSchema = z
  .object({
    courseId: z.string().uuid().optional(),
    membershipRole: courseMemberRoleSchema.default("MEMBER"),
    expiresAt: z.string().datetime(),
    usageLimit: z.coerce.number().int().min(1).max(1000).default(1)
  })
  .strict();

export const resourceMetadataSchema = z
  .object({
    title: z.string().min(2).max(180),
    description: z.string().max(4000).optional(),
    courseId: z.string().uuid(),
    categoryKey: resourceCategorySchema,
    visibility: visibilitySchema.default("COURSE_MEMBERS"),
    tags: z.array(z.string().min(1).max(40)).max(12).default([])
  })
  .strict();

export const resourceMetadataUpdateSchema = resourceMetadataSchema
  .omit({ courseId: true })
  .partial()
  .strict();

export const noteCreateSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string().min(2).max(180),
    draftContent: z.string().max(500000).default(""),
    visibility: noteVisibilitySchema.default("COURSE_MEMBERS")
  })
  .strict();

export const noteUpdateSchema = z
  .object({
    title: z.string().min(2).max(180).optional(),
    draftContent: z.string().max(500000).optional(),
    publishedContent: z.string().max(500000).optional(),
    visibility: noteVisibilitySchema.optional(),
    publish: z.boolean().optional()
  })
  .strict();

export const favoriteTargetSchema = z
  .object({
    targetType: z.enum(["RESOURCE", "NOTE"]),
    resourceId: z.string().uuid().optional(),
    noteId: z.string().uuid().optional()
  })
  .strict()
  .superRefine((value, context) => {
    const hasResource = Boolean(value.resourceId);
    const hasNote = Boolean(value.noteId);
    if (value.targetType === "RESOURCE" && (!hasResource || hasNote)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A resource favorite must include only resourceId.",
        path: ["resourceId"]
      });
    }
    if (value.targetType === "NOTE" && (!hasNote || hasResource)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A note favorite must include only noteId.",
        path: ["noteId"]
      });
    }
  });

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  disabledAt: Date | null;
};

export type CourseMembership = {
  courseId: string;
  role: CourseMemberRole;
};

export function isSystemAdmin(user: AuthenticatedUser): boolean {
  return user.role === "SYSTEM_ADMIN" && !user.disabledAt;
}

export function isActiveUser(
  user: AuthenticatedUser | null | undefined
): user is AuthenticatedUser {
  return Boolean(user && !user.disabledAt);
}

export function membershipFor(
  memberships: readonly CourseMembership[],
  courseId: string
): CourseMembership | undefined {
  return memberships.find((membership) => membership.courseId === courseId);
}

export function canViewCourse(
  user: AuthenticatedUser,
  memberships: readonly CourseMembership[],
  courseId: string
): boolean {
  if (!isActiveUser(user)) return false;
  if (isSystemAdmin(user)) return true;
  return Boolean(membershipFor(memberships, courseId));
}

export function canContributeToCourse(
  user: AuthenticatedUser,
  memberships: readonly CourseMembership[],
  courseId: string
): boolean {
  if (!canViewCourse(user, memberships, courseId)) return false;
  if (isSystemAdmin(user)) return true;
  const membership = membershipFor(memberships, courseId);
  return membership?.role === "MEMBER" || membership?.role === "COURSE_ADMIN";
}

export function canAdminCourse(
  user: AuthenticatedUser,
  memberships: readonly CourseMembership[],
  courseId: string
): boolean {
  if (!isActiveUser(user)) return false;
  if (isSystemAdmin(user)) return true;
  return membershipFor(memberships, courseId)?.role === "COURSE_ADMIN";
}

export function canMutateOwnedCourseContent(params: {
  user: AuthenticatedUser;
  memberships: readonly CourseMembership[];
  courseId: string;
  ownerId: string;
}): boolean {
  if (canAdminCourse(params.user, params.memberships, params.courseId)) return true;
  return (
    params.ownerId === params.user.id &&
    canContributeToCourse(params.user, params.memberships, params.courseId)
  );
}

const blockedExtensions = new Set([".exe", ".msi", ".dll", ".bat", ".cmd", ".com", ".scr", ".ps1"]);
const allowedExtensions = new Set([
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".docx",
  ".pptx",
  ".xlsx",
  ".zip",
  ".ipynb",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".java",
  ".py",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".sql",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".sh"
]);

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

export function isAllowedUploadExtension(filename: string): boolean {
  const extension = extensionOf(filename);
  return allowedExtensions.has(extension) && !blockedExtensions.has(extension);
}

export function isBlockedUploadExtension(filename: string): boolean {
  return blockedExtensions.has(extensionOf(filename));
}

export function previewKindFor(
  filename: string,
  mimeType: string
): "pdf" | "markdown" | "image" | "text" | "notebook" | "unsupported" {
  const extension = extensionOf(filename);
  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if (extension === ".md" || extension === ".markdown") return "markdown";
  if (
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension) ||
    mimeType.startsWith("image/")
  )
    return "image";
  if (extension === ".ipynb") return "notebook";
  if (
    [
      ".txt",
      ".c",
      ".h",
      ".cpp",
      ".hpp",
      ".java",
      ".py",
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".html",
      ".css",
      ".sql",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".sh"
    ].includes(extension) ||
    mimeType.startsWith("text/")
  ) {
    return "text";
  }
  return "unsupported";
}
