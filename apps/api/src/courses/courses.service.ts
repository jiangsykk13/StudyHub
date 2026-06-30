import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CourseMemberRole, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import type { RequestAuth } from "../auth/auth.types";
import {
  assertCourseAdmin,
  assertCourseVisible,
  assertSystemAdmin,
  hasCourseAdmin,
  hasCourseContribution,
  hasSystemAdmin
} from "../auth/policies";

type CourseInput = {
  semesterId: string;
  code: string;
  title: string;
  description?: string | null | undefined;
};

type CourseUpdateInput = {
  semesterId?: string | undefined;
  code?: string | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
};

type MembershipInput = {
  userId: string;
  role: CourseMemberRole;
};

type CourseSummaryDto = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  archivedAt: string | null;
  semester: {
    id: string;
    name: string;
  };
  membershipRole: CourseMemberRole | null;
  canAdmin: boolean;
  canContribute: boolean;
  memberCount: number;
  resourceCount: number;
  noteCount: number;
};

type CourseDetailDto = CourseSummaryDto & {
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    role: CourseMemberRole;
    disabledAt: string | null;
  }>;
  invitations: Array<{
    id: string;
    membershipRole: CourseMemberRole;
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
  }>;
};

@Injectable()
export class CoursesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    auth: RequestAuth,
    options: { includeArchived?: boolean } = {}
  ): Promise<{ courses: CourseSummaryDto[] }> {
    const courseIds = auth.memberships.map((membership) => membership.courseId);
    const where: Prisma.CourseWhereInput = hasSystemAdmin(auth)
      ? {}
      : { id: { in: courseIds }, archivedAt: null };
    if (!options.includeArchived) {
      where.archivedAt = null;
    }

    const courses = await this.prisma.course.findMany({
      where,
      include: courseSummaryInclude,
      orderBy: [{ semester: { startsAt: "desc" } }, { code: "asc" }]
    });

    return { courses: courses.map((course) => toCourseSummaryDto(auth, course)) };
  }

  async detail(auth: RequestAuth, courseId: string): Promise<{ course: CourseDetailDto }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        ...courseSummaryInclude,
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                disabledAt: true
              }
            }
          },
          orderBy: [{ role: "asc" }, { user: { displayName: "asc" } }]
        }
      }
    });
    if (!course) throw courseNotFound();
    assertCourseVisible(auth, courseId);

    const invitations = hasCourseAdmin(auth, courseId)
      ? await this.prisma.invitation.findMany({
          where: { courseId },
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                displayName: true
              }
            }
          },
          orderBy: [{ createdAt: "desc" }]
        })
      : [];

    return {
      course: {
        ...toCourseSummaryDto(auth, course),
        members: course.members.map((membership) => ({
          userId: membership.user.id,
          email: membership.user.email,
          displayName: membership.user.displayName,
          role: membership.role,
          disabledAt: membership.user.disabledAt?.toISOString() ?? null
        })),
        invitations: invitations.map((invitation) => ({
          id: invitation.id,
          membershipRole: invitation.membershipRole,
          expiresAt: invitation.expiresAt.toISOString(),
          usageLimit: invitation.usageLimit,
          usedCount: invitation.usedCount,
          revokedAt: invitation.revokedAt?.toISOString() ?? null,
          createdAt: invitation.createdAt.toISOString(),
          createdBy: invitation.createdBy
        }))
      }
    };
  }

  async create(auth: RequestAuth, input: CourseInput): Promise<{ course: CourseDetailDto }> {
    assertSystemAdmin(auth);
    await this.ensureSemesterExists(input.semesterId);
    const course = await this.prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: normalizeCourseInput(input)
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "COURSE_CREATED",
          targetType: "course",
          targetId: created.id,
          courseId: created.id
        }
      });
      return created;
    });
    return this.detail(auth, course.id);
  }

  async update(
    auth: RequestAuth,
    courseId: string,
    input: CourseUpdateInput
  ): Promise<{ course: CourseDetailDto }> {
    assertSystemAdmin(auth);
    if (input.semesterId) await this.ensureSemesterExists(input.semesterId);
    await this.ensureCourseExists(courseId);
    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: normalizeCourseInput(input)
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "COURSE_UPDATED",
          targetType: "course",
          targetId: courseId,
          courseId
        }
      });
    });
    return this.detail(auth, courseId);
  }

  async archive(auth: RequestAuth, courseId: string): Promise<{ course: CourseDetailDto }> {
    assertSystemAdmin(auth);
    await this.ensureCourseExists(courseId);
    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: { archivedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "COURSE_ARCHIVED",
          targetType: "course",
          targetId: courseId,
          courseId
        }
      });
    });
    return this.detail(auth, courseId);
  }

  async upsertMember(
    auth: RequestAuth,
    courseId: string,
    input: MembershipInput
  ): Promise<{ course: CourseDetailDto }> {
    await this.ensureCourseExists(courseId);
    assertCourseAdmin(auth, courseId);
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true }
    });
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "User not found."
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courseMember.upsert({
        where: {
          courseId_userId: {
            courseId,
            userId: input.userId
          }
        },
        create: {
          courseId,
          userId: input.userId,
          role: input.role
        },
        update: {
          role: input.role
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "COURSE_MEMBER_CHANGED",
          targetType: "course_member",
          targetId: input.userId,
          courseId,
          metadata: { role: input.role }
        }
      });
    });
    return this.detail(auth, courseId);
  }

  private async ensureSemesterExists(semesterId: string): Promise<void> {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
      select: { id: true, archivedAt: true }
    });
    if (!semester || semester.archivedAt) {
      throw new BadRequestException({
        code: "SEMESTER_INVALID",
        message: "The selected semester is unavailable."
      });
    }
  }

  private async ensureCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true }
    });
    if (!course) throw courseNotFound();
  }
}

const courseSummaryInclude = {
  semester: {
    select: {
      id: true,
      name: true
    }
  },
  _count: {
    select: {
      members: true,
      resources: true,
      notes: true
    }
  }
} satisfies Prisma.CourseInclude;

function normalizeCourseInput(
  input: CourseInput | CourseUpdateInput
): Prisma.CourseUncheckedCreateInput {
  return {
    ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
    ...(input.title ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {})
  } as Prisma.CourseUncheckedCreateInput;
}

function toCourseSummaryDto(
  auth: RequestAuth,
  course: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    archivedAt: Date | null;
    semester: { id: string; name: string };
    _count: { members: number; resources: number; notes: number };
  }
): CourseSummaryDto {
  const membershipRole =
    auth.memberships.find((membership) => membership.courseId === course.id)?.role ?? null;
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    archivedAt: course.archivedAt?.toISOString() ?? null,
    semester: course.semester,
    membershipRole,
    canAdmin: hasCourseAdmin(auth, course.id),
    canContribute: hasCourseContribution(auth, course.id),
    memberCount: course._count.members,
    resourceCount: course._count.resources,
    noteCount: course._count.notes
  };
}

function courseNotFound(): NotFoundException {
  return new NotFoundException({
    code: "COURSE_NOT_FOUND",
    message: "Course not found."
  });
}
