"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminResourceSummary } from "../../../../lib/api";
import { csrfJson } from "../../../../lib/client-api";

export function AdminResourcesClient(props: { resources: AdminResourceSummary[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function moderate(resourceId: string, action: "delete" | "restore") {
    if (action === "delete" && !window.confirm("Soft delete this resource?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/admin/resources/${resourceId}/${action}`, {
          method: "POST",
          body: "{}"
        });
        setMessage(action === "delete" ? "Resource deleted." : "Resource restored.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Resource moderation failed.");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">Resources</h2>
      {message ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          {message}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Resource</th>
              <th className="px-4 py-3 font-semibold">Course</th>
              <th className="px-4 py-3 font-semibold">Uploader</th>
              <th className="px-4 py-3 font-semibold">Integrity</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {props.resources.map((resource) => (
              <tr key={resource.id} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3">
                  <Link
                    href={`/materials/${resource.id}`}
                    className="font-medium text-slate-950 hover:text-sky-700"
                  >
                    {resource.title}
                  </Link>
                  <div className="mt-1 text-slate-600">
                    {resource.currentVersion?.originalFilename ?? "No current file"}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {resource.course.code} · {resource.course.title}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {resource.uploader.displayName}
                  <div className="mt-1 text-xs text-slate-500">{resource.uploader.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {resource.duplicateCount > 1 ? (
                    <span className="font-medium text-amber-800">
                      {resource.duplicateCount} matching hashes
                    </span>
                  ) : (
                    "No duplicate hash"
                  )}
                  {resource.currentVersion ? (
                    <div className="mt-1 max-w-[18rem] truncate font-mono text-xs text-slate-500">
                      {resource.currentVersion.sha256}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {resource.deletedAt ? "Deleted" : "Active"}
                  <div className="mt-1 text-xs text-slate-500">
                    {visibilityLabel(resource.visibility)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {resource.deletedAt ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => moderate(resource.id, "restore")}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => moderate(resource.id, "delete")}
                      className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function visibilityLabel(value: AdminResourceSummary["visibility"]): string {
  if (value === "ALL_MEMBERS") return "All members";
  if (value === "PRIVATE") return "Private";
  return "Course members";
}
