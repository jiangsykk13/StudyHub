# Architecture

StudyHub is a same-origin private student material-sharing system. The repository follows the target monorepo layout from `AGENTS.md`.

## Runtime Shape

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS REST API under `/api`.
- `packages/config`: typed environment and branding configuration.
- `packages/shared`: shared Zod schemas, upload rules, and authorization policy helpers.
- `packages/ui`: small reusable UI primitives shared by the web app.
- `prisma`: database schema, migrations, and deterministic seed.
- `docker-compose.yml`: PostgreSQL, private MinIO, and bucket initialization for local development.

## Security Decisions

- Authentication uses opaque session cookies. Only a SHA-256 hash of the random session token is stored.
- CSRF uses a same-site readable CSRF cookie plus an `x-csrf-token` header and trusted-origin checks for unsafe methods.
- Object storage is private. The API authorizes access before returning short-lived presigned URLs.
- Uploads are streamed through a Busboy parser to temporary files while hashing, validated, then streamed to MinIO/S3 under random object keys.
- Invitation codes are generated or accepted as raw strings only at creation time and stored as hashes.
- Upload object keys are random and never include the original filename.
- Markdown and notebook previews are sanitized before rendering; source and text previews are escaped.
- Notes are rendered server-side from Markdown into sanitized HTML. KaTeX output is restricted to HTML spans, code blocks are highlighted without executing code, and Mermaid source is sanitized before the web client renders diagrams with Mermaid strict security settings.
- Favorites are protected by API visibility checks and database partial unique indexes for resource and note targets.
- Administration APIs are split by concern: user administration is system-admin-only, while resource moderation and audit listing support course-admin scoped views. Audit entries are append-only database records used for operational review.
- Health endpoints distinguish shallow API liveness from readiness. `/api/health/ready` checks both PostgreSQL and the private object bucket before reporting ready.

## Scope Decisions

- Office files and ZIP archives are download-only in the MVP.
- Batch download is deferred to avoid unsafe memory-heavy archive generation.
- Search uses PostgreSQL metadata queries, not an external search service.
- The frontend relies on the API for authoritative authorization; hidden buttons are never the only protection.
- The profile/dashboard summary is a read model over existing user-owned uploads, notes, favorites, and quota usage; it does not introduce a separate analytics store.
- Resource moderation remains soft-delete based in the MVP; permanent object cleanup is left to an explicit maintenance workflow after retention.
- Browser E2E tests run serially because they exercise real registrations, uploads, sessions, notes, and administrator mutations against the same local stack.
