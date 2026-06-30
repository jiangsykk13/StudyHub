import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Response } from "express";
import argon2 from "argon2";
import { loadApiConfig } from "@studyhub/config";
import { PrismaService } from "../common/prisma.service";
import { hashSecret, randomToken, signCsrfToken } from "./token";
import type { RequestAuth } from "./auth.types";

type RegisterInput = {
  invitationCode: string;
  email: string;
  displayName: string;
  password: string;
};

@Injectable()
export class AuthService {
  private readonly config = loadApiConfig();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  issueCsrfCookie(response: Response): { csrfToken: string } {
    const csrfToken = signCsrfToken(this.config.CSRF_SECRET);
    response.cookie(this.config.CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: this.config.isProduction,
      sameSite: "lax",
      path: "/"
    });
    return { csrfToken };
  }

  async register(input: RegisterInput, response: Response): Promise<{ user: RequestAuth["user"] }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { codeHash: hashSecret(input.invitationCode) }
    });
    const now = new Date();
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.expiresAt <= now ||
      invitation.usedCount >= invitation.usageLimit
    ) {
      throw new ForbiddenException({
        code: "INVITATION_INVALID",
        message: "The invitation is invalid, expired, exhausted, or revoked."
      });
    }

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException({
        code: "EMAIL_IN_USE",
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          revokedAt: null,
          expiresAt: { gt: now },
          usedCount: { lt: invitation.usageLimit }
        },
        data: { usedCount: { increment: 1 } }
      });
      if (consumed.count !== 1) {
        throw new ForbiddenException({
          code: "INVITATION_INVALID",
          message: "The invitation is invalid, expired, exhausted, or revoked."
        });
      }

      const created = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          role: "MEMBER"
        }
      });

      if (invitation.courseId) {
        await tx.courseMember.create({
          data: {
            courseId: invitation.courseId,
            userId: created.id,
            role: invitation.membershipRole
          }
        });
      }

      return created;
    });

    await this.createSession(user.id, response);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    };
  }

  async login(
    email: string,
    password: string,
    response: Response
  ): Promise<{ user: RequestAuth["user"] }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.disabledAt || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password."
      });
    }

    await this.createSession(user.id, response);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    };
  }

  async logout(auth: RequestAuth, response: Response): Promise<{ status: "ok" }> {
    await this.prisma.session.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() }
    });
    this.clearSessionCookie(response);
    return { status: "ok" };
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  private async createSession(userId: string, response: Response): Promise<void> {
    const rawSessionToken = randomToken();
    const csrfToken = this.issueCsrfCookie(response).csrfToken;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSecret(rawSessionToken),
        csrfTokenHash: hashSecret(csrfToken),
        expiresAt
      }
    });
    response.cookie(this.config.SESSION_COOKIE_NAME, rawSessionToken, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: "lax",
      path: "/",
      expires: expiresAt
    });
  }

  private clearSessionCookie(response: Response): void {
    response.clearCookie(this.config.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: "lax",
      path: "/"
    });
  }
}
