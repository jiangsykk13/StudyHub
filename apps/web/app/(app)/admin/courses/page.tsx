import { apiGet, type AuthMe, type CourseSummary, type SemesterSummary } from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { AdminCoursesClient } from "./admin-courses-client";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const me = await apiGet<AuthMe>("/api/auth/me");
  if (me.user.role !== "SYSTEM_ADMIN") {
    return (
      <PageHeader
        title="Course administration"
        description="System administrator access is required for global semester and course management."
      />
    );
  }

  const [semesterResult, courseResult] = await Promise.all([
    apiGet<{ semesters: SemesterSummary[] }>("/api/semesters"),
    apiGet<{ courses: CourseSummary[] }>("/api/courses?includeArchived=true")
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course administration"
        description="Manage semesters, courses, and course lifecycle for the private platform."
      />
      <AdminCoursesClient semesters={semesterResult.semesters} courses={courseResult.courses} />
    </div>
  );
}
