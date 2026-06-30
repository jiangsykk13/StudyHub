import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { cp, mkdtemp } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nextPackagePath = join(root, "apps", "web", "node_modules", "next", "package.json");

if (!existsSync(nextPackagePath)) {
  process.exit(0);
}

const nextVersion = JSON.parse(readFileSync(nextPackagePath, "utf8")).version;
const packageName = swcPackageName();
const targetDir = join(root, "node_modules", "@next", packageName.replace("@next/", ""));

if (existsSync(join(targetDir, "package.json"))) {
  process.exit(0);
}

const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName).replace("%2F", "%2f")}/${nextVersion}`;
const tempDir = await mkdtemp(join(os.tmpdir(), "studyhub-next-swc-"));
const metadataPath = join(tempDir, "metadata.json");
await download(metadataUrl, metadataPath);
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const tarballUrl = metadata.dist?.tarball;
const integrity = metadata.dist?.integrity;

if (typeof tarballUrl !== "string" || typeof integrity !== "string") {
  throw new Error(`Unable to resolve ${packageName}@${nextVersion} from npm metadata.`);
}

mkdirSync(join(root, "node_modules", "@next"), { recursive: true });
const tarballPath = join(tempDir, "package.tgz");
await download(tarballUrl, tarballPath);
verifyIntegrity(tarballPath, integrity);

const extractResult = spawnSync("tar", ["-xzf", tarballPath, "-C", tempDir], {
  stdio: "inherit"
});

if (extractResult.status !== 0) {
  throw new Error(`Unable to extract ${packageName}@${nextVersion}.`);
}

rmSync(targetDir, { recursive: true, force: true });
await cp(join(tempDir, "package"), targetDir, { recursive: true });
rmSync(tempDir, { recursive: true, force: true });
console.log(`Installed ${packageName}@${nextVersion} for local Next.js builds.`);

function swcPackageName() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "@next/swc-win32-x64-msvc";
  if (platform === "win32" && arch === "arm64") return "@next/swc-win32-arm64-msvc";
  if (platform === "darwin" && arch === "x64") return "@next/swc-darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "@next/swc-darwin-arm64";
  if (platform === "linux" && arch === "x64") {
    return isMusl() ? "@next/swc-linux-x64-musl" : "@next/swc-linux-x64-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return isMusl() ? "@next/swc-linux-arm64-musl" : "@next/swc-linux-arm64-gnu";
  }

  throw new Error(`Unsupported Next.js SWC platform: ${platform}/${arch}.`);
}

function isMusl() {
  const report = process.report?.getReport?.();
  return !report?.header?.glibcVersionRuntime;
}

async function readJson(url) {
  const body = await requestBuffer(url);
  return JSON.parse(body.toString("utf8"));
}

async function download(url, destination) {
  if (process.platform === "win32") {
    await downloadWithPowerShell(url, destination);
    return;
  }

  const curl = "curl";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    rmSync(destination, { force: true });
    const result = spawnSync(
      curl,
      [
        "-fsSL",
        "--retry",
        "2",
        "--connect-timeout",
        "20",
        "--max-time",
        "240",
        "-o",
        destination,
        url
      ],
      {
        stdio: "inherit",
        shell: process.platform === "win32",
        timeout: 260000
      }
    );
    if (result.status === 0 && existsSync(destination)) {
      return;
    }
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  const response = await request(url);
  if (response.statusCode !== 200) {
    throw new Error(`Failed to download ${url}: HTTP ${response.statusCode}`);
  }
  await pipeline(response, createWriteStream(destination));
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 180000 }, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        request(new URL(response.headers.location, url).toString()).then(resolve, reject);
        return;
      }
      resolve(response);
    });
    req.on("timeout", () => {
      req.destroy(new Error(`Timed out downloading ${url}`));
    });
    req.on("error", reject);
  });
}

async function downloadWithPowerShell(url, destination) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    rmSync(destination, { force: true });
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri ${JSON.stringify(
          url
        )} -OutFile ${JSON.stringify(destination)} -TimeoutSec 600`
      ],
      {
        stdio: "inherit",
        timeout: 650000
      }
    );
    if (result.status === 0 && existsSync(destination)) {
      return;
    }
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error(`Failed to download ${url} with PowerShell.`);
}

function verifyIntegrity(filePath, integrity) {
  const [algorithm, expected] = integrity.split("-");
  if (algorithm !== "sha512" || !expected) {
    throw new Error(`Unsupported integrity format for ${filePath}.`);
  }

  const digest = createHash("sha512").update(readFileSync(filePath)).digest("base64");
  if (digest !== expected) {
    throw new Error(`Integrity check failed for ${filePath}.`);
  }
}
