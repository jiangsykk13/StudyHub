import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for database backup.");
}
const toolDatabaseUrl = normalizePostgresToolUrl(databaseUrl);

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const output = join("backups", `studyhub-db-${stamp}.dump`);
const result = commandExists("pg_dump")
  ? spawnSync("pg_dump", ["--format=custom", "--file", output, toolDatabaseUrl], {
      stdio: "inherit",
      shell: process.platform === "win32"
    })
  : backupWithCompose(output, toolDatabaseUrl);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Database backup written to ${output}`);

function commandExists(command) {
  const check = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(check, args, {
    stdio: "ignore",
    shell: process.platform !== "win32"
  });
  return result.status === 0;
}

function backupWithCompose(output, databaseUrl) {
  const containerFile = `/tmp/${output.split(/[\\/]/).pop()}`;
  const dump = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_dump",
      "--format=custom",
      "--file",
      containerFile,
      databaseUrl
    ],
    {
      stdio: "inherit"
    }
  );
  if (dump.status !== 0) return dump;
  const copy = spawnSync("docker", ["compose", "cp", `postgres:${containerFile}`, output], {
    stdio: "inherit"
  });
  spawnSync("docker", ["compose", "exec", "-T", "postgres", "rm", "-f", containerFile], {
    stdio: "ignore"
  });
  return copy;
}

function normalizePostgresToolUrl(value) {
  const url = new URL(value);
  url.searchParams.delete("schema");
  return url.toString();
}
