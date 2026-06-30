"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { NoteSummary } from "../../../lib/api";
import { csrfJson } from "../../../lib/client-api";
import { FavoriteButton } from "../favorite-button";

export function NoteActions(props: {
  noteId: string;
  canEdit: boolean;
  deletedAt: string | null;
  isFavorited: boolean;
  revisions: NoteSummary["revisions"];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setDeleted(deleted: boolean) {
    if (deleted && !window.confirm("Delete this note?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/notes/${props.noteId}/${deleted ? "delete" : "restore"}`, {
          method: "POST",
          body: "{}"
        });
        setMessage(deleted ? "Note deleted." : "Note restored.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Note update failed.");
      }
    });
  }

  function restoreRevision(revisionId: string) {
    if (!window.confirm("Restore this revision and create a new audit revision?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/notes/${props.noteId}/revisions/${revisionId}/restore`, {
          method: "POST",
          body: "{}"
        });
        setMessage("Revision restored.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Revision restore failed.");
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
        <FavoriteButton
          target={{ targetType: "NOTE", noteId: props.noteId }}
          initialFavorited={props.isFavorited}
        />
        {props.canEdit ? (
          <Link
            href={`/notes/${props.noteId}/edit`}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Edit note
          </Link>
        ) : null}
        {props.canEdit && props.deletedAt ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeleted(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Restore
          </button>
        ) : null}
        {props.canEdit && !props.deletedAt ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeleted(true)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-600">
          Revision History
        </h3>
        {props.revisions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No published revisions yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200">
            {props.revisions.map((revision) => (
              <div
                key={revision.id}
                className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium text-slate-950">{revision.title}</div>
                  <div className="text-sm text-slate-600">
                    {new Date(revision.createdAt).toLocaleString()} by {revision.author.displayName}
                  </div>
                </div>
                {props.canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => restoreRevision(revision.id)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                  >
                    Restore
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
