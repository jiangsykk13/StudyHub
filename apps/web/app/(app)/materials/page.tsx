import Link from "next/link";
import { apiGet, type ResourceSummary } from "../../../lib/api";
import { PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = await searchParams;
  const query = firstParam(params.q);
  const courseId = firstParam(params.courseId);
  const categoryKey = firstParam(params.categoryKey);
  const sort = firstParam(params.sort) ?? "newest";
  const page = Number(firstParam(params.page) ?? "1");
  const pageSize = 10;
  const resourceQuery = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
    pageSize: String(pageSize)
  });
  if (query) resourceQuery.set("q", query);
  if (courseId) resourceQuery.set("courseId", courseId);
  if (categoryKey) resourceQuery.set("categoryKey", categoryKey);
  if (sort) resourceQuery.set("sort", sort);

  const [resourceResult, categoryResult] = await Promise.all([
    apiGet<{ resources: ResourceSummary[]; page: number; pageSize: number; total: number }>(
      `/api/resources?${resourceQuery.toString()}`
    ),
    apiGet<{ categories: Array<{ key: string; label: string }> }>("/api/resources/categories")
  ]);
  const resources = resourceResult.resources;
  const pageCount = Math.max(1, Math.ceil(resourceResult.total / resourceResult.pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="Materials"
          description="Authorized course materials stored in private object storage."
        />
        <Link
          href="/materials/upload"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Upload Material
        </Link>
      </div>

      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_180px_auto]">
        {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
        <label className="block text-sm font-medium text-slate-700">
          Search
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Title, filename, tag, course, uploader"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select
            name="categoryKey"
            defaultValue={categoryKey ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All categories</option>
            {categoryResult.categories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sort
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title</option>
            <option value="course">Course</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>

      {resources.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No materials are available to this account yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-4 py-3 font-semibold">Size</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <Link
                      href={`/materials/${resource.id}`}
                      className="font-medium text-slate-950 hover:text-sky-700"
                    >
                      {resource.title}
                    </Link>
                    <div className="mt-1 text-slate-600">
                      {resource.currentVersion?.originalFilename ?? "No file"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {resource.course.code} · {resource.course.title}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{resource.category.label}</td>
                  <td className="px-4 py-3 text-slate-700">
                    v{resource.currentVersion?.versionNumber ?? 0}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatBytes(resource.currentVersion?.sizeBytes ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="flex items-center justify-between text-sm" aria-label="Materials pagination">
        <div className="text-slate-600">
          Page {resourceResult.page} of {pageCount} · {resourceResult.total} materials
        </div>
        <div className="flex gap-2">
          <PageLink
            label="Previous"
            disabled={resourceResult.page <= 1}
            page={resourceResult.page - 1}
          />
          <PageLink
            label="Next"
            disabled={resourceResult.page >= pageCount}
            page={resourceResult.page + 1}
          />
        </div>
      </nav>
    </div>
  );

  function PageLink(props: { label: string; disabled: boolean; page: number }) {
    const nextParams = new URLSearchParams(resourceQuery);
    nextParams.set("page", String(props.page));
    return props.disabled ? (
      <span className="rounded-md border border-slate-200 px-3 py-2 text-slate-400">
        {props.label}
      </span>
    ) : (
      <Link
        href={`/materials?${nextParams.toString()}`}
        className="rounded-md border border-slate-300 px-3 py-2 text-slate-800"
      >
        {props.label}
      </Link>
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
