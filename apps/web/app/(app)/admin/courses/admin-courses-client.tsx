"use client";

import { useState, useTransition } from "react";
import { csrfJson } from "../../../../lib/client-api";
import type { CourseSummary, SemesterSummary } from "../../../../lib/api";

type AdminCoursesClientProps = {
  semesters: SemesterSummary[];
  courses: CourseSummary[];
};

export function AdminCoursesClient(props: AdminCoursesClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createSemester(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson("/api/semesters", {
          method: "POST",
          body: JSON.stringify({
            name: requiredString(formData, "name"),
            startsAt: dateToIso(requiredString(formData, "startsAt"), false),
            endsAt: dateToIso(requiredString(formData, "endsAt"), true)
          })
        });
        setMessage("Semester created.");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Semester creation failed.");
      }
    });
  }

  function createCourse(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson("/api/courses", {
          method: "POST",
          body: JSON.stringify({
            semesterId: requiredString(formData, "semesterId"),
            code: requiredString(formData, "code"),
            title: requiredString(formData, "title"),
            description: optionalString(formData, "description")
          })
        });
        setMessage("Course created.");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Course creation failed.");
      }
    });
  }

  function archiveCourse(courseId: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/courses/${courseId}/archive`, {
          method: "POST",
          body: "{}"
        });
        setMessage("Course archived.");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Course archive failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <form
          action={createSemester}
          className="space-y-3 rounded-md border border-slate-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-slate-950">Create Semester</h2>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Start date
              <input
                name="startsAt"
                type="date"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              End date
              <input
                name="endsAt"
                type="date"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create Semester
          </button>
        </form>

        <form
          action={createCourse}
          className="space-y-3 rounded-md border border-slate-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-slate-950">Create Course</h2>
          <label className="block text-sm font-medium text-slate-700">
            Semester
            <select
              name="semesterId"
              required
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            >
              {props.semesters
                .filter((semester) => !semester.archivedAt)
                .map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-[140px_1fr]">
            <label className="block text-sm font-medium text-slate-700">
              Code
              <input
                name="code"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input
                name="title"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              name="description"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending || props.semesters.length === 0}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create Course
          </button>
        </form>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Courses</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Semester</th>
                <th className="px-4 py-3 font-semibold">Members</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {props.courses.map((course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {course.code} · {course.title}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{course.semester.name}</td>
                  <td className="px-4 py-3 text-slate-700">{course.memberCount}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {course.archivedAt ? "Archived" : "Active"}
                  </td>
                  <td className="px-4 py-3">
                    {!course.archivedAt ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => archiveCourse(course.id)}
                        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                      >
                        Archive
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function dateToIso(value: string, endOfDay: boolean): string {
  return `${value}T${endOfDay ? "23:59:59.000" : "00:00:00.000"}Z`;
}
