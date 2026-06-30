import { apiGet, type CourseSummary, type NoteSummary } from "../../../../../lib/api";
import { PageHeader } from "../../../shared";
import { NoteEditor } from "../../note-editor";

export const dynamic = "force-dynamic";

export default async function NoteEditPage({
  params
}: Readonly<{ params: Promise<{ noteId: string }> }>) {
  const { noteId } = await params;
  const [{ note }, { courses }] = await Promise.all([
    apiGet<{ note: NoteSummary }>(`/api/notes/${noteId}`),
    apiGet<{ courses: CourseSummary[] }>("/api/courses")
  ]);

  if (!note.canEdit) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Note" description={note.title} />
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This account can view the note but cannot edit it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Note" description={note.title} />
      <NoteEditor courses={courses} note={note} />
    </div>
  );
}
