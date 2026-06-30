import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { cp, mkdtemp } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

const nativePackages = [
  {
    sourcePackage: "rollup",
    nativePackage: rollupNativePackage()
  },
  {
    sourcePackage: "turbo",
    nativePackage: turboNativePackage()
  },
  {
    sourcePackage: "esbuild",
    nativePackage: esbuildNativePackage()
  },
  {
    sourcePackage: "lightningcss",
    nativePackage: lightningCssNativePackage()
  },
  {
    sourcePackage: "@tailwindcss/oxide",
    nativePackage: tailwindOxideNativePackage()
  }
];

for (const item of nativePackages) {
  const version = lockedVersion(item.sourcePackage);
  await ensureNativePackage(item.nativePackage, version);
}

function lockedVersion(packageName) {
  const escaped = escapeRegExp(packageName);
  const match = lockfile.match(new RegExp(`\\n\\s{2}'?${escaped}@(\\d[^:'\\n]+)'?:`));

  if (!match?.[1]) {
    throw new Error(`Unable to resolve ${packageName} from pnpm-lock.yaml.`);
  }

  return match[1];
}

async function ensureNativePackage(packageName, version) {
  const targetDir = join(root, "node_modules", ...packageName.split("/"));

  if (existsSync(join(targetDir, "package.json"))) {
    return;
  }

  const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName).replace("%2F", "%2f")}/${version}`;
  const tempDir = await mkdtemp(join(os.tmpdir(), "studyhub-native-tooling-"));
  const metadataPath = join(tempDir, "metadata.json");
  await download(metadataUrl, metadataPath);

  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const tarballUrl = metadata.dist?.tarball;
  const integrity = metadata.dist?.integrity;

  if (typeof tarballUrl !== "string" || typeof integrity !== "string") {
    throw new Error(`Unable to resolve ${packageName}@${version} from npm metadata.`);
  }

  const tarballPath = join(tempDir, "package.tgz");
  await download(tarballUrl, tarballPath);
  verifyIntegrity(tarballPath, integrity);

  const extractResult = spawnSync("tar", ["-xzf", tarballPath, "-C", tempDir], {
    stdio: "inherit"
  });

  if (extractResult.status !== 0) {
    throw new Error(`Unable to extract ${packageName}@${version}.`);
  }

  mkdirSync(dirname(targetDir), { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  await cp(extractedPackageDir(tempDir), targetDir, { recursive: true });
  rmSync(tempDir, { recursive: true, force: true });
  console.log(`Installed ${packageName}@${version} for native tooling.`);
}

function extractedPackageDir(tempDir) {
  const entry = readdirSync(tempDir, { withFileTypes: true }).find((item) => {
    return item.isDirectory() && existsSync(join(tempDir, item.name, "package.json"));
  });

  if (!entry) {
    throw new Error(`Unable to find extracted package directory in ${tempDir}.`);
  }

  return join(tempDir, entry.name);
}

function rollupNativePackage() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "@rollup/rollup-win32-x64-msvc";
  if (platform === "win32" && arch === "arm64") return "@rollup/rollup-win32-arm64-msvc";
  if (platform === "darwin" && arch === "x64") return "@rollup/rollup-darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "@rollup/rollup-darwin-arm64";
  if (platform === "linux" && arch === "x64") {
    return isMusl() ? "@rollup/rollup-linux-x64-musl" : "@rollup/rollup-linux-x64-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return isMusl() ? "@rollup/rollup-linux-arm64-musl" : "@rollup/rollup-linux-arm64-gnu";
  }

  throw new Error(`Unsupported Rollup platform: ${platform}/${arch}.`);
}

function turboNativePackage() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "@turbo/windows-64";
  if (platform === "win32" && arch === "arm64") return "@turbo/windows-arm64";
  if (platform === "darwin" && arch === "x64") return "@turbo/darwin-64";
  if (platform === "darwin" && arch === "arm64") return "@turbo/darwin-arm64";
  if (platform === "linux" && arch === "x64") return "@turbo/linux-64";
  if (platform === "linux" && arch === "arm64") return "@turbo/linux-arm64";

  throw new Error(`Unsupported Turborepo platform: ${platform}/${arch}.`);
}

function esbuildNativePackage() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "@esbuild/win32-x64";
  if (platform === "win32" && arch === "arm64") return "@esbuild/win32-arm64";
  if (platform === "darwin" && arch === "x64") return "@esbuild/darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "@esbuild/darwin-arm64";
  if (platform === "linux" && arch === "x64") return "@esbuild/linux-x64";
  if (platform === "linux" && arch === "arm64") return "@esbuild/linux-arm64";

  throw new Error(`Unsupported esbuild platform: ${platform}/${arch}.`);
}

function lightningCssNativePackage() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "lightningcss-win32-x64-msvc";
  if (platform === "win32" && arch === "arm64") return "lightningcss-win32-arm64-msvc";
  if (platform === "darwin" && arch === "x64") return "lightningcss-darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "lightningcss-darwin-arm64";
  if (platform === "linux" && arch === "x64") {
    return isMusl() ? "lightningcss-linux-x64-musl" : "lightningcss-linux-x64-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return isMusl() ? "lightningcss-linux-arm64-musl" : "lightningcss-linux-arm64-gnu";
  }

  throw new Error(`Unsupported lightningcss platform: ${platform}/${arch}.`);
}

function tailwindOxideNativePackage() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "@tailwindcss/oxide-win32-x64-msvc";
  if (platform === "win32" && arch === "arm64") return "@tailwindcss/oxide-win32-arm64-msvc";
  if (platform === "darwin" && arch === "x64") return "@tailwindcss/oxide-darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "@tailwindcss/oxide-darwin-arm64";
  if (platform === "linux" && arch === "x64") {
    return isMusl() ? "@tailwindcss/oxide-linux-x64-musl" : "@tailwindcss/oxide-linux-x64-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return isMusl() ? "@tailwindcss/oxide-linux-arm64-musl" : "@tailwindcss/oxide-linux-arm64-gnu";
  }

  throw new Error(`Unsupported Tailwind Oxide platform: ${platform}/${arch}.`);
}

function isMusl() {
  const report = process.report?.getReport?.();
  return !report?.header?.glibcVersionRuntime;
}

async function download(url, destination) {
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
