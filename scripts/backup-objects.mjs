import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const bucket = process.env.S3_BUCKET ?? "studyhub-private";
const client = createClient();
const outputRoot = process.argv[2] ?? "backups/objects";

mkdirSync(outputRoot, { recursive: true });

let continuationToken;
let copied = 0;
do {
  const page = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken
    })
  );
  for (const object of page.Contents ?? []) {
    if (!object.Key) continue;
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }));
    if (!response.Body) {
      throw new Error(`Object ${object.Key} did not return a readable body.`);
    }
    const outputPath = join(outputRoot, ...object.Key.split("/"));
    mkdirSync(dirname(outputPath), { recursive: true });
    await pipeline(response.Body, createWriteStream(outputPath));
    copied += 1;
  }
  continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (continuationToken);

console.log(`Object backup copied ${copied} object(s) into ${outputRoot}`);

function createClient() {
  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required.");
  }
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}
