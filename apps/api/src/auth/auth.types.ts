import type { CourseMemberRole, UserRole } from "@prisma/client";
import type { Request } from "express";

export type AuthMembership = {
  courseId: string;
  role: CourseMemberRole;
};

export type RequestAuth = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
  };
  memberships: AuthMembership[];
};

export type RequestWithAuth = Request & {
  auth?: RequestAuth;
  cookies?: Record<string, string | undefined>;
};
