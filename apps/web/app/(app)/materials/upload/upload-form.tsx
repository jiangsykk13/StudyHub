"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { csrfRequest } from "../../../../lib/client-api";
import type { CourseSummary, ResourceSummary } from "../../../../lib/api";

type UploadFormProps = {
  courses: CourseSummary[];
  categories: Array<{ key: string; label: string }>;
};

export function UploadForm(props: UploadFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const writableCourses = props.courses.filter((course) => course.canContribute);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await csrfRequest("/api/resources", {
          method: "POST",
          body: formData
        });
        const body = (await response.json()) as { resource: ResourceSummary };
        router.push(`/materials/${body.resource.id}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-5 rounded-md border border-slate-200 bg-white p-5">
      {message ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {message}
        </div>
      ) : null}

      {writableCourses.length === 0 ? (
        <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
          No writable courses are available for this account.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Course
          <select
            name="courseId"
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {writableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} · {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select
            name="categoryKey"
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {props.categories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Title
        <input
          name="title"
          required
          minLength={2}
          maxLength={180}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Description
        <textarea
          name="description"
          rows={4}
          maxLength={4000}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Visibility
          <select
            name="visibility"
            defaultValue="COURSE_MEMBERS"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="COURSE_MEMBERS">Course members</option>
            <option value="ALL_MEMBERS">All authenticated members</option>
            <option value="PRIVATE">Private to uploader</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Tags
          <input
            name="tags"
            placeholder="week-1, review"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        File
        <input
          name="file"
          type="file"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending || writableCourses.length === 0}
        className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        Upload Material
      </button>
    </form>
  );
}
