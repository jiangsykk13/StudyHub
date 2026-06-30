import Link from "next/link";
import { apiGet, type FavoriteSummary } from "../../../lib/api";
import { FavoriteButton } from "../favorite-button";
import { PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const { favorites } = await apiGet<{ favorites: FavoriteSummary[] }>("/api/favorites");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Favorites"
        description="Saved materials and notes for the signed-in user."
      />
      {favorites.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No favorites have been saved yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {favorites.map((favorite) => {
            const href =
              favorite.targetType === "RESOURCE" && favorite.resource
                ? `/materials/${favorite.resource.id}`
                : favorite.note
                  ? `/notes/${favorite.note.id}`
                  : "/favorites";
            const title =
              favorite.targetType === "RESOURCE" ? favorite.resource?.title : favorite.note?.title;
            const course =
              favorite.targetType === "RESOURCE"
                ? favorite.resource?.course
                : favorite.note?.course;
            return (
              <article
                key={favorite.id}
                className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-normal text-slate-500">
                    {favorite.targetType === "RESOURCE" ? "Material" : "Note"}
                  </div>
                  <Link href={href} className="mt-1 block font-semibold text-slate-950">
                    {title ?? "Unavailable favorite"}
                  </Link>
                  {course ? (
                    <div className="mt-1 text-sm text-slate-600">
                      {course.code} · {course.title}
                    </div>
                  ) : null}
                </div>
                {favorite.targetType === "RESOURCE" && favorite.resource ? (
                  <FavoriteButton
                    target={{ targetType: "RESOURCE", resourceId: favorite.resource.id }}
                    initialFavorited
                  />
                ) : favorite.note ? (
                  <FavoriteButton
                    target={{ targetType: "NOTE", noteId: favorite.note.id }}
                    initialFavorited
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
