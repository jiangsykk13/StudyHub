"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { csrfJson } from "../../lib/client-api";

type FavoriteTarget =
  | {
      targetType: "RESOURCE";
      resourceId: string;
    }
  | {
      targetType: "NOTE";
      noteId: string;
    };

export function FavoriteButton(props: {
  target: FavoriteTarget;
  initialFavorited?: boolean;
  label?: string;
}) {
  const [favorited, setFavorited] = useState(Boolean(props.initialFavorited));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleFavorite() {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(favorited ? "/api/favorites/remove" : "/api/favorites", {
          method: "POST",
          body: JSON.stringify(props.target)
        });
        setFavorited(!favorited);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Favorite update failed.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        aria-pressed={favorited}
        onClick={toggleFavorite}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
      >
        <Star
          aria-hidden="true"
          className={favorited ? "h-4 w-4 fill-sky-500 text-sky-600" : "h-4 w-4 text-slate-500"}
        />
        {props.label ?? (favorited ? "Remove favorite" : "Add favorite")}
      </button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
