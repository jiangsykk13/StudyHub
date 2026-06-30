import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { loadApiConfig } from "@studyhub/config";
import { PrismaService } from "../common/prisma.service";
import { IS_PUBLIC_ROUTE } from "../common/public.decorator";
import type { RequestWithAuth } from "./auth.types";
import { hashSecret } from "./token";

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly config = loadApiConfig();

  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const rawToken = getCookie(request, this.config.SESSION_COOKIE_NAME);
    if (!rawToken) {
      throw this.unauthorized();
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSecret(rawToken) },
      include: {
        user: {
          include: {
            memberships: {
              select: {
                courseId: true,
                role: true
              }
            }
          }
        }
      }
    });

    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || session.user.disabledAt) {
      throw this.unauthorized();
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: now }
    });

    request.auth = {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        role: session.user.role
      },
      memberships: session.user.memberships
    };

    return true;
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: "AUTH_REQUIRED",
      message: "Authentication is required."
    });
  }
}

function getCookie(request: RequestWithAuth, name: string): string | undefined {
  const cookies = request.cookies as unknown;
  if (!cookies || typeof cookies !== "object") return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}
