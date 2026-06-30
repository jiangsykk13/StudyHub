import Link from "next/link";
import { apiGet, type AuditLogSummary, type AuthMe, type CourseSummary } from "../../../../lib/api";
import { PageHeader } from "../../shared";

export const dynamic = "force-dynamic";

const auditActions = [
  "USER_DISABLED",
  "USER_ENABLED",
  "USER_SESSIONS_REVOKED",
  "COURSE_CREATED",
  "COURSE_UPDATED",
  "COURSE_ARCHIVED",
  "COURSE_MEMBER_CHANGED",
  "INVITATION_CREATED",
  "INVITATION_REVOKED",
  "RESOURCE_CREATED",
  "RESOURCE_VERSION_CREATED",
  "RESOURCE_DELETED",
  "RESOURCE_RESTORED",
  "NOTE_CREATED",
  "NOTE_UPDATED",
  "NOTE_DELETED",
  "NOTE_REVISION_RESTORED"
] as const;

export default async function AdminAuditPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = await searchParams;
  const action = firstParam(params.action);
  const courseId = firstParam(params.courseId);
  const targetType = firstParam(params.targetType);
  const page = Number(firstParam(params.page) ?? "1");
  const pageSize = 25;
  const auditQuery = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
    pageSize: String(pageSize)
  });
  if (action) auditQuery.set("action", action);
  if (courseId) auditQuery.set("courseId", courseId);
  if (targetType) auditQuery.set("targetType", targetType);

  const [me, courseResult, auditResult] = await Promise.all([
    apiGet<AuthMe>("/api/auth/me"),
    apiGet<{ courses: CourseSummary[] }>("/api/courses"),
    apiGet<{
      auditLogs: AuditLogSummary[];
      page: number;
      pageSize: number;
      total: number;
    }>(`/api/admin/audit?${auditQuery.toString()}`)
  ]);
  const canSeeAdmin =
    me.user.role === "SYSTEM_ADMIN" ||
    me.memberships.some((membership) => membership.role === "COURSE_ADMIN");
  if (!canSeeAdmin) {
    return (
      <PageHeader
        title="Audit log"
        description="Administrator access is required to view audit records."
      />
    );
  }
  const pageCount = Math.max(1, Math.ceil(auditResult.total / auditResult.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Filter security-sensitive administrative and content events."
      />
      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_220px_180px_auto]">
        <label className="block text-sm font-medium text-slate-700">
          Action
          <select
            name="action"
            defaultValue={action ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All actions</option>
            {auditActions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Course
          <select
            name="courseId"
            defaultValue={courseId ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All administrable courses</option>
            {courseResult.courses
              .filter((course) => me.user.role === "SYSTEM_ADMIN" || course.canAdmin)
              .map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Target type
          <input
            name="targetType"
            defaultValue={targetType ?? ""}
            placeholder="resource, user, note"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Course</th>
              <th className="px-4 py-3 font-semibold">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {auditResult.auditLogs.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3 text-slate-700">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-slate-950">{entry.action}</td>
                <td className="px-4 py-3 text-slate-700">
                  {entry.actor ? (
                    <>
                      {entry.actor.displayName}
                      <div className="mt-1 text-xs text-slate-500">{entry.actor.email}</div>
                    </>
                  ) : (
                    "System"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {entry.targetType}
                  {entry.targetId ? (
                    <div className="mt-1 max-w-[14rem] truncate font-mono text-xs text-slate-500">
                      {entry.targetId}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {entry.courseId ?? "global"}
                </td>
                <td className="px-4 py-3">
                  <pre className="max-w-[18rem] overflow-x-auto rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                    {entry.metadata ? JSON.stringify(entry.metadata) : "{}"}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Pagination
        params={auditQuery}
        page={auditResult.page}
        pageCount={pageCount}
        total={auditResult.total}
      />
    </div>
  );
}

function Pagination(props: {
  params: URLSearchParams;
  page: number;
  pageCount: number;
  total: number;
}) {
  return (
    <nav className="flex items-center justify-between text-sm" aria-label="Audit pagination">
      <div className="text-slate-600">
        Page {props.page} of {props.pageCount} · {props.total} audit records
      </div>
      <div className="flex gap-2">
        <PageLink
          params={props.params}
          label="Previous"
          disabled={props.page <= 1}
          page={props.page - 1}
        />
        <PageLink
          params={props.params}
          label="Next"
          disabled={props.page >= props.pageCount}
          page={props.page + 1}
        />
      </div>
    </nav>
  );
}

function PageLink(props: {
  params: URLSearchParams;
  label: string;
  disabled: boolean;
  page: number;
}) {
  const nextParams = new URLSearchParams(props.params);
  nextParams.set("page", String(props.page));
  return props.disabled ? (
    <span className="rounded-md border border-slate-200 px-3 py-2 text-slate-400">
      {props.label}
    </span>
  ) : (
    <Link
      href={`/admin/audit?${nextParams.toString()}`}
      className="rounded-md border border-slate-300 px-3 py-2 text-slate-800"
    >
      {props.label}
    </Link>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
