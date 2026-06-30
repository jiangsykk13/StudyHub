import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Prisma, ResourceVisibility } from "@prisma/client";
import { loadApiConfig } from "@studyhub/config";
import {
  canMutateOwnedCourseContent,
  extensionOf,
  isAllowedUploadExtension,
  isBlockedUploadExtension,
  previewKindFor,
  resourceMetadataSchema,
  resourceMetadataUpdateSchema
} from "@studyhub/shared";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import hljs from "highlight.js";
import { PrismaService } from "../common/prisma.service";
import { parseBody } from "../common/zod";
import { StorageService } from "../storage/storage.service";
import type { RequestAuth } from "../auth/auth.types";
import {
  assertCourseContributor,
  assertCourseVisible,
  hasCourseAdmin,
  hasSystemAdmin,
  policyMemberships,
  policyUser
} from "../auth/policies";
import { cleanupParsedFile, parseMultipartUpload, type ParsedUpload } from "./multipart-upload";

type ResourceMetadataInput = {
  title: string;
  description?: string | undefined;
  courseId: string;
  categoryKey: string;
  visibility: ResourceVisibility;
  tags: string[];
};

type ResourceMetadataUpdateInput = {
  title?: string | undefined;
  description?: string | undefined;
  categoryKey?: string | undefined;
  visibility?: ResourceVisibility | undefined;
  tags?: string[] | undefined;
};

type ResourceDto = {
  id: string;
  title: string;
  description: string | null;
  visibility: ResourceVisibility;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    code: string;
    title: string;
    semester: {
      id: string;
      name: string;
    };
  };
  category: {
    key: string;
    label: string;
  };
  uploader: {
    id: string;
    email: string;
    displayName: string;
  };
  tags: string[];
  currentVersion: {
    id: string;
    versionNumber: number;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    sha256: string;
    createdAt: string;
  } | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    sha256: string;
    createdAt: string;
  }>;
  downloadCount: number;
};

