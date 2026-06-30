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
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { NotesService } from "./notes.service";

@Controller("notes")
export class NotesController {
  constructor(@Inject(NotesService) private readonly notesService: NotesService) {}

  @Get()
  list(
    @CurrentAuth() auth: RequestAuth,
    @Query("courseId") courseId?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.notesService.list(auth, {
      courseId,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }

  @Post()
  create(@CurrentAuth() auth: RequestAuth, @Body() body: unknown) {
    return this.notesService.create(auth, body);
  }

  @Get(":noteId")
  detail(@CurrentAuth() auth: RequestAuth, @Param("noteId", ParseUUIDPipe) noteId: string) {
    return this.notesService.detail(auth, noteId);
  }

  @Patch(":noteId")
  update(
    @CurrentAuth() auth: RequestAuth,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body() body: unknown
  ) {
    return this.notesService.update(auth, noteId, body);
  }

  @Post(":noteId/delete")
  softDelete(@CurrentAuth() auth: RequestAuth, @Param("noteId", ParseUUIDPipe) noteId: string) {
    return this.notesService.softDelete(auth, noteId);
  }

  @Post(":noteId/restore")
  restoreDeleted(@CurrentAuth() auth: RequestAuth, @Param("noteId", ParseUUIDPipe) noteId: string) {
    return this.notesService.restoreDeleted(auth, noteId);
  }

  @Post(":noteId/revisions/:revisionId/restore")
  restoreRevision(
    @CurrentAuth() auth: RequestAuth,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Param("revisionId", ParseUUIDPipe) revisionId: string
  ) {
    return this.notesService.restoreRevision(auth, noteId, revisionId);
  }
}
