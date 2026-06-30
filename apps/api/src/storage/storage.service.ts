import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadApiConfig } from "@studyhub/config";
import { Readable } from "node:stream";

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly downloadTtlSeconds: number;
  private readonly client: S3Client;

  constructor() {
    const config = loadApiConfig();
    this.bucket = config.S3_BUCKET;
    this.downloadTtlSeconds = config.S3_PRESIGNED_TTL_SECONDS;
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY
      }
    });
  }

  async assertBucketReady(): Promise<{ bucket: string; status: "ok" }> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { bucket: this.bucket, status: "ok" };
    } catch {
      throw new ServiceUnavailableException({
        code: "STORAGE_UNAVAILABLE",
        message: "Object storage is unavailable."
      });
    }
  }

  async putObject(input: {
    key: string;
    body: Readable;
    contentType: string;
    contentLength: number;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength
      })
    );
  }

  async createDownloadUrl(input: {
    key: string;
    originalFilename: string;
    contentType: string;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ResponseContentType: input.contentType,
      ResponseContentDisposition: `attachment; filename="${sanitizeFilename(input.originalFilename)}"`
    });
    return {
      url: await getSignedUrl(this.client, command, {
        expiresIn: this.downloadTtlSeconds
      }),
      expiresInSeconds: this.downloadTtlSeconds
    };
  }

  async createInlineUrl(input: { key: string; contentType: string }): Promise<{
    url: string;
    expiresInSeconds: number;
  }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ResponseContentType: input.contentType,
      ResponseContentDisposition: "inline"
    });
    return {
      url: await getSignedUrl(this.client, command, {
        expiresIn: this.downloadTtlSeconds
      }),
      expiresInSeconds: this.downloadTtlSeconds
    };
  }

  async readObjectBytes(
    key: string,
    maxBytes: number
  ): Promise<{ bytes: Buffer; truncated: boolean }> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
    if (!response.Body || !(response.Body instanceof Readable)) {
      throw new ServiceUnavailableException({
        code: "STORAGE_READ_UNAVAILABLE",
        message: "Object storage did not return a readable stream."
      });
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        return {
          bytes: Buffer.concat(chunks, Math.max(0, total - buffer.length)),
          truncated: true
        };
      }
      chunks.push(buffer);
    }
    return { bytes: Buffer.concat(chunks, total), truncated: false };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/["\r\n]/g, "_");
}
