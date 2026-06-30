"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CourseSummary, NoteSummary } from "../../../lib/api";
import { csrfJson } from "../../../lib/client-api";

type NoteEditorProps = {
  courses: CourseSummary[];
  note?: NoteSummary;
};

type NoteResponse = {
  note: NoteSummary;
};

type StoredDraft = {
  title: string;
  courseId: string;
  visibility: NoteSummary["visibility"];
  content: string;
};

export function NoteEditor(props: NoteEditorProps) {
  const router = useRouter();
  const writableCourses = useMemo(
    () => props.courses.filter((course) => course.canContribute),
    [props.courses]
  );
  const initialCourseId = props.note?.course.id ?? writableCourses[0]?.id ?? "";
  const initialContent = props.note?.draftContent ?? props.note?.publishedContent ?? "";
  const [title, setTitle] = useState(props.note?.title ?? "");
  const [courseId, setCourseId] = useState(initialCourseId);
  const [visibility, setVisibility] = useState<NoteSummary["visibility"]>(
    props.note?.visibility ?? "COURSE_MEMBERS"
  );
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const storageKey = props.note ? `studyhub:note:${props.note.id}:draft` : "studyhub:note:new";

  useEffect(() => {
    if (props.note) return;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<StoredDraft>;
      if (typeof parsed.title === "string") setTitle(parsed.title);
      if (typeof parsed.courseId === "string") setCourseId(parsed.courseId);
      if (
        parsed.visibility === "PRIVATE" ||
        parsed.visibility === "COURSE_MEMBERS" ||
        parsed.visibility === "ALL_MEMBERS"
      ) {
        setVisibility(parsed.visibility);
      }
      if (typeof parsed.content === "string") setContent(parsed.content);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [props.note, storageKey]);

  useEffect(() => {
    const draft: StoredDraft = { title, courseId, visibility, content };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [content, courseId, storageKey, title, visibility]);

  useEffect(() => {
    if (!props.note) return;
    if (content === initialContent) return;
    const timeout = window.setTimeout(() => {
      setStatus("Autosaving draft...");
      void csrfJson(`/api/notes/${props.note?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ draftContent: content })
      })
        .then(() => setStatus("Draft autosaved."))
        .catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : "Draft autosave failed.");
        });
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [content, initialContent, props.note]);

  function saveDraft() {
    setStatus(null);
    startTransition(async () => {
      try {
        const noteId = await ensureNote();
        await csrfJson(`/api/notes/${noteId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            draftContent: content,
            visibility
          })
        });
        window.localStorage.removeItem(storageKey);
        setStatus("Draft saved.");
        router.push(`/notes/${noteId}/edit`);
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Draft save failed.");
      }
    });
  }

  function publish() {
    setStatus(null);
    startTransition(async () => {
      try {
        const noteId = await ensureNote();
        await csrfJson(`/api/notes/${noteId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            draftContent: content,
            publishedContent: content,
            visibility,
            publish: true
          })
        });
        window.localStorage.removeItem(storageKey);
        router.push(`/notes/${noteId}`);
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Publish failed.");
      }
    });
  }

  async function ensureNote(): Promise<string> {
    if (props.note) return props.note.id;
    const response = await csrfJson<NoteResponse>("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        courseId,
        title,
        draftContent: content,
        visibility
      })
    });
    return response.note.id;
  }

  const canSubmit = title.trim().length >= 2 && courseId && writableCourses.length > 0;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={2}
            maxLength={180}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Course
          {props.note ? (
            <input
              value={`${props.note.course.code} · ${props.note.course.title}`}
              disabled
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2"
            />
          ) : (
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {writableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Visibility
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as NoteSummary["visibility"])}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="PRIVATE">Private</option>
            <option value="COURSE_MEMBERS">Course members</option>
            <option value="ALL_MEMBERS">All authenticated members</option>
          </select>
        </label>
        <div className="text-sm text-slate-600">
          <div className="font-medium text-slate-700">Draft state</div>
          <p className="mt-2">
            {status ?? "Unsaved edits are kept locally until the API save completes."}
          </p>
        </div>
      </div>

      {writableCourses.length === 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You do not have write access to any active course.
        </div>
      ) : null}

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Markdown
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={18}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !canSubmit}
          onClick={saveDraft}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
        >
          Save Draft
        </button>
        <button
          type="button"
          disabled={pending || !canSubmit}
          onClick={publish}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Publish
        </button>
      </div>
    </section>
  );
}
