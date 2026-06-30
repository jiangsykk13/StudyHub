import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import {
  createCourseSchema,
  updateCourseMembershipSchema,
  updateCourseSchema
} from "@studyhub/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { parseBody } from "../common/zod";
import { CoursesService } from "./courses.service";

@Controller("courses")
export class CoursesController {
  constructor(@Inject(CoursesService) private readonly coursesService: CoursesService) {}

  @Get()
  list(@CurrentAuth() auth: RequestAuth, @Query("includeArchived") includeArchived?: string) {
    return this.coursesService.list(auth, { includeArchived: includeArchived === "true" });
  }

  @Post()
  create(@CurrentAuth() auth: RequestAuth, @Body() body: unknown) {
    return this.coursesService.create(auth, parseBody(createCourseSchema, body));
  }

  @Get(":courseId")
  detail(@CurrentAuth() auth: RequestAuth, @Param("courseId", ParseUUIDPipe) courseId: string) {
    return this.coursesService.detail(auth, courseId);
  }

  @Patch(":courseId")
  update(
    @CurrentAuth() auth: RequestAuth,
    @Param("courseId", ParseUUIDPipe) courseId: string,
    @Body() body: unknown
  ) {
    return this.coursesService.update(auth, courseId, parseBody(updateCourseSchema, body));
  }

  @Post(":courseId/archive")
  archive(@CurrentAuth() auth: RequestAuth, @Param("courseId", ParseUUIDPipe) courseId: string) {
    return this.coursesService.archive(auth, courseId);
  }

  @Post(":courseId/members")
  upsertMember(
    @CurrentAuth() auth: RequestAuth,
    @Param("courseId", ParseUUIDPipe) courseId: string,
    @Body() body: unknown
  ) {
    return this.coursesService.upsertMember(
      auth,
      courseId,
      parseBody(updateCourseMembershipSchema, body)
    );
  }

  @Patch(":courseId/members/:userId")
  updateMember(
    @CurrentAuth() auth: RequestAuth,
    @Param("courseId", ParseUUIDPipe) courseId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: unknown
  ) {
    const input = parseBody(updateCourseMembershipSchema.omit({ userId: true }), body);
    return this.coursesService.upsertMember(auth, courseId, { userId, role: input.role });
  }
}
