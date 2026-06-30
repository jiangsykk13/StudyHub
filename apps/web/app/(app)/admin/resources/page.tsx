import Link from "next/link";
import {
  apiGet,
  type AdminResourceSummary,
  type AuthMe,
  type CourseSummary
} from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { AdminResourcesClient } from "./admin-resources-client";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = await searchParams;
  const query = firstParam(params.q);
  const courseId = firstParam(params.courseId);
  const status = firstParam(params.status) ?? "active";
  const page = Number(firstParam(params.page) ?? "1");
  const pageSize = 20;
  const resourceQuery = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
    pageSize: String(pageSize),
    status
  });
  if (query) resourceQuery.set("q", query);
  if (courseId) resourceQuery.set("courseId", courseId);

  const [me, courseResult, resourceResult] = await Promise.all([
    apiGet<AuthMe>("/api/auth/me"),
    apiGet<{ courses: CourseSummary[] }>("/api/courses"),
    apiGet<{
      resources: AdminResourceSummary[];
      page: number;
      pageSize: number;
      total: number;
    }>(`/api/admin/resources?${resourceQuery.toString()}`)
  ]);
  const canSeeAdmin =
    me.user.role === "SYSTEM_ADMIN" ||
    me.memberships.some((membership) => membership.role === "COURSE_ADMIN");
  if (!canSeeAdmin) {
    return (
      <PageHeader
        title="Resource administration"
        description="Administrator access is required for resource moderation."
      />
    );
  }
  const pageCount = Math.max(1, Math.ceil(resourceResult.total / resourceResult.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resource administration"
        description="Moderate resources, restore soft deletions, and inspect duplicate file hashes."
      />
      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_220px_180px_auto]">
        <label className="block text-sm font-medium text-slate-700">
          Search
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Title, filename, hash, course, uploader"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
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
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="active">Active</option>
            <option value="deleted">Deleted</option>
            <option value="all">All</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>
      <AdminResourcesClient resources={resourceResult.resources} />
      <Pagination
        params={resourceQuery}
        page={resourceResult.page}
        pageCount={pageCount}
        total={resourceResult.total}
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
    <nav className="flex items-center justify-between text-sm" aria-label="Resource pagination">
      <div className="text-slate-600">
        Page {props.page} of {props.pageCount} · {props.total} resources
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
      href={`/admin/resources?${nextParams.toString()}`}
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