type ResourceListOptions = {
  courseId?: string | undefined;
  categoryKey?: string | undefined;
  tag?: string | undefined;
  q?: string | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

type ResourcePreviewDto =
  | {
      kind: "pdf" | "image";
      url: string;
      expiresInSeconds: number;
      expiresAt: string;
    }
  | {
      kind: "markdown" | "text" | "notebook";
      html: string;
    }
  | {
      kind: "unsupported";
      reason: string;
    };

@Injectable()
export class ResourcesService {
  private readonly config = loadApiConfig();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService
  ) {}

  async list(
    auth: RequestAuth,
    options: ResourceListOptions = {}
  ): Promise<{ resources: ResourceDto[]; page: number; pageSize: number; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const where = this.authorizedResourceWhere(auth, options);
    const [total, resources] = await this.prisma.$transaction([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        include: resourceInclude,
        orderBy: resourceOrderBy(options.sort),
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return { resources: resources.map(toResourceDto), page, pageSize, total };
  }

  async categories(): Promise<{ categories: Array<{ key: string; label: string }> }> {
    const categories = await this.prisma.resourceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
    return {
      categories: categories.map((category) => ({
        key: category.key,
        label: category.label
      }))
    };
  }

  async detail(auth: RequestAuth, resourceId: string): Promise<{ resource: ResourceDto }> {
    const resource = await this.findAuthorizedResource(auth, resourceId);
    return { resource: toResourceDto(resource) };
  }

  async preview(auth: RequestAuth, resourceId: string): Promise<{ preview: ResourcePreviewDto }> {
    const resource = await this.findAuthorizedResource(auth, resourceId);
    if (!resource.currentVersion) {
      throw new NotFoundException({
        code: "RESOURCE_VERSION_NOT_FOUND",
        message: "Resource version not found."
      });
    }

    const version = resource.currentVersion;
    const kind = previewKindFor(version.originalFilename, version.mimeType);
    if (kind === "pdf" || kind === "image") {
      const signed = await this.storage.createInlineUrl({
        key: version.objectKey,
        contentType: version.mimeType
      });
      return {
        preview: {
          kind,
          url: signed.url,
          expiresInSeconds: signed.expiresInSeconds,
          expiresAt: new Date(Date.now() + signed.expiresInSeconds * 1000).toISOString()
        }
      };
    }

    if (kind === "markdown" || kind === "text" || kind === "notebook") {
      if (Number(version.sizeBytes) > this.config.TEXT_PREVIEW_LIMIT_BYTES) {
        return {
          preview: {
            kind: "unsupported",
            reason: "Text preview is larger than the configured preview limit."
          }
        };
      }
      const object = await this.storage.readObjectBytes(
        version.objectKey,
        this.config.TEXT_PREVIEW_LIMIT_BYTES
      );
      if (object.truncated) {
        return {
          preview: {
            kind: "unsupported",
            reason: "Text preview is larger than the configured preview limit."
          }
        };
      }
      const text = object.bytes.toString("utf8");
      if (kind === "markdown") {
        return { preview: { kind: "markdown", html: renderMarkdown(text) } };
      }
      if (kind === "notebook") {
        return { preview: { kind: "notebook", html: renderNotebook(text) } };
      }
      return {
        preview: {
          kind: "text",
          html: renderHighlightedCode(text, extensionOf(version.originalFilename))
        }
      };
    }

    return {
      preview: {
        kind: "unsupported",
        reason: "This file type is download-only in the MVP."
      }
    };
  }

  async create(auth: RequestAuth, request: Parameters<typeof parseMultipartUpload>[0]) {
    const upload = await parseMultipartUpload(request, this.config.MAX_UPLOAD_BYTES);
    try {
      const metadata = parseResourceMetadata(upload.fields);
      assertCourseContributor(auth, metadata.courseId);
      await this.ensureCategory(metadata.categoryKey);
      const fileInfo = validateUploadFile(upload.file);
      await this.assertQuota(auth.user.id, upload.file.sizeBytes);
      await this.assertNoDuplicate(metadata.courseId, upload.file.sha256);
      const objectKey = randomObjectKey();

      await this.storage.putObject({
        key: objectKey,
        body: createReadStream(upload.file.tempPath),
        contentType: fileInfo.mimeType,
        contentLength: upload.file.sizeBytes
      });

      try {
        const resource = await this.prisma.$transaction(async (tx) => {
          const category = await tx.resourceCategory.findUniqueOrThrow({
            where: { key: metadata.categoryKey }
          });
          const created = await tx.resource.create({
            data: {
              courseId: metadata.courseId,
              categoryId: category.id,
              uploaderId: auth.user.id,
              title: metadata.title,
              description: metadata.description ?? null,
              visibility: metadata.visibility
            }
          });
          const version = await tx.resourceVersion.create({
            data: {
              resourceId: created.id,
              versionNumber: 1,
              uploaderId: auth.user.id,
              objectKey,
              originalFilename: upload.file.originalFilename,
              sizeBytes: BigInt(upload.file.sizeBytes),
              mimeType: fileInfo.mimeType,
              sha256: upload.file.sha256
            }
          });
          await tx.resource.update({
            where: { id: created.id },
            data: { currentVersionId: version.id }
          });
          await replaceResourceTags(tx, created.id, metadata.tags);
          await tx.auditLog.create({
            data: {
              actorId: auth.user.id,
              action: "RESOURCE_CREATED",
              targetType: "resource",
              targetId: created.id,
              courseId: metadata.courseId
            }
          });
          return created;
        });
        return this.detail(auth, resource.id);
      } catch (error) {
        await this.storage.deleteObject(objectKey).catch(() => undefined);
        throw error;
      }
    } finally {
      await cleanupParsedFile(upload.file);
    }
  }

  async createVersion(
    auth: RequestAuth,
    resourceId: string,
    request: Parameters<typeof parseMultipartUpload>[0]
  ): Promise<{ resource: ResourceDto }> {
    const existing = await this.findAuthorizedResource(auth, resourceId);
    this.assertCanMutateResource(auth, existing);
    const upload = await parseMultipartUpload(request, this.config.MAX_UPLOAD_BYTES);
    try {
      const fileInfo = validateUploadFile(upload.file);
      await this.assertQuota(auth.user.id, upload.file.sizeBytes);
      await this.assertNoDuplicate(existing.course.id, upload.file.sha256);
      const objectKey = randomObjectKey();

      await this.storage.putObject({
        key: objectKey,
        body: createReadStream(upload.file.tempPath),
        contentType: fileInfo.mimeType,
        contentLength: upload.file.sizeBytes
      });

      try {
        await this.prisma.$transaction(async (tx) => {
          const latest = await tx.resourceVersion.aggregate({
            where: { resourceId },
            _max: { versionNumber: true }
          });
          const version = await tx.resourceVersion.create({
            data: {
              resourceId,
              versionNumber: (latest._max.versionNumber ?? 0) + 1,
              uploaderId: auth.user.id,
              objectKey,
              originalFilename: upload.file.originalFilename,
              sizeBytes: BigInt(upload.file.sizeBytes),
              mimeType: fileInfo.mimeType,
              sha256: upload.file.sha256
            }
          });
          await tx.resource.update({
            where: { id: resourceId },
            data: { currentVersionId: version.id }
          });
          await tx.auditLog.create({
            data: {
              actorId: auth.user.id,
              action: "RESOURCE_VERSION_CREATED",
              targetType: "resource",
              targetId: resourceId,
              courseId: existing.course.id
            }
          });
        });
        return this.detail(auth, resourceId);
      } catch (error) {
        await this.storage.deleteObject(objectKey).catch(() => undefined);
        throw error;
      }
    } finally {
      await cleanupParsedFile(upload.file);
    }
  }

  async updateMetadata(
    auth: RequestAuth,
    resourceId: string,
    body: unknown
  ): Promise<{ resource: ResourceDto }> {
    const resource = await this.findAuthorizedResource(auth, resourceId);
    this.assertCanMutateResource(auth, resource);
    const input = parseBody(resourceMetadataUpdateSchema, body) as ResourceMetadataUpdateInput;
    const data: Prisma.ResourceUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description || null;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.categoryKey !== undefined) {
      const category = await this.prisma.resourceCategory.findUnique({
        where: { key: input.categoryKey }
      });
      if (!category) throw categoryInvalid();
      data.category = { connect: { id: category.id } };
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.resource.update({ where: { id: resourceId }, data });
      }
      if (input.tags) {
        await replaceResourceTags(tx, resourceId, normalizeTagNames(input.tags));
      }
    });
    return this.detail(auth, resourceId);
  }

  async softDelete(auth: RequestAuth, resourceId: string): Promise<{ resource: ResourceDto }> {
    const resource = await this.findAuthorizedResource(auth, resourceId);
    this.assertCanMutateResource(auth, resource);
    await this.prisma.$transaction(async (tx) => {
      await tx.resource.update({
        where: { id: resourceId },
        data: { deletedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "RESOURCE_DELETED",
          targetType: "resource",
          targetId: resourceId,
          courseId: resource.course.id
        }
      });
    });
    const deleted = await this.findAuthorizedResource(auth, resourceId, { allowDeleted: true });
    return { resource: toResourceDto(deleted) };
  }

  async restore(auth: RequestAuth, resourceId: string): Promise<{ resource: ResourceDto }> {
    const resource = await this.findAuthorizedResource(auth, resourceId, { allowDeleted: true });
    this.assertCanMutateResource(auth, resource);
    await this.prisma.$transaction(async (tx) => {
      await tx.resource.update({
        where: { id: resourceId },
        data: { deletedAt: null }
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.user.id,
          action: "RESOURCE_RESTORED",
          targetType: "resource",
          targetId: resourceId,
          courseId: resource.course.id
        }
      });
    });
    return this.detail(auth, resourceId);
  }

  async download(auth: RequestAuth, resourceId: string) {
    const resource = await this.findAuthorizedResource(auth, resourceId);
    if (!resource.currentVersion) {
      throw new NotFoundException({
        code: "RESOURCE_VERSION_NOT_FOUND",
        message: "Resource version not found."
      });
    }

    await this.prisma.downloadRecord.create({
      data: {
        userId: auth.user.id,
        resourceId,
        resourceVersionId: resource.currentVersion.id
      }
    });
    const signed = await this.storage.createDownloadUrl({
      key: resource.currentVersion.objectKey,
      originalFilename: resource.currentVersion.originalFilename,
      contentType: resource.currentVersion.mimeType
    });
    return {
      download: {
        url: signed.url,
        expiresInSeconds: signed.expiresInSeconds,
        expiresAt: new Date(Date.now() + signed.expiresInSeconds * 1000).toISOString()
      }
    };
  }

  private authorizedResourceWhere(
    auth: RequestAuth,
    options: ResourceListOptions
  ): Prisma.ResourceWhereInput {
    if (options.courseId) {
      assertCourseVisible(auth, options.courseId);
    }
    const filters: Prisma.ResourceWhereInput[] = [
      { deletedAt: null },
      ...(options.courseId ? [{ courseId: options.courseId }] : []),
      ...(options.categoryKey ? [{ category: { key: options.categoryKey } }] : []),
      ...(options.tag ? [{ tags: { some: { tag: { name: options.tag.toLowerCase() } } } }] : []),
      ...(options.q ? [metadataSearchWhere(options.q)] : [])
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
            { visibility: "ALL_MEMBERS" },
            { courseId: { in: memberCourseIds }, visibility: "COURSE_MEMBERS" },
            { uploaderId: auth.user.id, visibility: "PRIVATE" },
            { courseId: { in: adminCourseIds }, visibility: "PRIVATE" }
          ]
        }
      ]
    };
  }

  private async findAuthorizedResource(
    auth: RequestAuth,
    resourceId: string,
    options: { allowDeleted?: boolean } = {}
  ): Promise<ResourceRecord> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: resourceInclude
    });
    if (!resource || (!options.allowDeleted && resource.deletedAt)) {
      throw resourceNotFound();
    }
    if (!this.canViewResource(auth, resource)) {
      throw resourceNotFound();
    }
    return resource;
  }

  private canViewResource(auth: RequestAuth, resource: ResourceRecord): boolean {
    if (hasSystemAdmin(auth)) return true;
    if (resource.visibility === "ALL_MEMBERS") return true;
    if (resource.visibility === "PRIVATE") {
      return resource.uploader.id === auth.user.id || hasCourseAdmin(auth, resource.course.id);
    }
    return auth.memberships.some((membership) => membership.courseId === resource.course.id);
  }

  private assertCanMutateResource(auth: RequestAuth, resource: ResourceRecord): void {
    const allowed = canMutateOwnedCourseContent({
      user: policyUser(auth),
      memberships: policyMemberships(auth),
      courseId: resource.course.id,
      ownerId: resource.uploader.id
    });
    if (!allowed) {
      throw new ForbiddenException({
        code: "RESOURCE_WRITE_FORBIDDEN",
        message: "Write access to this resource is required."
      });
    }
  }

  private async assertQuota(userId: string, nextBytes: number): Promise<void> {
    const aggregate = await this.prisma.resourceVersion.aggregate({
      where: { uploaderId: userId },
      _sum: { sizeBytes: true }
    });
    const used = aggregate._sum.sizeBytes ?? BigInt(0);
    if (used + BigInt(nextBytes) > BigInt(this.config.USER_STORAGE_QUOTA_BYTES)) {
      throw new ForbiddenException({
        code: "UPLOAD_QUOTA_EXCEEDED",
        message: "The upload would exceed the configured storage quota."
      });
    }
  }

  private async assertNoDuplicate(courseId: string, sha256: string): Promise<void> {
    const duplicate = await this.prisma.resource.findFirst({
      where: {
        courseId,
        deletedAt: null,
        versions: { some: { sha256 } }
      },
      select: { id: true, title: true }
    });
    if (duplicate) {
      throw new ConflictException({
        code: "RESOURCE_DUPLICATE",
        message: "An exact duplicate already exists in this course."
      });
    }
  }

  private async ensureCategory(categoryKey: string): Promise<void> {
    const category = await this.prisma.resourceCategory.findUnique({
      where: { key: categoryKey },
      select: { id: true }
    });
    if (!category) throw categoryInvalid();
  }
}

