import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export type AuthMe = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "SYSTEM_ADMIN" | "MEMBER";
  };
  memberships: Array<{
    courseId: string;
    role: "COURSE_ADMIN" | "MEMBER" | "READ_ONLY";
  }>;
};

export type SemesterSummary = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
  courseCount: number;
};

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  archivedAt: string | null;
  semester: {
    id: string;
    name: string;
  };
  membershipRole: "COURSE_ADMIN" | "MEMBER" | "READ_ONLY" | null;
  canAdmin: boolean;
  canContribute: boolean;
  memberCount: number;
  resourceCount: number;
  noteCount: number;
};

export type CourseDetail = CourseSummary & {
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    role: "COURSE_ADMIN" | "MEMBER" | "READ_ONLY";
    disabledAt: string | null;
  }>;
  invitations: InvitationSummary[];
};

export type InvitationSummary = {
  id: string;
  scope: "ALL_SITE" | "COURSE";
  courseId: string | null;
  course: {
    id: string;
    code: string;
    title: string;
  } | null;
  membershipRole: "COURSE_ADMIN" | "MEMBER" | "READ_ONLY";
  expiresAt: string;
  usageLimit: number;
  usedCount: number;
  revokedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    displayName: string;
  };
};

export type ResourceSummary = {
  id: string;
  title: string;
  description: string | null;
  visibility: "COURSE_MEMBERS" | "ALL_MEMBERS" | "PRIVATE";
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    code: string;
    title: string;
    semester: {
      id: string;
      name: string;
    };
  };
  category: {
    key: string;
    label: string;
  };
  uploader: {
    id: string;
    email: string;
    displayName: string;
  };
  tags: string[];
  currentVersion: {
    id: string;
    versionNumber: number;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    sha256: string;
    createdAt: string;
  } | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    sha256: string;
    createdAt: string;
  }>;
  downloadCount: number;
};

export type NoteSummary = {
  id: string;
  title: string;
  draftContent: string | null;
  publishedContent: string | null;
  visibility: "PRIVATE" | "COURSE_MEMBERS" | "ALL_MEMBERS";
  publishedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  excerpt: string;
  rendered: {
    html: string;
    toc: Array<{
      text: string;
      id: string;
    }>;
  };
  course: {
    id: string;
    code: string;
    title: string;
    semester: {
      id: string;
      name: string;
    };
  };
  author: {
    id: string;
    email: string;
    displayName: string;
  };
  revisions: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      email: string;
      displayName: string;
    };
  }>;
  revisionCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  canEdit: boolean;
};

export type FavoriteSummary = {
  id: string;
  targetType: "RESOURCE" | "NOTE";
  createdAt: string;
  resource: ResourceSummary | null;
  note: NoteSummary | null;
};

export type ProfileSummary = {
  uploads: {
    count: number;
    recent: Array<{
      id: string;
      title: string;
      createdAt: string;
      course: {
        id: string;
        code: string;
        title: string;
      };
    }>;
  };
  notes: {
    count: number;
    recent: Array<{
      id: string;
      title: string;
      publishedAt: string | null;
      updatedAt: string;
      course: {
        id: string;
        code: string;
        title: string;
      };
    }>;
  };
  favorites: {
    count: number;
  };
  quota: {
    usedBytes: number;
    limitBytes: number;
    percentUsed: number;
  };
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: "SYSTEM_ADMIN" | "MEMBER";
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
  uploadCount: number;
  noteCount: number;
  memberships: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    role: "COURSE_ADMIN" | "MEMBER" | "READ_ONLY";
  }>;
};

export type AdminResourceSummary = {
  id: string;
  title: string;
  visibility: "COURSE_MEMBERS" | "ALL_MEMBERS" | "PRIVATE";
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    code: string;
    title: string;
  };
  uploader: {
    id: string;
    email: string;
    displayName: string;
  };
  currentVersion: {
    id: string;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    sha256: string;
  } | null;
  duplicateCount: number;
};

export type AuditLogSummary = {
  id: string;
  actor: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  action:
    | "USER_DISABLED"
    | "USER_ENABLED"
    | "USER_SESSIONS_REVOKED"
    | "USER_ROLE_CHANGED"
    | "COURSE_CREATED"
    | "COURSE_UPDATED"
    | "COURSE_ARCHIVED"
    | "COURSE_MEMBER_CHANGED"
    | "INVITATION_CREATED"
    | "INVITATION_REVOKED"
    | "RESOURCE_CREATED"
    | "RESOURCE_VERSION_CREATED"
    | "RESOURCE_DELETED"
    | "RESOURCE_RESTORED"
    | "NOTE_CREATED"
    | "NOTE_UPDATED"
    | "NOTE_DELETED"
    | "NOTE_REVISION_RESTORED";
  targetType: string;
  targetId: string | null;
  courseId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type ResourcePreview =
  | {
      kind: "pdf";
      url: string;
      expiresInSeconds: number;
      expiresAt: string;
    }
  | {
      kind: "image";
      url: string;
      expiresInSeconds: number;
      expiresAt: string;
    }
  | {
      kind: "markdown";
      html: string;
    }
  | {
      kind: "text";
      html: string;
    }
  | {
      kind: "notebook";
      html: string;
    }
  | {
      kind: "unsupported";
      reason: string;
    };

export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: "no-store"
  });
  if (response.status === 401) {
    redirect("/login");
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
