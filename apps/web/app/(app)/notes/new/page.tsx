import { apiGet, type CourseSummary } from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { NoteEditor } from "../note-editor";

export const dynamic = "force-dynamic";

export default async function NewNotePage() {
  const { courses } = await apiGet<{ courses: CourseSummary[] }>("/api/courses");

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Note"
        description="Draft a Markdown course note, then publish an auditable revision when it is ready."
      />
      <NoteEditor courses={courses} />
    </div>
  );
}
