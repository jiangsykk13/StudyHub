import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { NoteVisibility, Prisma } from "@prisma/client";
import { canMutateOwnedCourseContent, noteCreateSchema, noteUpdateSchema } from "@studyhub/shared";
import type { RequestAuth } from "../auth/auth.types";
import {
  assertCourseContributor,
  assertCourseVisible,
  hasSystemAdmin,
  policyMemberships,
  policyUser
} from "../auth/policies";
import { PrismaService } from "../common/prisma.service";
import { parseBody } from "../common/zod";
import { renderNoteContent } from "./note-renderer";

type NoteCreateInput = {
  courseId: string;
  title: string;
  draftContent: string;
  visibility: NoteVisibility;
};

type NoteUpdateInput = {
  title?: string | undefined;
  draftContent?: string | undefined;
  publishedContent?: string | undefined;
  visibility?: NoteVisibility | undefined;
  publish?: boolean | undefined;
};

type NoteListOptions = {
  courseId?: string | undefined;
  q?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

export type NoteDto = {
  id: string;
  title: string;
  draftContent: string | null;
  publishedContent: string | null;
  visibility: NoteVisibility;
  publishedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  excerpt: string;
  rendered: {
    html: string;
    toc: Array<{ text: string; id: string }>;
  };
  course: {
    id: string;
    code: string;
    title: string;
    semester: {
      id: string;
      name: string;
    };
  };
  author: {
    id: string;
    email: string;
    displayName: string;
  };
  revisions: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      email: string;
      displayName: string;
    };
  }>;
  revisionCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  canEdit: boolean;
};

