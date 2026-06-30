import Busboy from "busboy";
import { PayloadTooLargeException, BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type ParsedUpload = {
  fields: Record<string, string[]>;
  file: {
    tempPath: string;
    originalFilename: string;
    declaredMimeType: string;
    sizeBytes: number;
    sha256: string;
    headerBytes: Buffer;
  };
};

export async function parseMultipartUpload(
  request: Request,
  maxBytes: number
): Promise<ParsedUpload> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !contentType.includes("multipart/form-data")) {
    throw new BadRequestException({
      code: "MULTIPART_REQUIRED",
      message: "A multipart form upload is required."
    });
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string[]> = {};
    let parsedFile: ParsedUpload["file"] | null = null;
    let fileWrite: Promise<void> | null = null;
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      request.unpipe(busboy);
      request.resume();
      void cleanupParsedFile(parsedFile);
      reject(error);
    };

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fields: 30,
        fieldSize: 20_000,
        files: 1,
        fileSize: maxBytes
      }
    });

    busboy.on("field", (name, value) => {
      fields[name] = [...(fields[name] ?? []), value];
    });

    busboy.on("file", (name, file, info) => {
      if (name !== "file" || parsedFile) {
        file.resume();
        fail(
          new BadRequestException({
            code: "UPLOAD_FILE_INVALID",
            message: "Exactly one file field named file is required."
          })
        );
        return;
      }

      const originalFilename = info.filename || "upload.bin";
      const tempPath = path.join(tmpdir(), `studyhub-${randomUUID()}.upload`);
      const output = createWriteStream(tempPath, { flags: "wx" });
      const hash = createHash("sha256");
      const headerChunks: Buffer[] = [];
      let headerLength = 0;
      let sizeBytes = 0;
      let limited = false;

      parsedFile = {
        tempPath,
        originalFilename,
        declaredMimeType: info.mimeType || "application/octet-stream",
        sizeBytes: 0,
        sha256: "",
        headerBytes: Buffer.alloc(0)
      };

      file.on("limit", () => {
        limited = true;
        file.unpipe(output);
        output.destroy();
        file.resume();
        fail(
          new PayloadTooLargeException({
            code: "UPLOAD_TOO_LARGE",
            message: "The uploaded file exceeds the configured size limit."
          })
        );
      });

      file.on("data", (chunk: Buffer) => {
        if (limited) return;
        sizeBytes += chunk.length;
        hash.update(chunk);
        if (headerLength < 512) {
          const remaining = 512 - headerLength;
          const slice = chunk.subarray(0, Math.min(chunk.length, remaining));
          headerChunks.push(slice);
          headerLength += slice.length;
        }
      });

      file.on("error", fail);
      output.on("error", fail);
      file.pipe(output);

      fileWrite = new Promise<void>((fileResolve, fileReject) => {
        output.on("finish", () => {
          if (limited) {
            fileReject(
              new PayloadTooLargeException({
                code: "UPLOAD_TOO_LARGE",
                message: "The uploaded file exceeds the configured size limit."
              })
            );
            return;
          }
          if (parsedFile) {
            parsedFile.sizeBytes = sizeBytes;
            parsedFile.sha256 = hash.digest("hex");
            parsedFile.headerBytes = Buffer.concat(headerChunks, headerLength);
          }
          fileResolve();
        });
      });
    });

    busboy.on("filesLimit", () => {
      fail(
        new BadRequestException({
          code: "TOO_MANY_FILES",
          message: "Only one uploaded file is allowed."
        })
      );
    });

    busboy.on("error", fail);
    busboy.on("finish", () => {
      void (async () => {
        try {
          if (!fileWrite || !parsedFile) {
            throw new BadRequestException({
              code: "UPLOAD_FILE_REQUIRED",
              message: "An uploaded file is required."
            });
          }
          await fileWrite;
          if (settled) return;
          settled = true;
          resolve({ fields, file: parsedFile });
        } catch (error) {
          fail(error instanceof Error ? error : new Error("Upload parsing failed."));
        }
      })();
    });

    request.pipe(busboy);
  });
}

export async function cleanupParsedFile(file: ParsedUpload["file"] | null): Promise<void> {
  if (!file) return;
  await rm(file.tempPath, { force: true });
}
