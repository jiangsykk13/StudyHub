import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuditAction, Prisma } from "@prisma/client";
import type { RequestAuth } from "../auth/auth.types";
import { hasCourseAdmin, hasSystemAdmin } from "../auth/policies";
import { PrismaService } from "../common/prisma.service";

type PageOptions = {
  page?: number | undefined;
  pageSize?: number | undefined;
};

export type AdminUserDto = {
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

export type AdminResourceDto = {
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

export type AuditLogDto = {
  id: string;
  actor: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  courseId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUsers(
    auth: RequestAuth,
    options: PageOptions & { q?: string | undefined } = {}
  ): Promise<{ users: AdminUserDto[]; page: number; pageSize: number; total: number }> {
    this.assertSystemAdmin(auth);
    const { page, pageSize } = normalizePage(options);
    const where = userSearchWhere(options.q);
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          memberships: {
            include: {
              course: {
                select: {
                  id: true,
                  code: true,
                  title: true
                }
              }
            },
            orderBy: [{ course: { code: "asc" } }]
          },
          _count: {
            select: {
              resources: true,
              notes: true,
              sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } }
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        disabledAt: user.disabledAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        activeSessionCount: user._count.sessions,
        uploadCount: user._count.resources,
        noteCount: user._count.notes,
        memberships: user.memberships.map((membership) => ({
          courseId: membership.course.id,
          courseCode: membership.course.code,
          courseTitle: membership.course.title,
          role: membership.role
        }))
      })),
      page,
      pageSize,
      total
    };
  }

  async listResources(
    auth: RequestAuth,
    options: PageOptions & {
      q?: string | undefined;
      courseId?: string | undefined;
      status?: string | undefined;
    } = {}
  ): Promise<{ resources: AdminResourceDto[]; page: number; pageSize: number; total: number }> {
    const { page, pageSize } = normalizePage(options);
    const where = this.adminResourceWhere(auth, options);
    const [total, resources] = await this.prisma.$transaction([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        include: adminResourceInclude,
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    const duplicateCounts = await this.duplicateCounts(resources);
    return {
      resources: resources.map((resource) => toAdminResourceDto(resource, duplicateCounts)),
      page,
      pageSize,
      total
    };
  }

  async softDeleteResource(auth: RequestAuth, resourceId: string): Promise<{ status: "ok" }> {
    const resource = await this.findModeratableResource(auth, resourceId);
    await this.prisma.$transaction(async (tx) => {
      await tx.resource.update({ where: { id: resourceId }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "RESOURCE_DELETED",
          targetType: "resource",
          targetId: resourceId,
          courseId: resource.courseId,
          metadata: { moderatedByAdmin: true }
        }
      });
    });
    return { status: "ok" };
  }

  async restoreResource(auth: RequestAuth, resourceId: string): Promise<{ status: "ok" }> {
    const resource = await this.findModeratableResource(auth, resourceId);
    await this.prisma.$transaction(async (tx) => {
      await tx.resource.update({ where: { id: resourceId }, data: { deletedAt: null } });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "RESOURCE_RESTORED",
          targetType: "resource",
          targetId: resourceId,
          courseId: resource.courseId,
          metadata: { moderatedByAdmin: true }
        }
      });
    });
    return { status: "ok" };
  }

  async listAuditLogs(
    auth: RequestAuth,
    options: PageOptions & {
      action?: string | undefined;
      courseId?: string | undefined;
      actorId?: string | undefined;
      targetType?: string | undefined;
    } = {}
  ): Promise<{ auditLogs: AuditLogDto[]; page: number; pageSize: number; total: number }> {
    const { page, pageSize } = normalizePage(options);
    const where = this.auditWhere(auth, options);
    const [total, auditLogs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              displayName: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return {
      auditLogs: auditLogs.map((entry) => ({
        id: entry.id,
        actor: entry.actor,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        courseId: entry.courseId,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString()
      })),
      page,
      pageSize,
      total
    };
  }

  private adminResourceWhere(
    auth: RequestAuth,
    options: { q?: string | undefined; courseId?: string | undefined; status?: string | undefined }
  ): Prisma.ResourceWhereInput {
    const courseIds = this.adminCourseScope(auth, options.courseId);
    const filters: Prisma.ResourceWhereInput[] = [
      ...(courseIds ? [{ courseId: { in: courseIds } }] : []),
      ...(options.q ? [resourceAdminSearchWhere(options.q)] : [])
    ];
    if (options.status === "deleted") {
      filters.push({ deletedAt: { not: null } });
    } else if (options.status !== "all") {
      filters.push({ deletedAt: null });
    }
    return { AND: filters };
  }

  private auditWhere(
    auth: RequestAuth,
    options: {
      action?: string | undefined;
      courseId?: string | undefined;
      actorId?: string | undefined;
      targetType?: string | undefined;
    }
  ): Prisma.AuditLogWhereInput {
    const courseIds = this.adminCourseScope(auth, options.courseId);
    return {
      AND: [
        ...(courseIds ? [{ courseId: { in: courseIds } }] : []),
        ...(isAuditAction(options.action) ? [{ action: options.action }] : []),
        ...(options.actorId ? [{ actorId: options.actorId }] : []),
        ...(options.targetType ? [{ targetType: options.targetType }] : [])
      ]
    };
  }

  private adminCourseScope(auth: RequestAuth, requestedCourseId?: string): string[] | null {
    if (hasSystemAdmin(auth)) return requestedCourseId ? [requestedCourseId] : null;
    const administrableCourseIds = auth.memberships
      .filter((membership) => membership.role === "COURSE_ADMIN")
      .map((membership) => membership.courseId);
    if (requestedCourseId) {
      if (!hasCourseAdmin(auth, requestedCourseId)) {
        throw new ForbiddenException({
          code: "COURSE_ADMIN_REQUIRED",
          message: "Course administrator access is required."
        });
      }
      return [requestedCourseId];
    }
    if (administrableCourseIds.length === 0) {
      throw new ForbiddenException({
        code: "ADMIN_ACCESS_REQUIRED",
        message: "Administrator access is required."
      });
    }
    return administrableCourseIds;
  }

  private async findModeratableResource(
    auth: RequestAuth,
    resourceId: string
  ): Promise<{ id: string; courseId: string }> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      select: { id: true, courseId: true }
    });
    if (!resource) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Resource not found."
      });
    }
    this.adminCourseScope(auth, resource.courseId);
    return resource;
  }

  private async duplicateCounts(resources: AdminResourceRecord[]): Promise<Map<string, number>> {
    const keys = resources
      .filter((resource) => resource.currentVersion)
      .map((resource) => ({
        key: `${resource.courseId}:${resource.currentVersion?.sha256 ?? ""}`,
        courseId: resource.courseId,
        sha256: resource.currentVersion?.sha256 ?? ""
      }));
    const uniqueKeys = [...new Map(keys.map((key) => [key.key, key])).values()];
    const counts = new Map<string, number>();
    await Promise.all(
      uniqueKeys.map(async (key) => {
        const count = await this.prisma.resource.count({
          where: {
            courseId: key.courseId,
            versions: { some: { sha256: key.sha256 } }
          }
        });
        counts.set(key.key, count);
      })
    );
    return counts;
  }

  private assertSystemAdmin(auth: RequestAuth): void {
    if (!hasSystemAdmin(auth)) {
      throw new ForbiddenException({
        code: "SYSTEM_ADMIN_REQUIRED",
        message: "System administrator access is required."
      });
    }
  }
}

