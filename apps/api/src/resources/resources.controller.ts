import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { ResourcesService } from "./resources.service";

@Controller("resources")
export class ResourcesController {
  constructor(@Inject(ResourcesService) private readonly resourcesService: ResourcesService) {}

  @Get("categories")
  categories() {
    return this.resourcesService.categories();
  }

  @Get()
  list(
    @CurrentAuth() auth: RequestAuth,
    @Query("courseId") courseId?: string,
    @Query("categoryKey") categoryKey?: string,
    @Query("tag") tag?: string,
    @Query("q") q?: string,
    @Query("sort") sort?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.resourcesService.list(auth, {
      courseId,
      categoryKey,
      tag,
      q,
      sort,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }

  @Post()
  create(@CurrentAuth() auth: RequestAuth, @Req() request: Request) {
    return this.resourcesService.create(auth, request);
  }

  @Get(":resourceId")
  detail(@CurrentAuth() auth: RequestAuth, @Param("resourceId", ParseUUIDPipe) resourceId: string) {
    return this.resourcesService.detail(auth, resourceId);
  }

  @Get(":resourceId/preview")
  preview(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string
  ) {
    return this.resourcesService.preview(auth, resourceId);
  }

  @Patch(":resourceId")
  updateMetadata(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
    @Body() body: unknown
  ) {
    return this.resourcesService.updateMetadata(auth, resourceId, body);
  }

  @Post(":resourceId/versions")
  createVersion(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
    @Req() request: Request
  ) {
    return this.resourcesService.createVersion(auth, resourceId, request);
  }

  @Post(":resourceId/download")
  download(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string
  ) {
    return this.resourcesService.download(auth, resourceId);
  }

  @Post(":resourceId/delete")
  softDelete(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string
  ) {
    return this.resourcesService.softDelete(auth, resourceId);
  }

  @Post(":resourceId/restore")
  restore(
    @CurrentAuth() auth: RequestAuth,
    @Param("resourceId", ParseUUIDPipe) resourceId: string
  ) {
    return this.resourcesService.restore(auth, resourceId);
  }
}
