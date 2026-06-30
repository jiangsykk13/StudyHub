# Backup and Restore

Backups must cover PostgreSQL data and private object storage. A database backup without objects can restore metadata but not file content.

## Database Backup

```bash
pnpm backup:db
```

The script writes a `pg_dump --format=custom` file to `backups/`. It requires `pg_dump` on the operator machine and `DATABASE_URL` in the environment.

## Database Restore

```bash
pnpm restore:db backups/studyhub-db-YYYY-MM-DD.dump
```

Restore into a maintenance window, then run migrations for the target version and the application health checks.

## Object Backup

```bash
pnpm backup:objects
```

The script uses the S3 API to copy each private-bucket object into `backups/objects`. For production S3 providers, use the provider's versioned bucket replication or lifecycle-backed backup features in addition to periodic restore tests.

## Object Restore

```bash
pnpm restore:objects backups/objects
```

The restore script creates the bucket if missing, enables public-access blocking and versioning where supported, and uploads the backup directory into the configured private bucket.

## Restore Exercise

1. Start local infrastructure with `pnpm infra:up`.
2. Apply migrations and seed sample data with `pnpm db:migrate` and `pnpm db:seed`.
3. Verify the seed resource object exists through `GET /api/health/storage` or by opening the seeded material after login.
4. Run `pnpm backup:db` and `pnpm backup:objects`.
5. Restore into a clean local database with `pnpm restore:db <dump-file>`.
6. Restore objects with `pnpm restore:objects backups/objects`.
7. Run `pnpm db:migrate` for the target application version.
8. Verify `GET /api/health/ready`, login, course metadata, notes, resource metadata, and a resource preview/download.

The local Milestone 8 exercise restored the seeded development database and object backup into the same local stack after backup creation, then verified API readiness and seeded users, courses, notes, resource metadata, and object content. Use a separate database and bucket for destructive restore drills outside local development.
