import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { createInvitationSchema } from "@studyhub/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { RequestAuth } from "../auth/auth.types";
import { parseBody } from "../common/zod";
import { InvitationsService } from "./invitations.service";

@Controller("invitations")
export class InvitationsController {
  constructor(
    @Inject(InvitationsService) private readonly invitationsService: InvitationsService
  ) {}

  @Get()
  list(@CurrentAuth() auth: RequestAuth, @Query("courseId") courseId?: string) {
    return this.invitationsService.list(auth, { courseId });
  }

  @Post()
  create(@CurrentAuth() auth: RequestAuth, @Body() body: unknown) {
    const input = parseBody(createInvitationSchema, body);
    return this.invitationsService.create(auth, {
      ...(input.courseId ? { courseId: input.courseId } : {}),
      membershipRole: input.membershipRole ?? "MEMBER",
      expiresAt: input.expiresAt,
      usageLimit: input.usageLimit ?? 1
    });
  }

  @Post(":invitationId/revoke")
  revoke(
    @CurrentAuth() auth: RequestAuth,
    @Param("invitationId", ParseUUIDPipe) invitationId: string
  ) {
    return this.invitationsService.revoke(auth, invitationId);
  }
}
