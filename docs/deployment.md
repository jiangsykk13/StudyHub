# Deployment

Production deployments should keep the browser, web app, and API on a same-origin topology such as:

```text
https://studyhub.example.edu/        -> Next.js web
https://studyhub.example.edu/api/*   -> NestJS API
```

Use a reverse proxy such as Nginx, Caddy, or a managed ingress to route `/api` to the API container and all other paths to the web container.

## Required Production Settings

- Replace all `.env.example` secrets with high-entropy production values.
- Use PostgreSQL with managed backups or a tested self-hosted backup schedule.
- Use a private S3-compatible bucket. Do not enable public object access.
- Set `NODE_ENV=production`, HTTPS-only origins, and secure cookie settings.
- Keep `TRUSTED_ORIGINS` limited to the production origin and any explicitly approved admin origin.
- Run `pnpm db:migrate` before starting new application versions.
- Store application logs in a system that supports filtering without exposing secrets.

## Containers

`apps/api/Dockerfile` and `apps/web/Dockerfile` build reproducible production images. Build them from the repository root so workspace packages and Prisma schema are available.

```bash
docker build -f apps/api/Dockerfile -t studyhub-api:local .
docker build -f apps/web/Dockerfile -t studyhub-web:local .
```

Run database migrations before replacing running containers:

```bash
pnpm db:migrate
```

## Health Checks

- `GET /api/health` is a shallow API liveness check.
- `GET /api/health/ready` checks PostgreSQL and the private object bucket and should be used for readiness/load-balancer admission.
- `GET /api/health/database` and `GET /api/health/storage` are component checks for operators.

## Reverse Proxy Notes

- Route `/api/*` to the API container and all other paths to the web container.
- Preserve the original `Host`, `X-Forwarded-Proto`, and `X-Forwarded-For` headers.
- Terminate TLS at the proxy or managed ingress; production cookies are `Secure` when `NODE_ENV=production`.
- Keep uploads within the configured `MAX_UPLOAD_BYTES` and set proxy body-size/timeouts accordingly.

## CI

GitHub Actions installs dependencies with the lockfile, prepares PostgreSQL and the private MinIO bucket, applies migrations to development and test databases, seeds sample data, runs `pnpm verify`, and then runs `pnpm test:e2e`.