@Injectable()
export class NotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    auth: RequestAuth,
    options: NoteListOptions = {}
  ): Promise<{ notes: NoteDto[]; page: number; pageSize: number; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const where = this.authorizedNoteWhere(auth, options);
    const [total, notes] = await this.prisma.$transaction([
      this.prisma.note.count({ where }),
      this.prisma.note.findMany({
        where,
        include: noteInclude,
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return {
      notes: await Promise.all(notes.map((note) => this.toNoteDto(auth, note))),
      page,
      pageSize,
      total
    };
  }

  async create(auth: RequestAuth, body: unknown): Promise<{ note: NoteDto }> {
    const input = parseBody(noteCreateSchema, body) as NoteCreateInput;
    assertCourseContributor(auth, input.courseId);
    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          courseId: input.courseId,
          authorId: auth.user.id,
          title: input.title,
          draftContent: input.draftContent,
          visibility: input.visibility
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "NOTE_CREATED",
          targetType: "note",
          targetId: created.id,
          courseId: input.courseId
        }
      });
      return created;
    });
    return this.detail(auth, note.id);
  }

  async detail(auth: RequestAuth, noteId: string): Promise<{ note: NoteDto }> {
    const note = await this.findAuthorizedNote(auth, noteId);
    return { note: await this.toNoteDto(auth, note) };
  }

  async update(auth: RequestAuth, noteId: string, body: unknown): Promise<{ note: NoteDto }> {
    const note = await this.findAuthorizedNote(auth, noteId);
    this.assertCanMutateNote(auth, note);
    const input: NoteUpdateInput = parseBody(noteUpdateSchema, body);
    const nextTitle = input.title ?? note.title;
    const nextDraft = input.draftContent ?? note.draftContent;
    const data: Prisma.NoteUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.draftContent !== undefined) data.draftContent = input.draftContent;
    if (input.visibility !== undefined) data.visibility = input.visibility;

    const shouldPublish = input.publish === true;
    const publishedContent = input.publishedContent ?? nextDraft;
    const shouldAudit =
      shouldPublish || input.title !== undefined || input.visibility !== undefined;

    await this.prisma.$transaction(async (tx) => {
      if (shouldPublish) {
        data.title = nextTitle;
        data.draftContent = nextDraft;
        data.publishedContent = publishedContent;
        data.publishedAt = new Date();
      }
      if (Object.keys(data).length > 0) {
        await tx.note.update({ where: { id: noteId }, data });
      }
      if (shouldPublish) {
        await tx.noteRevision.create({
          data: {
            noteId,
            authorId: auth.user.id,
            title: nextTitle,
            content: publishedContent
          }
        });
      }
      if (shouldAudit) {
        const auditData: Prisma.AuditLogUncheckedCreateInput = {
          actorId: auth.user.id,
          action: "NOTE_UPDATED",
          targetType: "note",
          targetId: noteId,
          courseId: note.course.id
        };
        if (shouldPublish) {
          auditData.metadata = { published: true };
        }
        await tx.auditLog.create({
          data: auditData
        });
      }
    });

    return this.detail(auth, noteId);
  }

  async softDelete(auth: RequestAuth, noteId: string): Promise<{ note: NoteDto }> {
    const note = await this.findAuthorizedNote(auth, noteId);
    this.assertCanMutateNote(auth, note);
    await this.prisma.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: noteId },
        data: { deletedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "NOTE_DELETED",
          targetType: "note",
          targetId: noteId,
          courseId: note.course.id
        }
      });
    });
    const deleted = await this.findAuthorizedNote(auth, noteId, { allowDeleted: true });
    return { note: await this.toNoteDto(auth, deleted) };
  }

  async restoreDeleted(auth: RequestAuth, noteId: string): Promise<{ note: NoteDto }> {
    const note = await this.findAuthorizedNote(auth, noteId, { allowDeleted: true });
    this.assertCanMutateNote(auth, note);
    await this.prisma.$transaction(async (tx) => {
      await tx.note.update({ where: { id: noteId }, data: { deletedAt: null } });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "NOTE_UPDATED",
          targetType: "note",
          targetId: noteId,
          courseId: note.course.id,
          metadata: { restoredDeletedNote: true }
        }
      });
    });
    return this.detail(auth, noteId);
  }

  async restoreRevision(
    auth: RequestAuth,
    noteId: string,
    revisionId: string
  ): Promise<{ note: NoteDto }> {
    const note = await this.findAuthorizedNote(auth, noteId);
    this.assertCanMutateNote(auth, note);
    const revision = await this.prisma.noteRevision.findFirst({
      where: { id: revisionId, noteId }
    });
    if (!revision) {
      throw noteNotFound();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: noteId },
        data: {
          title: revision.title,
          draftContent: revision.content,
          publishedContent: revision.content,
          publishedAt: new Date()
        }
      });
      await tx.noteRevision.create({
        data: {
          noteId,
          authorId: auth.user.id,
          title: revision.title,
          content: revision.content
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "NOTE_REVISION_RESTORED",
          targetType: "note",
          targetId: noteId,
          courseId: note.course.id,
          metadata: { restoredRevisionId: revisionId }
        }
      });
    });

    return this.detail(auth, noteId);
  }

  async visibleNote(auth: RequestAuth, noteId: string): Promise<NoteDto> {
    const note = await this.findAuthorizedNote(auth, noteId);
    return this.toNoteDto(auth, note);
  }

  private authorizedNoteWhere(auth: RequestAuth, options: NoteListOptions): Prisma.NoteWhereInput {
    if (options.courseId) {
      assertCourseVisible(auth, options.courseId);
    }
    const filters: Prisma.NoteWhereInput[] = [
      { deletedAt: null },
      ...(options.courseId ? [{ courseId: options.courseId }] : []),
      ...(options.q ? [noteSearchWhere(options.q)] : [])
    ];
    if (hasSystemAdmin(auth)) return { AND: filters };

    const memberCourseIds = auth.memberships.map((membership) => membership.courseId);
    const adminCourseIds = auth.memberships
      .filter((membership) => membership.role === "COURSE_ADMIN")
      .map((membership) => membership.courseId);

    return {
      AND: [
        ...filters,
        {
          OR: [
            { authorId: auth.user.id },
            { courseId: { in: adminCourseIds } },
            { visibility: "ALL_MEMBERS", publishedContent: { not: null } },
            {
              visibility: "COURSE_MEMBERS",
              courseId: { in: memberCourseIds },
              publishedContent: { not: null }
            }
          ]
        }
      ]
    };
  }

  private async findAuthorizedNote(
    auth: RequestAuth,
    noteId: string,
    options: { allowDeleted?: boolean } = {}
  ): Promise<NoteRecord> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      include: noteInclude
    });
    if (!note || (!options.allowDeleted && note.deletedAt)) {
      throw noteNotFound();
    }
    if (!this.canViewNote(auth, note, options)) {
      throw noteNotFound();
    }
    return note;
  }

  private canViewNote(
    auth: RequestAuth,
    note: NoteRecord,
    options: { allowDeleted?: boolean } = {}
  ): boolean {
    const canMutate = this.canMutateNote(auth, note);
    if (note.deletedAt && !(options.allowDeleted && canMutate)) return false;
    if (canMutate || hasSystemAdmin(auth)) return true;
    if (!note.publishedContent) return false;
    if (note.visibility === "ALL_MEMBERS") return true;
    if (note.visibility === "PRIVATE") return false;
    return auth.memberships.some((membership) => membership.courseId === note.course.id);
  }

  private canMutateNote(auth: RequestAuth, note: NoteRecord): boolean {
    return canMutateOwnedCourseContent({
      user: policyUser(auth),
      memberships: policyMemberships(auth),
      courseId: note.course.id,
      ownerId: note.author.id
    });
  }

  private assertCanMutateNote(auth: RequestAuth, note: NoteRecord): void {
    if (!this.canMutateNote(auth, note)) {
      throw new ForbiddenException({
        code: "NOTE_WRITE_FORBIDDEN",
        message: "Write access to this note is required."
      });
    }
  }

  private async toNoteDto(auth: RequestAuth, note: NoteRecord): Promise<NoteDto> {
    const canEdit = this.canMutateNote(auth, note);
    const source = note.publishedContent ?? (canEdit ? note.draftContent : "");
    const rendered = source ? renderNoteContent(source) : { html: "", toc: [] };
    const favorite = await this.prisma.favorite.findFirst({
      where: {
        userId: auth.user.id,
        targetType: "NOTE",
        noteId: note.id
      },
      select: { id: true }
    });

    return {
      id: note.id,
      title: note.title,
      draftContent: canEdit ? note.draftContent : null,
      publishedContent: note.publishedContent,
      visibility: note.visibility,
      publishedAt: note.publishedAt?.toISOString() ?? null,
      deletedAt: note.deletedAt?.toISOString() ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      excerpt: excerpt(source),
      rendered,
      course: note.course,
      author: note.author,
      revisions: note.revisions.map((revision) => ({
        id: revision.id,
        title: revision.title,
        content: revision.content,
        createdAt: revision.createdAt.toISOString(),
        author: revision.author
      })),
      revisionCount: note._count.revisions,
      favoriteCount: note._count.favorites,
      isFavorited: Boolean(favorite),
      canEdit
    };
  }
}

const noteInclude = {
  course: {
    select: {
      id: true,
      code: true,
      title: true,
      semester: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  author: {
    select: {
      id: true,
      email: true,
      displayName: true
    }
  },
  revisions: {
    include: {
      author: {
        select: {
          id: true,
          email: true,
          displayName: true
        }
      }
    },
    orderBy: { createdAt: "desc" as const }
  },
  _count: {
    select: {
      revisions: true,
      favorites: true
    }
  }
} satisfies Prisma.NoteInclude;

type NoteRecord = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

function noteSearchWhere(query: string): Prisma.NoteWhereInput {
  const q = query.trim();
  if (!q) return {};
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { publishedContent: { contains: q, mode: "insensitive" } },
      { course: { code: { contains: q, mode: "insensitive" } } },
      { course: { title: { contains: q, mode: "insensitive" } } },
      { author: { displayName: { contains: q, mode: "insensitive" } } },
      { author: { email: { contains: q, mode: "insensitive" } } }
    ]
  };
}

function excerpt(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function noteNotFound(): NotFoundException {
  return new NotFoundException({
    code: "NOTE_NOT_FOUND",
    message: "Note not found."
  });
}
