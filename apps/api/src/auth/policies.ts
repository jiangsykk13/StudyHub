import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  canAdminCourse,
  canContributeToCourse,
  canViewCourse,
  isSystemAdmin,
  type AuthenticatedUser,
  type CourseMembership
} from "@studyhub/shared";
import type { RequestAuth } from "./auth.types";

export function policyUser(auth: RequestAuth): AuthenticatedUser {
  return {
    id: auth.user.id,
    role: auth.user.role,
    disabledAt: null
  };
}

export function policyMemberships(auth: RequestAuth): CourseMembership[] {
  return auth.memberships.map((membership) => ({
    courseId: membership.courseId,
    role: membership.role
  }));
}

export function hasSystemAdmin(auth: RequestAuth): boolean {
  return isSystemAdmin(policyUser(auth));
}

export function hasCourseAdmin(auth: RequestAuth, courseId: string): boolean {
  return canAdminCourse(policyUser(auth), policyMemberships(auth), courseId);
}

export function hasCourseContribution(auth: RequestAuth, courseId: string): boolean {
  return canContributeToCourse(policyUser(auth), policyMemberships(auth), courseId);
}

export function assertSystemAdmin(auth: RequestAuth): void {
  if (!hasSystemAdmin(auth)) {
    throw new ForbiddenException({
      code: "SYSTEM_ADMIN_REQUIRED",
      message: "System administrator access is required."
    });
  }
}

export function assertCourseVisible(auth: RequestAuth, courseId: string): void {
  if (!canViewCourse(policyUser(auth), policyMemberships(auth), courseId)) {
    throw new NotFoundException({
      code: "COURSE_NOT_FOUND",
      message: "Course not found."
    });
  }
}

export function assertCourseAdmin(auth: RequestAuth, courseId: string): void {
  if (!hasCourseAdmin(auth, courseId)) {
    throw new ForbiddenException({
      code: "COURSE_ADMIN_REQUIRED",
      message: "Course administrator access is required."
    });
  }
}

export function assertCourseContributor(auth: RequestAuth, courseId: string): void {
  if (!hasCourseContribution(auth, courseId)) {
    throw new ForbiddenException({
      code: "COURSE_WRITE_FORBIDDEN",
      message: "Write access to this course is required."
    });
  }
}
