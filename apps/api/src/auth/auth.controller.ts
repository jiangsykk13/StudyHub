import { Body, Controller, Get, Inject, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { loginSchema, registerSchema } from "@studyhub/shared";
import { parseBody } from "../common/zod";
import { Public } from "../common/public.decorator";
import { CurrentAuth } from "./current-auth.decorator";
import { AuthService } from "./auth.service";
import type { RequestAuth } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Get("csrf")
  csrf(@Res({ passthrough: true }) response: Response): { csrfToken: string } {
    return this.authService.issueCsrfCookie(response);
  }

  @Public()
  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ user: RequestAuth["user"] }> {
    return this.authService.register(parseBody(registerSchema, body), response);
  }

  @Public()
  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ user: RequestAuth["user"] }> {
    const input = parseBody(loginSchema, body);
    return this.authService.login(input.email, input.password, response);
  }

  @Post("logout")
  async logout(
    @CurrentAuth() auth: RequestAuth,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ status: "ok" }> {
    return this.authService.logout(auth, response);
  }

  @Get("me")
  me(@CurrentAuth() auth: RequestAuth): {
    user: RequestAuth["user"];
    memberships: RequestAuth["memberships"];
  } {
    return {
      user: auth.user,
      memberships: auth.memberships
    };
  }
}