const resourceInclude = {
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
  category: {
    select: {
      key: true,
      label: true
    }
  },
  uploader: {
    select: {
      id: true,
      email: true,
      displayName: true
    }
  },
  currentVersion: true,
  versions: {
    orderBy: { versionNumber: "desc" as const }
  },
  tags: {
    include: {
      tag: true
    },
    orderBy: {
      tag: { name: "asc" as const }
    }
  },
  _count: {
    select: {
      downloads: true
    }
  }
} satisfies Prisma.ResourceInclude;

type ResourceRecord = Prisma.ResourceGetPayload<{ include: typeof resourceInclude }>;

function parseResourceMetadata(fields: Record<string, string[]>): ResourceMetadataInput {
  const parsed = parseBody(resourceMetadataSchema, {
    title: firstField(fields, "title"),
    description: optionalField(fields, "description"),
    courseId: firstField(fields, "courseId"),
    categoryKey: firstField(fields, "categoryKey"),
    visibility: optionalField(fields, "visibility") ?? "COURSE_MEMBERS",
    tags: normalizeTagNames(allFields(fields, "tags").flatMap((value) => value.split(",")))
  }) as ResourceMetadataInput;
  return parsed;
}

function firstField(fields: Record<string, string[]>, key: string): string | undefined {
  return fields[key]?.[0];
}

