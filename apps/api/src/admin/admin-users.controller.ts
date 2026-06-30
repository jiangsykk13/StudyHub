import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query
} from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { AuthService } from "../auth/auth.service";
import { assertSystemAdmin } from "../auth/policies";
import { AdminService } from "./admin.service";

@Controller("admin/users")
export class AdminUsersController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Get()
  list(
    @CurrentAuth() auth: RequestAuth,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.adminService.listUsers(auth, {
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }

  @Post(":userId/disable")
  async disableUser(
    @CurrentAuth() auth: RequestAuth,
    @Param("userId", ParseUUIDPipe) userId: string
  ): Promise<{ status: "ok" }> {
    assertSystemAdmin(auth);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });
    if (!target) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "User not found."
      });
    }
    if (target.id === auth.user.id || target.role === "SYSTEM_ADMIN") {
      throw new ForbiddenException({
        code: "SYSTEM_ADMIN_DISABLE_FORBIDDEN",
        message: "System administrator accounts cannot be disabled."
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { disabledAt: new Date() } });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "USER_DISABLED",
          targetType: "user",
          targetId: userId
        }
      });
    });
    return { status: "ok" };
  }

  @Post(":userId/enable")
  async enableUser(
    @CurrentAuth() auth: RequestAuth,
    @Param("userId", ParseUUIDPipe) userId: string
  ): Promise<{ status: "ok" }> {
    assertSystemAdmin(auth);
    await this.prisma.user.update({ where: { id: userId }, data: { disabledAt: null } });
    await this.prisma.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: "USER_ENABLED",
        targetType: "user",
        targetId: userId
      }
    });
    return { status: "ok" };
  }

  @Post(":userId/revoke-sessions")
  async revokeSessions(
    @CurrentAuth() auth: RequestAuth,
    @Param("userId", ParseUUIDPipe) userId: string
  ): Promise<{ status: "ok" }> {
    assertSystemAdmin(auth);
    await this.authService.revokeUserSessions(userId);
    await this.prisma.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: "USER_SESSIONS_REVOKED",
        targetType: "user",
        targetId: userId
      }
    });
    return { status: "ok" };
  }
}
