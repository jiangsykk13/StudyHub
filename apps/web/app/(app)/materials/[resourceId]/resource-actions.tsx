"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { csrfJson, csrfRequest } from "../../../../lib/client-api";
import { FavoriteButton } from "../../favorite-button";

type ResourceActionsProps = {
  resourceId: string;
  deletedAt: string | null;
};

export function ResourceActions(props: ResourceActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function download() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await csrfJson<{ download: { url: string } }>(
          `/api/resources/${props.resourceId}/download`,
          {
            method: "POST",
            body: "{}"
          }
        );
        window.location.href = response.download.url;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Download failed.");
      }
    });
  }

  function uploadVersion(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfRequest(`/api/resources/${props.resourceId}/versions`, {
          method: "POST",
          body: formData
        });
        setMessage("New version uploaded.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Version upload failed.");
      }
    });
  }

  function setDeleted(deleted: boolean) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/resources/${props.resourceId}/${deleted ? "delete" : "restore"}`, {
          method: "POST",
          body: "{}"
        });
        setMessage(deleted ? "Material deleted." : "Material restored.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Material update failed.");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">Actions</h2>
      {message ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          {message}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <FavoriteButton target={{ targetType: "RESOURCE", resourceId: props.resourceId }} />
        <button
          type="button"
          disabled={pending || Boolean(props.deletedAt)}
          onClick={download}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Download
        </button>
        {props.deletedAt ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeleted(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeleted(true)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>
      <form action={uploadVersion} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Upload New Version
          <input
            name="file"
            type="file"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending || Boolean(props.deletedAt)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
        >
          Upload Version
        </button>
      </form>
    </section>
  );
}