function optionalField(fields: Record<string, string[]>, key: string): string | undefined {
  const value = firstField(fields, key);
  return value && value.trim().length > 0 ? value : undefined;
}

function allFields(fields: Record<string, string[]>, key: string): string[] {
  return fields[key] ?? [];
}

function validateUploadFile(file: ParsedUpload["file"]): { mimeType: string } {
  if (
    isBlockedUploadExtension(file.originalFilename) ||
    !isAllowedUploadExtension(file.originalFilename)
  ) {
    throw new BadRequestException({
      code: "UPLOAD_TYPE_BLOCKED",
      message: "This file type is not allowed."
    });
  }
  const mimeType = detectedMimeType(file.originalFilename, file.headerBytes);
  if (!mimeType) {
    throw new BadRequestException({
      code: "UPLOAD_SIGNATURE_INVALID",
      message: "The uploaded file content does not match an allowed safe format."
    });
  }
  return { mimeType };
}

function detectedMimeType(filename: string, bytes: Buffer): string | null {
  const extension = extensionOf(filename);
  if (extension === ".pdf") return startsWithAscii(bytes, "%PDF") ? "application/pdf" : null;
  if (extension === ".png")
    return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]) ? "image/png" : null;
  if (extension === ".jpg" || extension === ".jpeg") {
    return startsWithBytes(bytes, [0xff, 0xd8, 0xff]) ? "image/jpeg" : null;
  }
  if (extension === ".gif") return startsWithAscii(bytes, "GIF8") ? "image/gif" : null;
  if (extension === ".webp") {
    return bytes.length >= 12 &&
      startsWithAscii(bytes.subarray(0, 4), "RIFF") &&
      startsWithAscii(bytes.subarray(8, 12), "WEBP")
      ? "image/webp"
      : null;
  }
  if ([".zip", ".docx", ".pptx", ".xlsx"].includes(extension)) {
    if (!startsWithBytes(bytes, [0x50, 0x4b])) return null;
    if (extension === ".docx") {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (extension === ".pptx") {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    if (extension === ".xlsx") {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    return "application/zip";
  }
  if (extension === ".md" || extension === ".markdown") {
    return isTextLike(bytes) ? "text/markdown" : null;
  }
  if (extension === ".ipynb") return isTextLike(bytes) ? "application/json" : null;
  if (isTextExtension(extension)) return isTextLike(bytes) ? "text/plain" : null;
  return null;
}

function startsWithAscii(bytes: Buffer, value: string): boolean {
  return bytes.subarray(0, value.length).toString("ascii") === value;
}

function startsWithBytes(bytes: Buffer, expected: number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

function isTextLike(bytes: Buffer): boolean {
  return !bytes.includes(0);
}

function isTextExtension(extension: string): boolean {
  return [
    ".txt",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".java",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".sql",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".sh"
  ].includes(extension);
}

function normalizeTagNames(tags: string[]): string[] {
  const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
  return [...new Set(normalized)].slice(0, 12);
}

function resourceOrderBy(sort?: string): Prisma.ResourceOrderByWithRelationInput[] {
  if (sort === "title") return [{ title: "asc" }, { updatedAt: "desc" }];
  if (sort === "course") return [{ course: { code: "asc" } }, { title: "asc" }];
  if (sort === "oldest") return [{ updatedAt: "asc" }];
  return [{ updatedAt: "desc" }];
}

function metadataSearchWhere(query: string): Prisma.ResourceWhereInput {
  const q = query.trim();
  if (!q) return {};
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { course: { code: { contains: q, mode: "insensitive" } } },
      { course: { title: { contains: q, mode: "insensitive" } } },
      { category: { key: { contains: q, mode: "insensitive" } } },
      { category: { label: { contains: q, mode: "insensitive" } } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      { uploader: { displayName: { contains: q, mode: "insensitive" } } },
      { uploader: { email: { contains: q, mode: "insensitive" } } },
      { versions: { some: { originalFilename: { contains: q, mode: "insensitive" } } } }
    ]
  };
}

const marked = new Marked({
  gfm: true,
  breaks: false
});

function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false });
  return sanitizePreviewHtml(raw);
}

