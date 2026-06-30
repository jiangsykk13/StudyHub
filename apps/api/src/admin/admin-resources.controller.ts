import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { AdminService } from "./admin.service";

@Controller("admin/resources")
export class AdminResourcesController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  list(
    @CurrentAuth() auth: RequestAuth,
    @Query("q") q?: string,
    @Query("courseId") courseId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.adminService.listResources(auth, {
      q,
      courseId,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }

  @Post(":resourceId/delete")
  softDelete(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string
  ) {
    return this.adminService.softDeleteResource(auth, resourceId);
  }

  @Post(":resourceId/restore")
  restore(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string
  ) {
    return this.adminService.restoreResource(auth, resourceId);
  }
}
