import Link from "next/link";
import { apiGet, type NoteSummary } from "../../../lib/api";
import { PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = await searchParams;
  const query = firstParam(params.q);
  const courseId = firstParam(params.courseId);
  const page = Number(firstParam(params.page) ?? "1");
  const pageSize = 10;
  const noteQuery = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
    pageSize: String(pageSize)
  });
  if (query) noteQuery.set("q", query);
  if (courseId) noteQuery.set("courseId", courseId);

  const result = await apiGet<{
    notes: NoteSummary[];
    page: number;
    pageSize: number;
    total: number;
  }>(`/api/notes?${noteQuery.toString()}`);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="Notes"
          description="Create, publish, and revise sanitized Markdown course notes."
        />
        <Link
          href="/notes/new"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          New Note
        </Link>
      </div>

      <form className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
        <label className="block flex-1 text-sm font-medium text-slate-700">
          Search
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Title, content, course, author"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>

      {result.notes.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No notes are visible to this account yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {result.notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">{note.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {note.course.code} · {note.course.title} · {note.author.displayName}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  {note.publishedAt ? "Published" : "Draft"} · {visibilityLabel(note.visibility)}
                </div>
              </div>
              {note.excerpt ? (
                <p className="mt-3 text-sm leading-6 text-slate-700">{note.excerpt}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      <nav className="flex items-center justify-between text-sm" aria-label="Notes pagination">
        <div className="text-slate-600">
          Page {result.page} of {pageCount} · {result.total} notes
        </div>
        <div className="flex gap-2">
          <PageLink label="Previous" disabled={result.page <= 1} page={result.page - 1} />
          <PageLink label="Next" disabled={result.page >= pageCount} page={result.page + 1} />
        </div>
      </nav>
    </div>
  );

  function PageLink(props: { label: string; disabled: boolean; page: number }) {
    const nextParams = new URLSearchParams(noteQuery);
    nextParams.set("page", String(props.page));
    return props.disabled ? (
      <span className="rounded-md border border-slate-200 px-3 py-2 text-slate-400">
        {props.label}
      </span>
    ) : (
      <Link
        href={`/notes?${nextParams.toString()}`}
        className="rounded-md border border-slate-300 px-3 py-2 text-slate-800"
      >
        {props.label}
      </Link>
    );
  }
}

function visibilityLabel(value: NoteSummary["visibility"]): string {
  if (value === "ALL_MEMBERS") return "All members";
  if (value === "PRIVATE") return "Private";
  return "Course members";
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
