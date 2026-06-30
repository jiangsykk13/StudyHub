import Link from "next/link";
import {
  apiGet,
  type CourseDetail,
  type NoteSummary,
  type ResourceSummary
} from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { CourseAdminPanel } from "./course-admin-panel";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params
}: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const { courseId } = await params;
  const [{ course }, resourceResult, noteResult] = await Promise.all([
    apiGet<{ course: CourseDetail }>(`/api/courses/${courseId}`),
    apiGet<{ resources: ResourceSummary[] }>(`/api/resources?courseId=${courseId}&pageSize=5`),
    apiGet<{ notes: NoteSummary[] }>(`/api/notes?courseId=${courseId}&pageSize=5`)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${course.code} · ${course.title}`}
        description={course.description ?? `Course workspace for ${course.semester.name}.`}
      />

      <section className="grid gap-4 md:grid-cols-4" aria-label="Course summary">
        <Metric label="Semester" value={course.semester.name} />
        <Metric label="Members" value={course.memberCount.toString()} />
        <Metric label="Materials" value={course.resourceCount.toString()} />
        <Metric label="Notes" value={course.noteCount.toString()} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Recent Materials</h2>
            <Link
              href={`/materials?courseId=${course.id}`}
              className="text-sm font-medium text-sky-700"
            >
              View all
            </Link>
          </div>
          {resourceResult.resources.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No visible materials yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {resourceResult.resources.map((resource) => (
                <Link
                  key={resource.id}
                  href={`/materials/${resource.id}`}
                  className="block rounded-md border border-slate-200 p-3 hover:border-sky-300"
                >
                  <div className="font-medium text-slate-950">{resource.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {resource.category.label} ·{" "}
                    {resource.currentVersion?.originalFilename ?? "No file"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Recent Notes</h2>
            <Link
              href={`/notes?courseId=${course.id}`}
              className="text-sm font-medium text-sky-700"
            >
              View all
            </Link>
          </div>
          {noteResult.notes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No visible notes yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {noteResult.notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block rounded-md border border-slate-200 p-3 hover:border-sky-300"
                >
                  <div className="font-medium text-slate-950">{note.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {note.publishedAt ? "Published" : "Draft"} · {note.author.displayName}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Members</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {course.members.map((member) => (
                <tr key={member.userId} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">{member.displayName}</td>
                  <td className="px-4 py-3 text-slate-700">{member.email}</td>
                  <td className="px-4 py-3 text-slate-700">{roleLabel(member.role)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {member.disabledAt ? "Disabled" : "Active"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {course.canAdmin ? (
        <CourseAdminPanel
          courseId={course.id}
          members={course.members}
          invitations={course.invitations}
        />
      ) : null}
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{props.label}</div>
      <div className="mt-2 text-base font-semibold text-slate-950">{props.value}</div>
    </div>
  );
}

function roleLabel(role: CourseDetail["members"][number]["role"]): string {
  if (role === "COURSE_ADMIN") return "Course admin";
  if (role === "READ_ONLY") return "Read-only";
  return "Member";
}
