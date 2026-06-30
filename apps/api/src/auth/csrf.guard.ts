import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { loadApiConfig } from "@studyhub/config";
import type { RequestWithAuth } from "./auth.types";
import { verifyCsrfToken } from "./token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly config = loadApiConfig();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (typeof origin !== "string" || !this.config.trustedOrigins.has(origin)) {
      throw new ForbiddenException({
        code: "TRUSTED_ORIGIN_REQUIRED",
        message: "The request origin is not trusted."
      });
    }

    const header = request.headers["x-csrf-token"];
    const headerToken = Array.isArray(header) ? header[0] : header;
    const cookieToken = getCookie(request, this.config.CSRF_COOKIE_NAME);

    if (
      !headerToken ||
      !cookieToken ||
      headerToken !== cookieToken ||
      !verifyCsrfToken(this.config.CSRF_SECRET, headerToken)
    ) {
      throw new ForbiddenException({
        code: "CSRF_TOKEN_INVALID",
        message: "A valid CSRF token is required."
      });
    }

    return true;
  }
}

function getCookie(request: RequestWithAuth, name: string): string | undefined {
  const cookies = request.cookies as unknown;
  if (!cookies || typeof cookies !== "object") return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}
