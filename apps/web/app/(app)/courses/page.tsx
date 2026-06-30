import Link from "next/link";
import { apiGet, type CourseSummary } from "../../../lib/api";
import { PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { courses } = await apiGet<{ courses: CourseSummary[] }>("/api/courses");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="Browse semesters and course spaces available to your signed-in account."
      />
      {courses.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No courses are available to this account.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Semester</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Activity</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <Link
                      href={`/courses/${course.id}`}
                      className="font-medium text-slate-950 hover:text-sky-700"
                    >
                      {course.code} · {course.title}
                    </Link>
                    {course.description ? (
                      <div className="mt-1 text-slate-600">{course.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{course.semester.name}</td>
                  <td className="px-4 py-3 text-slate-700">{accessLabel(course)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {course.resourceCount} materials · {course.noteCount} notes
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function accessLabel(course: CourseSummary): string {
  if (course.canAdmin) return "Course admin";
  if (course.membershipRole === "READ_ONLY") return "Read-only";
  if (course.canContribute) return "Can contribute";
  return "View only";
}
