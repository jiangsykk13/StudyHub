import { apiGet, type NoteSummary } from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { NoteActions } from "../note-actions";
import { NoteRenderedContent } from "../note-rendered-content";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params
}: Readonly<{ params: Promise<{ noteId: string }> }>) {
  const { noteId } = await params;
  const { note } = await apiGet<{ note: NoteSummary }>(`/api/notes/${noteId}`);

  return (
    <div className="space-y-6">
      <PageHeader title={note.title} description={note.excerpt || "Course note"} />

      <section className="grid gap-4 md:grid-cols-4" aria-label="Note summary">
        <Metric label="Course" value={`${note.course.code} · ${note.course.title}`} />
        <Metric label="Visibility" value={visibilityLabel(note.visibility)} />
        <Metric label="Revisions" value={note.revisionCount.toString()} />
        <Metric label="Favorites" value={note.favoriteCount.toString()} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row">
          {note.rendered.toc.length > 0 ? (
            <nav className="w-full shrink-0 rounded-md border border-slate-200 bg-slate-50 p-4 lg:w-64">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-600">
                Contents
              </h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                {note.rendered.toc.map((entry) => (
                  <li key={entry.id}>
                    <a href={`#${entry.id}`} className="hover:text-sky-700">
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="min-w-0 flex-1">
            {note.rendered.html ? (
              <NoteRenderedContent html={note.rendered.html} />
            ) : (
              <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                This note has no published content yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <NoteActions
        noteId={note.id}
        canEdit={note.canEdit}
        deletedAt={note.deletedAt}
        isFavorited={note.isFavorited}
        revisions={note.revisions}
      />
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

function visibilityLabel(value: NoteSummary["visibility"]): string {
  if (value === "ALL_MEMBERS") return "All members";
  if (value === "PRIVATE") return "Private";
  return "Course members";
}
