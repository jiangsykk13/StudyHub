import { spawnSync } from "node:child_process";
const databaseUrl = process.env.DATABASE_URL;
const backupFile = process.argv[2];

if (!databaseUrl || !backupFile) {
  throw new Error("Usage: DATABASE_URL=... node scripts/restore-db.mjs <backup-file>");
}
const toolDatabaseUrl = normalizePostgresToolUrl(databaseUrl);

const result = commandExists("pg_restore")
  ? spawnSync("pg_restore", ["--clean", "--if-exists", "--dbname", toolDatabaseUrl, backupFile], {
      stdio: "inherit",
      shell: process.platform === "win32"
    })
  : restoreWithCompose(backupFile, toolDatabaseUrl);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

function commandExists(command) {
  const check = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(check, args, {
    stdio: "ignore",
    shell: process.platform !== "win32"
  });
  return result.status === 0;
}

function normalizePostgresToolUrl(value) {
  const url = new URL(value);
  url.searchParams.delete("schema");
  return url.toString();
}

function restoreWithCompose(backupFile, databaseUrl) {
  const containerFile = `/tmp/${backupFile.split(/[\\/]/).pop()}`;
  const copy = spawnSync("docker", ["compose", "cp", backupFile, `postgres:${containerFile}`], {
    stdio: "inherit"
  });
  if (copy.status !== 0) return copy;
  const restore = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_restore",
      "--clean",
      "--if-exists",
      "--dbname",
      databaseUrl,
      containerFile
    ],
    {
      stdio: "inherit"
    }
  );
  spawnSync("docker", ["compose", "exec", "-T", "postgres", "rm", "-f", containerFile], {
    stdio: "ignore"
  });
  return restore;
}
