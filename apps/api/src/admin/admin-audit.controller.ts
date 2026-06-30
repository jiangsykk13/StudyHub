import { Controller, Get, Inject, Query } from "@nestjs/common";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { AdminService } from "./admin.service";

@Controller("admin/audit")
export class AdminAuditController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  list(
    @CurrentAuth() auth: RequestAuth,
    @Query("action") action?: string,
    @Query("courseId") courseId?: string,
    @Query("actorId") actorId?: string,
    @Query("targetType") targetType?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.adminService.listAuditLogs(auth, {
      action,
      courseId,
      actorId,
      targetType,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }
}
