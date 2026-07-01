# StudyHub

StudyHub is an invitation-only private learning-material sharing platform for small student groups. It uses a pnpm/Turborepo monorepo with a Next.js web app, a NestJS API, PostgreSQL through Prisma, and private S3-compatible object storage through MinIO for local development.

## Local Setup

1. Install Node.js 24+, pnpm 11+, and Docker.
2. On Windows, run the local startup script from the repository root:

```powershell
.\start-local.cmd
```

The script creates `.env` from `.env.example` when missing, uses `pnpm` or `corepack pnpm`, starts PostgreSQL and MinIO, applies migrations, seeds development data, and starts the API and web apps.

Useful options:

```powershell
.\start-local.cmd -NoDev
.\start-local.cmd -SkipInstall
.\start-local.cmd -ForceInstall
.\start-local.cmd -SkipMigrate -SkipSeed
```

3. Manual setup is also available. Copy `.env.example` to `.env` and replace secrets before any shared deployment.
4. Install dependencies:

```bash
pnpm install
```

5. Start PostgreSQL and MinIO:

```bash
pnpm infra:up
```

6. Apply migrations and seed development data:

```bash
pnpm db:migrate
pnpm db:seed
```

7. Start the API and web apps:

```bash
pnpm dev
```

The web app runs at `http://localhost:3000`. The API runs at `http://localhost:4000/api`, and OpenAPI documentation is available at `http://localhost:4000/api/docs` in development.

## Verification Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

`pnpm verify` runs formatting, linting, type checking, unit tests, integration tests, and production builds. Browser E2E tests are a separate command because they require the local stack to be running.

## Seed Accounts

Seed account emails and development-only passwords are read from `.env`. The example file contains safe local placeholders only. Do not reuse them in production.

The seed also creates a development invitation code from `SEED_INVITATION_CODE`. Invitation codes are stored only as hashes in PostgreSQL.

## Documentation

- [Architecture](docs/architecture.md)
- [Permissions](docs/permissions.md)
- [API](docs/api.md)
- [Deployment](docs/deployment.md)
- [Backup and restore](docs/backup-restore.md)
- [Progress log](docs/progress.md)
