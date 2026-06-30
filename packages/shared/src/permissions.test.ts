import { describe, expect, it } from "vitest";
import {
  canAdminCourse,
  canContributeToCourse,
  canMutateOwnedCourseContent,
  canViewCourse,
  isAllowedUploadExtension,
  previewKindFor,
  type AuthenticatedUser,
  type CourseMembership
} from "./index";

const member: AuthenticatedUser = { id: "u1", role: "MEMBER", disabledAt: null };
const admin: AuthenticatedUser = { id: "admin", role: "SYSTEM_ADMIN", disabledAt: null };
const disabled: AuthenticatedUser = { id: "u2", role: "MEMBER", disabledAt: new Date() };
const memberships: CourseMembership[] = [
  { courseId: "course-a", role: "MEMBER" },
  { courseId: "course-b", role: "READ_ONLY" },
  { courseId: "course-c", role: "COURSE_ADMIN" }
];

describe("authorization policies", () => {
  it("requires active course membership for normal users", () => {
    expect(canViewCourse(member, memberships, "course-a")).toBe(true);
    expect(canViewCourse(member, memberships, "course-x")).toBe(false);
    expect(canViewCourse(disabled, memberships, "course-a")).toBe(false);
  });

  it("blocks read-only contributions and allows course administrators", () => {
    expect(canContributeToCourse(member, memberships, "course-a")).toBe(true);
    expect(canContributeToCourse(member, memberships, "course-b")).toBe(false);
    expect(canAdminCourse(member, memberships, "course-c")).toBe(true);
  });

  it("lets system administrators act globally", () => {
    expect(canViewCourse(admin, [], "any-course")).toBe(true);
    expect(canContributeToCourse(admin, [], "any-course")).toBe(true);
    expect(canAdminCourse(admin, [], "any-course")).toBe(true);
  });

  it("limits owner edits by course write permission", () => {
    expect(
      canMutateOwnedCourseContent({
        user: member,
        memberships,
        courseId: "course-a",
        ownerId: "u1"
      })
    ).toBe(true);
    expect(
      canMutateOwnedCourseContent({
        user: member,
        memberships,
        courseId: "course-b",
        ownerId: "u1"
      })
    ).toBe(false);
  });
});

describe("upload and preview rules", () => {
  it("rejects executable extensions", () => {
    expect(isAllowedUploadExtension("malware.exe")).toBe(false);
    expect(isAllowedUploadExtension("lecture.pdf")).toBe(true);
  });

  it("classifies previews without executing uploaded content", () => {
    expect(previewKindFor("notes.md", "text/markdown")).toBe("markdown");
    expect(previewKindFor("notebook.ipynb", "application/json")).toBe("notebook");
    expect(previewKindFor("archive.zip", "application/zip")).toBe("unsupported");
  });
});