const adminResourceInclude = {
  course: {
    select: {
      id: true,
      code: true,
      title: true
    }
  },
  uploader: {
    select: {
      id: true,
      email: true,
      displayName: true
    }
  },
  currentVersion: true
} satisfies Prisma.ResourceInclude;

type AdminResourceRecord = Prisma.ResourceGetPayload<{ include: typeof adminResourceInclude }>;

function normalizePage(options: PageOptions): { page: number; pageSize: number } {
  return {
    page: Math.max(1, options.page ?? 1),
    pageSize: Math.min(100, Math.max(1, options.pageSize ?? 20))
  };
}

function userSearchWhere(q?: string): Prisma.UserWhereInput {
  const query = q?.trim();
  if (!query) return {};
  return {
    OR: [
      { email: { contains: query, mode: "insensitive" } },
      { displayName: { contains: query, mode: "insensitive" } }
    ]
  };
}

function resourceAdminSearchWhere(q: string): Prisma.ResourceWhereInput {
  const query = q.trim();
  if (!query) return {};
  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { course: { code: { contains: query, mode: "insensitive" } } },
      { course: { title: { contains: query, mode: "insensitive" } } },
      { uploader: { email: { contains: query, mode: "insensitive" } } },
      { uploader: { displayName: { contains: query, mode: "insensitive" } } },
      { versions: { some: { originalFilename: { contains: query, mode: "insensitive" } } } },
      { versions: { some: { sha256: { contains: query, mode: "insensitive" } } } }
    ]
  };
}

function toAdminResourceDto(
  resource: AdminResourceRecord,
  duplicateCounts: Map<string, number>
): AdminResourceDto {
  const currentVersion = resource.currentVersion;
  const duplicateKey = currentVersion ? `${resource.courseId}:${currentVersion.sha256}` : "";
  return {
    id: resource.id,
    title: resource.title,
    visibility: resource.visibility,
    deletedAt: resource.deletedAt?.toISOString() ?? null,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    course: resource.course,
    uploader: resource.uploader,
    currentVersion: currentVersion
      ? {
          id: currentVersion.id,
          originalFilename: currentVersion.originalFilename,
          sizeBytes: Number(currentVersion.sizeBytes),
          mimeType: currentVersion.mimeType,
          sha256: currentVersion.sha256
        }
      : null,
    duplicateCount: duplicateCounts.get(duplicateKey) ?? 0
  };
}

function isAuditAction(value: string | undefined): value is AuditAction {
  return Boolean(
    value &&
    [
      "USER_DISABLED",
      "USER_ENABLED",
      "USER_SESSIONS_REVOKED",
      "USER_ROLE_CHANGED",
      "COURSE_CREATED",
      "COURSE_UPDATED",
      "COURSE_ARCHIVED",
      "COURSE_MEMBER_CHANGED",
      "INVITATION_CREATED",
      "INVITATION_REVOKED",
      "RESOURCE_CREATED",
      "RESOURCE_VERSION_CREATED",
      "RESOURCE_DELETED",
      "RESOURCE_RESTORED",
      "NOTE_CREATED",
      "NOTE_UPDATED",
      "NOTE_DELETED",
      "NOTE_REVISION_RESTORED"
    ].includes(value)
  );
}