function renderHighlightedCode(text: string, extension: string): string {
  const language = languageForExtension(extension);
  const highlighted =
    language && hljs.getLanguage(language)
      ? hljs.highlight(text, { language, ignoreIllegals: true }).value
      : escapeHtml(text);
  return sanitizePreviewHtml(`<pre><code class="hljs">${highlighted}</code></pre>`);
}

function renderNotebook(source: string): string {
  try {
    const notebook = JSON.parse(source) as { cells?: unknown };
    if (!Array.isArray(notebook.cells)) {
      return sanitizePreviewHtml("<p>Notebook preview is unavailable.</p>");
    }
    const html = notebook.cells
      .map((cell) => renderNotebookCell(cell))
      .filter((cell) => cell.length > 0)
      .join("");
    return sanitizePreviewHtml(html || "<p>Notebook has no previewable cells.</p>");
  } catch {
    return sanitizePreviewHtml("<p>Notebook preview is unavailable.</p>");
  }
}

function renderNotebookCell(cell: unknown): string {
  if (!cell || typeof cell !== "object") return "";
  const record = cell as { cell_type?: unknown; source?: unknown };
  const source = Array.isArray(record.source)
    ? record.source.filter((value): value is string => typeof value === "string").join("")
    : typeof record.source === "string"
      ? record.source
      : "";
  if (!source) return "";
  if (record.cell_type === "markdown") {
    return `<section class="notebook-cell markdown">${renderMarkdown(source)}</section>`;
  }
  return `<section class="notebook-cell code">${renderHighlightedCode(source, ".py")}</section>`;
}

function sanitizePreviewHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "li",
      "ol",
      "p",
      "pre",
      "section",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul"
    ],
    allowedAttributes: {
      a: ["href", "title"],
      code: ["class"],
      pre: ["class"],
      span: ["class"],
      section: ["class"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank"
      })
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function languageForExtension(extension: string): string | null {
  const languages: Record<string, string> = {
    ".c": "c",
    ".cpp": "cpp",
    ".css": "css",
    ".h": "c",
    ".hpp": "cpp",
    ".html": "xml",
    ".java": "java",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "javascript",
    ".py": "python",
    ".sh": "bash",
    ".sql": "sql",
    ".toml": "ini",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".yaml": "yaml",
    ".yml": "yaml"
  };
  return languages[extension] ?? null;
}

async function replaceResourceTags(
  tx: Prisma.TransactionClient,
  resourceId: string,
  tags: string[]
): Promise<void> {
  await tx.resourceTag.deleteMany({ where: { resourceId } });
  for (const tagName of tags) {
    const tag = await tx.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName }
    });
    await tx.resourceTag.create({
      data: {
        resourceId,
        tagId: tag.id
      }
    });
  }
}

function toResourceDto(resource: ResourceRecord): ResourceDto {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    visibility: resource.visibility,
    deletedAt: resource.deletedAt?.toISOString() ?? null,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    course: resource.course,
    category: resource.category,
    uploader: resource.uploader,
    tags: resource.tags.map((resourceTag) => resourceTag.tag.name),
    currentVersion: resource.currentVersion ? toVersionDto(resource.currentVersion) : null,
    versions: resource.versions.map(toVersionDto),
    downloadCount: resource._count.downloads
  };
}

function toVersionDto(
  version: ResourceRecord["versions"][number]
): ResourceDto["versions"][number] {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    originalFilename: version.originalFilename,
    sizeBytes: Number(version.sizeBytes),
    mimeType: version.mimeType,
    sha256: version.sha256,
    createdAt: version.createdAt.toISOString()
  };
}

function randomObjectKey(): string {
  return `resources/${randomUUID()}`;
}

function categoryInvalid(): BadRequestException {
  return new BadRequestException({
    code: "RESOURCE_CATEGORY_INVALID",
    message: "The selected resource category is invalid."
  });
}

function resourceNotFound(): NotFoundException {
  return new NotFoundException({
    code: "RESOURCE_NOT_FOUND",
    message: "Resource not found."
  });
}
