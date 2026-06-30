import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { createSemesterSchema, updateSemesterSchema } from "@studyhub/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { parseBody } from "../common/zod";
import { SemestersService } from "./semesters.service";

@Controller("semesters")
export class SemestersController {
  constructor(@Inject(SemestersService) private readonly semestersService: SemestersService) {}

  @Get()
  list(@CurrentAuth() auth: RequestAuth) {
    return this.semestersService.list(auth);
  }

  @Post()
  create(@CurrentAuth() auth: RequestAuth, @Body() body: unknown) {
    return this.semestersService.create(auth, parseBody(createSemesterSchema, body));
  }

  @Patch(":semesterId")
  update(
    @CurrentAuth() auth: RequestAuth,
    @Param("semesterId", ParseUUIDPipe) semesterId: string,
    @Body() body: unknown
  ) {
    return this.semestersService.update(auth, semesterId, parseBody(updateSemesterSchema, body));
  }

  @Post(":semesterId/archive")
  archive(
    @CurrentAuth() auth: RequestAuth,
    @Param("semesterId", ParseUUIDPipe) semesterId: string
  ) {
    return this.semestersService.archive(auth, semesterId);
  }
}
