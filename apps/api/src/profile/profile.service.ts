import { Inject, Injectable } from "@nestjs/common";
import { loadApiConfig } from "@studyhub/config";
import type { RequestAuth } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class ProfileService {
  private readonly config = loadApiConfig();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async summary(auth: RequestAuth) {
    const [uploadBytes, uploadCount, recentUploads, noteCount, recentNotes, favoriteCount] =
      await this.prisma.$transaction([
        this.prisma.resourceVersion.aggregate({
          where: { uploaderId: auth.user.id },
          _sum: { sizeBytes: true }
        }),
        this.prisma.resource.count({
          where: { uploaderId: auth.user.id, deletedAt: null }
        }),
        this.prisma.resource.findMany({
          where: { uploaderId: auth.user.id, deletedAt: null },
          select: {
            id: true,
            title: true,
            createdAt: true,
            course: {
              select: {
                id: true,
                code: true,
                title: true
              }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 5
        }),
        this.prisma.note.count({
          where: { authorId: auth.user.id, deletedAt: null }
        }),
        this.prisma.note.findMany({
          where: { authorId: auth.user.id, deletedAt: null },
          select: {
            id: true,
            title: true,
            publishedAt: true,
            updatedAt: true,
            course: {
              select: {
                id: true,
                code: true,
                title: true
              }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 5
        }),
        this.prisma.favorite.count({
          where: { userId: auth.user.id }
        })
      ]);

    const usedBytes = Number(uploadBytes._sum.sizeBytes ?? BigInt(0));
    return {
      profile: {
        uploads: {
          count: uploadCount,
          recent: recentUploads.map((resource) => ({
            ...resource,
            createdAt: resource.createdAt.toISOString()
          }))
        },
        notes: {
          count: noteCount,
          recent: recentNotes.map((note) => ({
            ...note,
            publishedAt: note.publishedAt?.toISOString() ?? null,
            updatedAt: note.updatedAt.toISOString()
          }))
        },
        favorites: {
          count: favoriteCount
        },
        quota: {
          usedBytes,
          limitBytes: this.config.USER_STORAGE_QUOTA_BYTES,
          percentUsed:
            this.config.USER_STORAGE_QUOTA_BYTES === 0
              ? 0
              : Math.round((usedBytes / this.config.USER_STORAGE_QUOTA_BYTES) * 1000) / 10
        }
      }
    };
  }
}
