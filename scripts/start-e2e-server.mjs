import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const processes = [];
let shuttingDown = false;

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  for (const child of processes) {
    child.kill();
  }
});

await start();

async function start() {
  const apiEntry = resolveApiEntry();
  const api = spawn("node", [apiEntry], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit"
  });
  processes.push(api);
  api.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`API process exited with ${signal ?? code}.`);
      process.exit(code ?? 1);
    }
  });

  await waitForJson("http://localhost:4000/api/health");

  const web = spawn("pnpm", ["--filter", "@studyhub/web", "start"], {
    cwd: workspaceRoot,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });
  processes.push(web);
  web.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`Web process exited with ${signal ?? code}.`);
      process.exit(code ?? 1);
    }
  });

  await waitForJson("http://localhost:3000/api/health");
  await once(web, "exit");
}

function resolveApiEntry() {
  const candidates = [
    join(workspaceRoot, "apps/api/dist/main.js"),
    join(workspaceRoot, "apps/api/dist/src/main.js"),
    join(workspaceRoot, "apps/api/dist/apps/api/src/main.js")
  ];
  const entry = candidates.find((candidate) => existsSync(candidate));
  if (entry) {
    return entry;
  }

  throw new Error(
    `Cannot find the built API entry. Run pnpm build before E2E tests. Tried: ${candidates.join(", ")}`
  );
}

async function waitForJson(url) {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await response.json();
        return;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

function shutdown() {
  shuttingDown = true;
  for (const child of processes) {
    child.kill();
  }
}
