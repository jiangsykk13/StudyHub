import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { RequestAuth, RequestWithAuth } from "./auth.types";

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestAuth => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Authentication is required."
      });
    }
    return request.auth;
  }
);
