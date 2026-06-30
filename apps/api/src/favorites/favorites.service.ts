import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { FavoriteTargetType, Prisma } from "@prisma/client";
import { favoriteTargetSchema } from "@studyhub/shared";
import type { RequestAuth } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { parseBody } from "../common/zod";
import { NotesService, type NoteDto } from "../notes/notes.service";
import { ResourcesService } from "../resources/resources.service";

type FavoriteTargetInput = {
  targetType: FavoriteTargetType;
  resourceId?: string | undefined;
  noteId?: string | undefined;
};

type ResourceFavoriteDto = Awaited<ReturnType<ResourcesService["detail"]>>["resource"];

type FavoriteDto = {
  id: string;
  targetType: FavoriteTargetType;
  createdAt: string;
  resource: ResourceFavoriteDto | null;
  note: NoteDto | null;
};

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ResourcesService) private readonly resourcesService: ResourcesService,
    @Inject(NotesService) private readonly notesService: NotesService
  ) {}

  async list(auth: RequestAuth): Promise<{ favorites: FavoriteDto[] }> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" }
    });
    const visible = await Promise.all(
      favorites.map((favorite) => this.toFavoriteDto(auth, favorite))
    );
    return { favorites: visible.filter((favorite): favorite is FavoriteDto => Boolean(favorite)) };
  }

  async add(auth: RequestAuth, body: unknown): Promise<{ favorite: FavoriteDto }> {
    const input: FavoriteTargetInput = parseBody(favoriteTargetSchema, body);
    await this.assertTargetVisible(auth, input);
    const where = favoriteWhere(auth.user.id, input);

    const favorite = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.favorite.findFirst({ where });
      if (existing) return existing;
      try {
        return await tx.favorite.create({
          data: {
            userId: auth.user.id,
            targetType: input.targetType,
            resourceId: input.resourceId ?? null,
            noteId: input.noteId ?? null
          }
        });
      } catch (error) {
        const concurrent = await tx.favorite.findFirst({ where });
        if (concurrent) return concurrent;
        throw error;
      }
    });

    const dto = await this.toFavoriteDto(auth, favorite);
    if (!dto) throw targetNotFound();
    return { favorite: dto };
  }

  async remove(auth: RequestAuth, body: unknown): Promise<{ removed: boolean }> {
    const input: FavoriteTargetInput = parseBody(favoriteTargetSchema, body);
    const result = await this.prisma.favorite.deleteMany({
      where: favoriteWhere(auth.user.id, input)
    });
    return { removed: result.count > 0 };
  }

  private async assertTargetVisible(auth: RequestAuth, input: FavoriteTargetInput): Promise<void> {
    if (input.targetType === "RESOURCE" && input.resourceId) {
      await this.resourcesService.detail(auth, input.resourceId);
      return;
    }
    if (input.targetType === "NOTE" && input.noteId) {
      await this.notesService.visibleNote(auth, input.noteId);
      return;
    }
    throw new BadRequestException({
      code: "FAVORITE_TARGET_INVALID",
      message: "Favorite target is invalid."
    });
  }

  private async toFavoriteDto(
    auth: RequestAuth,
    favorite: FavoriteRecord
  ): Promise<FavoriteDto | null> {
    try {
      if (favorite.targetType === "RESOURCE" && favorite.resourceId) {
        const { resource } = await this.resourcesService.detail(auth, favorite.resourceId);
        return {
          id: favorite.id,
          targetType: favorite.targetType,
          createdAt: favorite.createdAt.toISOString(),
          resource,
          note: null
        };
      }
      if (favorite.targetType === "NOTE" && favorite.noteId) {
        const note = await this.notesService.visibleNote(auth, favorite.noteId);
        return {
          id: favorite.id,
          targetType: favorite.targetType,
          createdAt: favorite.createdAt.toISOString(),
          resource: null,
          note
        };
      }
      return null;
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}

type FavoriteRecord = Prisma.FavoriteGetPayload<Record<string, never>>;

function favoriteWhere(userId: string, input: FavoriteTargetInput): Prisma.FavoriteWhereInput {
  return input.targetType === "RESOURCE"
    ? {
        userId,
        targetType: "RESOURCE",
        resourceId: input.resourceId ?? ""
      }
    : {
        userId,
        targetType: "NOTE",
        noteId: input.noteId ?? ""
      };
}

function targetNotFound(): NotFoundException {
  return new NotFoundException({
    code: "FAVORITE_TARGET_NOT_FOUND",
    message: "Favorite target not found."
  });
}
