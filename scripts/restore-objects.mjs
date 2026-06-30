import {
  CreateBucketCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const bucket = process.env.S3_BUCKET ?? "studyhub-private";
const sourceRoot = process.argv[2] ?? "backups/objects";
const client = createClient();

if (!existsSync(sourceRoot)) {
  throw new Error(`Object backup directory does not exist: ${sourceRoot}`);
}

await ensurePrivateBucket();

let restored = 0;
for (const path of walkFiles(sourceRoot)) {
  const key = relative(sourceRoot, path).replaceAll("\\", "/");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(path)
    })
  );
  restored += 1;
}

console.log(`Object restore copied ${restored} object(s) into ${bucket}`);

async function ensurePrivateBucket() {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
      throw error;
    }
  }
  await sendBestEffort(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true
      }
    })
  );
  await sendBestEffort(
    new PutBucketVersioningCommand({
      Bucket: bucket,
      VersioningConfiguration: {
        Status: "Enabled"
      }
    })
  );
}

async function sendBestEffort(command) {
  try {
    await client.send(command);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (
      name !== "NotImplemented" &&
      name !== "MalformedXML" &&
      name !== "MethodNotAllowed" &&
      name !== "InvalidRequest"
    ) {
      throw error;
    }
  }
}

function* walkFiles(root) {
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (stat.isFile()) {
      yield fullPath;
    }
  }
}

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
