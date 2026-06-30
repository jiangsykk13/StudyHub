import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CourseMemberRole, InvitationScope, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import type { RequestAuth } from "../auth/auth.types";
import { assertCourseAdmin, assertSystemAdmin, hasSystemAdmin } from "../auth/policies";
import { hashSecret, randomToken } from "../auth/token";

type InvitationInput = {
  courseId?: string | undefined;
  membershipRole: CourseMemberRole;
  expiresAt: string;
  usageLimit: number;
};

type InvitationDto = {
  id: string;
  scope: InvitationScope;
  courseId: string | null;
  course: {
    id: string;
    code: string;
    title: string;
  } | null;
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
};

@Injectable()
export class InvitationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    auth: RequestAuth,
    options: { courseId?: string | undefined } = {}
  ): Promise<{ invitations: InvitationDto[] }> {
    const where: Prisma.InvitationWhereInput = {};
    if (hasSystemAdmin(auth)) {
      if (options.courseId) where.courseId = options.courseId;
    } else {
      const administrableCourseIds = auth.memberships
        .filter((membership) => membership.role === "COURSE_ADMIN")
        .map((membership) => membership.courseId);
      if (options.courseId) {
        assertCourseAdmin(auth, options.courseId);
        where.courseId = options.courseId;
      } else if (administrableCourseIds.length > 0) {
        where.courseId = { in: administrableCourseIds };
      } else {
        assertSystemAdmin(auth);
      }
    }

    const invitations = await this.prisma.invitation.findMany({
      where,
      include: invitationInclude,
      orderBy: [{ createdAt: "desc" }]
    });
    return { invitations: invitations.map(toInvitationDto) };
  }

  async create(
    auth: RequestAuth,
    input: InvitationInput
  ): Promise<{ invitation: InvitationDto; code: string }> {
    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException({
        code: "INVITATION_EXPIRY_INVALID",
        message: "Invitation expiry must be in the future."
      });
    }

    if (input.courseId) {
      assertCourseAdmin(auth, input.courseId);
      await this.ensureCourseExists(input.courseId);
    } else {
      assertSystemAdmin(auth);
    }

    const code = `SH-${randomToken(18)}`;
    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invitation.create({
        data: {
          codeHash: hashSecret(code),
          scope: input.courseId ? "COURSE" : "ALL_SITE",
          courseId: input.courseId ?? null,
          membershipRole: input.membershipRole,
          expiresAt,
          usageLimit: input.usageLimit,
          createdById: auth.user.id
        },
        include: invitationInclude
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "INVITATION_CREATED",
          targetType: "invitation",
          targetId: created.id,
          courseId: input.courseId ?? null,
          metadata: {
            scope: created.scope,
            membershipRole: created.membershipRole,
            expiresAt: created.expiresAt.toISOString(),
            usageLimit: created.usageLimit
          }
        }
      });
      return created;
    });

    return { invitation: toInvitationDto(invitation), code };
  }

  async revoke(auth: RequestAuth, invitationId: string): Promise<{ invitation: InvitationDto }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: invitationInclude
    });
    if (!invitation) throw invitationNotFound();

    if (invitation.courseId) {
      assertCourseAdmin(auth, invitation.courseId);
    } else {
      assertSystemAdmin(auth);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.invitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
        include: invitationInclude
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "INVITATION_REVOKED",
          targetType: "invitation",
          targetId: invitationId,
          courseId: invitation.courseId
        }
      });
      return revoked;
    });

    return { invitation: toInvitationDto(updated) };
  }

  private async ensureCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, archivedAt: true }
    });
    if (!course || course.archivedAt) {
      throw new BadRequestException({
        code: "COURSE_INVALID",
        message: "The selected course is unavailable."
      });
    }
  }
}

const invitationInclude = {
  course: {
    select: {
      id: true,
      code: true,
      title: true
    }
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      displayName: true
    }
  }
} satisfies Prisma.InvitationInclude;

function toInvitationDto(invitation: {
  id: string;
  scope: InvitationScope;
  courseId: string | null;
  course: { id: string; code: string; title: string } | null;
  membershipRole: CourseMemberRole;
  expiresAt: Date;
  usageLimit: number;
  usedCount: number;
  revokedAt: Date | null;
  createdAt: Date;
  createdBy: { id: string; email: string; displayName: string };
}): InvitationDto {
  return {
    id: invitation.id,
    scope: invitation.scope,
    courseId: invitation.courseId,
    course: invitation.course,
    membershipRole: invitation.membershipRole,
    expiresAt: invitation.expiresAt.toISOString(),
    usageLimit: invitation.usageLimit,
    usedCount: invitation.usedCount,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
    createdBy: invitation.createdBy
  };
}

function invitationNotFound(): NotFoundException {
  return new NotFoundException({
    code: "INVITATION_NOT_FOUND",
    message: "Invitation not found."
  });
}
