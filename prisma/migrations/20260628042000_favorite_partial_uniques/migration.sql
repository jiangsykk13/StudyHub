CREATE UNIQUE INDEX "Favorite_user_resource_unique"
ON "Favorite"("userId", "resourceId")
WHERE "targetType" = 'RESOURCE' AND "resourceId" IS NOT NULL;

CREATE UNIQUE INDEX "Favorite_user_note_unique"
ON "Favorite"("userId", "noteId")
WHERE "targetType" = 'NOTE' AND "noteId" IS NOT NULL;
