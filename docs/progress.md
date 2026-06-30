# Project Progress Timeline

This document is the English append-only timeline of project changes. Add a new dated entry for each code or documentation update, and add the matching Chinese entry to `docs/progress.zh-CN.md`. Keep entries in chronological order from oldest to newest, with the newest entry at the end. Keep entries focused on what changed for users or operators, what capability was added or improved, and what could be optimized later.

## 2026-06-27

### Change

- Added a project rule requiring every future change to be recorded in this timeline.
- Created this progress document as the single place for ongoing change history.

### Functional Outcome

- Future work now has a consistent record of what was added or improved.
- Project progress can be reviewed chronologically without losing earlier entries.

### Future Optimization

- As the project grows, entries can be grouped by milestone or release while preserving the timeline order.

## 2026-06-27 — Milestone 0 scaffold

### Current milestone

- milestone: Milestone 1 — Infrastructure, schema, and seed
- status: in progress
- last verified commit/state: uncommitted scaffold with pnpm/Turborepo, Next.js, NestJS, shared packages, Prisma schema, Docker Compose skeleton, docs, and CI skeleton

### Completed

- Added the pnpm workspace, Turborepo pipeline, strict TypeScript, ESLint, Prettier, `.gitignore`, `.npmrc`, `.env.example`, and root commands required by `AGENTS.md`.
- Added `apps/api` with a real NestJS health endpoint and safe error filter.
- Added `apps/web` with Next.js App Router routes for the required MVP navigation surface.
- Added shared config, policy/schema, UI, and ESLint workspace packages.
- Added the full initial Prisma domain schema and committed initial SQL migration file.
- Added Docker Compose PostgreSQL/MinIO services and initial backup/deployment/operator documentation.
- Added a verified Next SWC bootstrap helper because this environment times out when pnpm fetches Next optional native packages; the helper verifies npm integrity before extracting the exact package.
- Verification command and result: `pnpm install` passed.
- Verification command and result: `pnpm db:generate` passed with `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public`.
- Verification command and result: `pnpm format:check` passed.
- Verification command and result: `pnpm lint` passed.
- Verification command and result: `pnpm typecheck` passed.
- Verification command and result: `pnpm test` passed.
- Verification command and result: `pnpm build` passed.

### In progress

- Validate local infrastructure startup, migrations, seed idempotence, API database/storage health, and private MinIO bucket behavior.
- Next concrete action: start Docker Compose services and apply the initial migration to an empty database.

### Decisions and assumptions

- Decision: keep the product name centralized in `packages/config`.
- Reason: the project requires the placeholder brand `StudyHub` to remain configurable.
- Decision: use PostgreSQL metadata search and private MinIO/S3 storage boundaries; no external search service or public object URLs.
- Reason: required by the MVP security and scope constraints.
- Decision: set pnpm `optional=false` and add `scripts/ensure-next-swc.mjs`.
- Reason: pnpm optional native SWC fetch repeatedly timed out in this Windows environment, while direct verified npm tarball download succeeds. The helper preserves a passing `pnpm install` and production build without committing binaries.

### Blockers

- exact command: none for Milestone 0 after the SWC workaround.
- concise error: initial `pnpm install` and Next build attempts timed out while fetching `@next/swc-win32-x64-msvc`; resolved with `.npmrc` and verified bootstrap helper.
- attempted fixes: npmjs registry override, offline install, pnpm store add, direct tarball download, then verified SWC bootstrap.
- minimum input required: none.

### Deferred non-MVP work

- Batch downloads remain deferred until single-file authorization, download auditing, and storage streaming are complete.
- Remove the Next SWC bootstrap if pnpm optional dependency fetching becomes reliable in the target development environment.

## 2026-06-27 — Milestone 1 infrastructure, schema, and seed

### Current milestone

- milestone: Milestone 2 — Authentication and global authorization
- status: in progress
- last verified commit/state: uncommitted Milestone 1 with running Docker Compose services, applied initial migration, idempotent seed, and real API health checks for PostgreSQL and MinIO

### Completed

- Started Docker Desktop locally and verified Docker Engine `29.4.3`.
- Pulled and pinned valid local infrastructure images: `postgres:17-alpine`, `minio/minio:RELEASE.2025-06-13T11-33-47Z`, and `minio/mc:RELEASE.2025-08-13T08-35-41Z`.
- Started Docker Compose services for PostgreSQL and MinIO; both core services reported healthy.
- Verified the bucket initialization container created `studyhub-private`, kept it private, and enabled bucket versioning.
- Applied the committed initial Prisma migration to an empty `studyhub` database.
- Updated the seed to create users, courses, memberships, categories, tags, invitations, a resource, note data, audit data, and the harmless sample Markdown object in MinIO.
- Verified `pnpm db:seed` is safe to rerun by running it twice successfully.
- Added API health checks for `/api/health/database` and `/api/health/storage`.
- Verification command and result: `pnpm infra:up` passed after correcting the MinIO client image tag and allowing longer Docker image pulls.
- Verification command and result: `pnpm db:migrate` passed against `postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public`.
- Verification command and result: `pnpm db:seed; pnpm db:seed` passed with MinIO environment variables set.
- Verification command and result: `docker compose run --rm --entrypoint /bin/sh minio-init -c "mc alias set local http://minio:9000 studyhub_minio studyhub_minio_dev_password >/dev/null && mc stat local/studyhub-private/seed/resources/limits-review.md"` passed and reported the 76 B Markdown seed object.
- Verification command and result: unsigned `GET http://localhost:9000/studyhub-private/seed/resources/limits-review.md` returned `403`.
- Verification command and result: API `GET /api/health`, `GET /api/health/database`, and `GET /api/health/storage` each returned `200`.
- Verification command and result: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed after Milestone 1 changes.

### In progress

- Implement invitation-based registration, Argon2id login, opaque server-side sessions, CSRF/origin defenses, user disabling/session revocation, and protected UI flows.
- Next concrete action: add the NestJS auth module, session guard, CSRF/origin guard, and endpoint tests for registration/login/logout/current-user behavior.

### Decisions and assumptions

- Decision: keep MinIO buckets private and verify seed object access through `mc stat`, not a public URL.
- Reason: direct object URLs must not expose course files to anonymous users.
- Decision: store seed invitation codes only as SHA-256 hashes.
- Reason: invitation codes are secrets under the project security contract.
- Decision: course-admin remains course-scoped through `CourseMember.role`.
- Reason: global `SYSTEM_ADMIN` is separate from course administration.

### Blockers

- exact command: initial `pnpm infra:up`
- concise error: `minio/mc:RELEASE.2025-06-13T11-33-47Z: not found`
- attempted fixes: queried Docker Hub tags, selected `minio/mc:RELEASE.2025-08-13T08-35-41Z`, retried Compose successfully.
- minimum input required: none.
- exact command: initial short `docker pull postgres:17-alpine`
- concise error: command timed out during registry transfer.
- attempted fixes: stopped stale pull process and retried with a longer timeout; pull completed successfully.
- minimum input required: none.

### Deferred non-MVP work

- None added in this milestone.

## 2026-06-27 — Milestone 2 authentication and global authorization

### Current milestone

- milestone: Milestone 3 — Semesters, courses, memberships, and invitations
- status: in progress
- last verified commit/state: uncommitted Milestone 2 with working invitation registration, login/logout, opaque sessions, CSRF/origin checks, admin user disabling, route protection, and integration tests

### Completed

- Added the NestJS auth module for CSRF token issuance, invitation registration, login, logout, and current-user lookup.
- Added Argon2id password verification and cryptographically random opaque session tokens stored only as SHA-256 hashes.
- Added global authentication and CSRF/origin guards so protected API endpoints fail closed unless explicitly marked public.
- Added system-admin user disable, enable, and session-revocation endpoints with audit records.
- Added browser login, registration, logout, same-origin API rewrites, and middleware route protection for the Next.js app.
- Added auth token unit tests and real database-backed auth integration tests for registration, invalid invitations, login, logout, disabled-user enforcement, and session invalidation.
- Updated Turborepo environment passthrough so database, storage, cookie, and origin settings reach package tasks during verification.
- Verification command and result: API smoke for `GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, and a post-logout `GET /api/auth/me` passed with expected `200/201/200/201/401` behavior.
- Verification command and result: registration with `DEV-INVITE-STUDYHUB-ONLY` succeeded, an invalid invitation returned `403`, admin disabling returned `201`, disabled-user login returned `401`, and cleanup re-enable returned `201`.
- Verification command and result: same-origin web smoke verified anonymous `/dashboard` redirects to `/login`, `/api/auth/login` through the web origin succeeds, `/api/auth/me` returns the logged-in user, and authenticated `/dashboard` renders.
- Verification command and result: `pnpm format:check` passed.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.
- Verification detail: `pnpm verify` completed formatting, linting, type checking, unit tests, integration tests, Prisma client generation, and production builds for API and web.

### In progress

- Implement semester, course, membership, and invitation management APIs and UI using the existing Prisma schema.
- Next concrete action: inspect current auth/policy helpers, then add course-scoped authorization helpers and CRUD endpoints for Milestone 3.

### Decisions and assumptions

- Decision: CSRF uses a readable signed CSRF cookie plus matching `x-csrf-token` header and trusted-origin enforcement for unsafe methods.
- Reason: the app uses same-origin cookie sessions, so browser state changes need explicit CSRF and origin defenses.
- Decision: session cookies are HttpOnly, SameSite=Lax, path-scoped, and Secure only in production.
- Reason: local HTTP development must work, while production cookies must not be sent over cleartext HTTP.
- Decision: Turborepo receives runtime environment through `globalPassThroughEnv`.
- Reason: strict environment filtering was hiding `DATABASE_URL` from integration tests even though the shell had it set.

### Blockers

- exact command: initial `DATABASE_URL=... TEST_DATABASE_URL=... pnpm verify`
- concise error: API integration tests failed because Turborepo filtered `DATABASE_URL`/`TEST_DATABASE_URL` from the package task environment.
- attempted fixes: added the required runtime variables to `turbo.json` `globalPassThroughEnv` and hardened test teardown with optional app close.
- minimum input required: none.

### Deferred non-MVP work

- None added in this milestone.

## 2026-06-27 — Milestone 3 semesters, courses, memberships, and invitations

### Current milestone

- milestone: Milestone 4 — Resource upload, versioning, and download
- status: in progress
- last verified commit/state: uncommitted Milestone 3 with real semester/course CRUD APIs, course-scoped membership administration, invitation creation/revocation, dashboard/course/admin UI pages, and passing full verification

### Completed

- Added reusable API authorization policy helpers that adapt authenticated sessions to the shared permission functions.
- Added semester APIs for list, create, update, and archive with system-admin-only mutation.
- Added course APIs for scoped course listing, course detail, system-admin course create/update/archive, and course-admin membership role changes.
- Added invitation APIs for system-admin all-site invitations, course-scoped invitations, invitation listing, and revocation.
- Tightened registration so invitation usage is checked and incremented in the same transaction that creates the user and membership.
- Added dashboard, courses, course detail, profile, admin course management, and admin invitation management pages backed by authenticated API calls.
- Hid the Administration navigation item unless the current API user is a system administrator.
- Added CSRF-protected client actions for course invitations, invitation revocation, member role changes, semester creation, course creation, and course archival.
- Updated API and permission documentation for the Milestone 3 endpoints and enforcement rules.
- Tests added: `apps/api/test/courses-invitations.integration.test.ts` covers system-admin course management, member denial, course-admin own-course scope, cross-course denial, read-only mutation denial, one-time invitation code handling, hashed storage, expiry, revocation, and usage limits.
- Database migrations added: none; the initial Milestone 1 schema already modeled `Semester`, `Course`, `CourseMember`, and `Invitation`.
- Verification command and result: `pnpm --filter @studyhub/api typecheck` passed after adding the new modules.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api test:integration` passed with 2 integration files and 5 tests.
- Verification command and result: live web smoke after admin login returned `200` for `/dashboard`, `/courses`, `/courses/:courseId`, `/admin/courses`, and `/admin/invitations`.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.
- Verification detail: `pnpm verify` completed formatting, linting, type checking, unit tests, integration tests, Prisma client generation, and production builds for API and web.

### In progress

- Implement resource metadata, upload, immutable versions, private object storage writes, duplicate detection, and authorized download URLs.
- Next concrete action: inspect the storage service and resource schema, then add a streamed upload API with server-side validation and MinIO writes.

### Decisions and assumptions

- Decision: course CRUD remains system-admin-only; course administrators manage memberships and invitations inside their own course.
- Reason: `CODEX_GOAL.md` requires semester/course CRUD for system administrators and course-admin scope for course-local administration.
- Decision: invitation list and revoke responses never include raw invitation codes or code hashes.
- Reason: invitation codes are secrets and should only be visible once at creation.
- Decision: course-admin and system-admin UI actions use the same API endpoints as direct clients.
- Reason: hiding controls is only usability; server-side authorization remains the enforcement boundary.

### Blockers

- exact command: none for Milestone 3.
- concise error: none after fixing strict TypeScript optional-property handling and formatting.
- attempted fixes: rebuilt the shared package declarations, normalized optional request fields, applied Prettier, and removed one unused import.
- minimum input required: none.

### Deferred non-MVP work

- Adding new members by user search is deferred to the full administration milestone; current membership UI supports role changes for existing members and invitation-based onboarding for new users.

## 2026-06-27 — Milestone 4 resource upload, versioning, and download

### Current milestone

- milestone: Milestone 5 — Search, browsing, and previews
- status: in progress
- last verified commit/state: uncommitted Milestone 4 with streaming resource upload, private MinIO object writes, immutable versions, duplicate/quota/type checks, authorized presigned downloads, material UI pages, and passing full verification

### Completed

- Added `busboy` as an explicit API dependency for streaming multipart parsing.
- Added resource upload parsing that streams to a temporary file, computes SHA-256 during the stream, captures header bytes for signature checks, and enforces the configured upload size limit.
- Added resource APIs for category listing, visible resource listing, upload/create, detail, metadata update, immutable version creation, authorized download URL generation, soft delete, and restore.
- Added upload validation for blocked executable extensions, allowed extension checks, basic file signature/MIME checks for PDF/images/ZIP-family files, and text-like checks for Markdown, text, source, and notebooks.
- Added per-user storage quota enforcement and exact duplicate rejection within the same course.
- Added private MinIO/S3 object writes using random object keys that do not include original filenames.
- Added short-lived presigned download URLs and `DownloadRecord` creation after authorization.
- Added object cleanup on database transaction failure after a storage write.
- Added material index, upload, and detail pages with current version metadata, tags, version history, download action, new-version upload, soft delete, and restore.
- Updated API, architecture, and permission documentation for resource storage and authorization behavior.
- Tests added: `apps/api/test/resources.integration.test.ts` covers authorized upload, direct private-object denial, signed download, immutable version preservation, read-only denial, blocked executable upload, oversized rejection, duplicate rejection, and quota enforcement against local PostgreSQL and MinIO.
- Database migrations added: none; the initial Milestone 1 schema already modeled resources, versions, categories, tags, downloads, and audit logs.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api exec vitest run --config vitest.integration.config.ts test/resources.integration.test.ts` passed with 1 file and 2 tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api test:integration` passed with 3 files and 7 tests.
- Verification command and result: live web smoke after member login returned `200` for `/materials`, `/materials/upload`, and `/materials/00000000-0000-4000-8000-000000000001`.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.
- Verification detail: `pnpm verify` completed formatting, linting, type checking, unit tests, integration tests, Prisma client generation, and production builds for API and web.

### In progress

- Implement metadata search, filtering, sorting/pagination, and safe preview rendering for supported files.
- Next concrete action: add resource search query handling and authorized preview endpoints for Markdown, images, PDF, text/source, and unsupported-download-only states.

### Decisions and assumptions

- Decision: uploads stream to a temporary file before object storage upload.
- Reason: this allows SHA-256 duplicate detection and quota validation before writing a new private object while avoiding loading large files into memory.
- Decision: exact duplicate resources in the same course are rejected with a conflict response.
- Reason: the product flow permits reject-or-warn; rejection is simpler and safer for the MVP.
- Decision: resource downloads use `POST /api/resources/:resourceId/download`.
- Reason: the endpoint records a download and returns a short-lived signed URL after authorization.

### Blockers

- exact command: initial `pnpm --filter @studyhub/api test:integration` after adding resource tests.
- concise error: oversized upload test timed out because the Busboy file-size limit handler destroyed the temp write stream without rejecting the parser promise.
- attempted fixes: changed the limit handler to fail immediately with `UPLOAD_TOO_LARGE`, clean up the temp file, and return HTTP `413`; reran the single resource test and full integration suite successfully.
- minimum input required: none.

### Deferred non-MVP work

- Batch downloads remain deferred.

## 2026-06-27 — Milestone 5 search, browsing, and previews

### Current milestone

- milestone: Milestone 6 — Notes, revisions, favorites, and profile
- status: in progress
- last verified commit/state: uncommitted Milestone 5 with metadata search, filters, pagination, sanitized previews, image/PDF signed preview URLs, and passing full verification

### Completed

- Added metadata search for title, description, course code/title, category key/label, tags, uploader name/email, and original filenames.
- Added category/tag filters, page/page-size pagination, and sort modes for newest, oldest, title, and course.
- Fixed the resource search builder so metadata filters and authorization visibility rules compose with `AND` instead of one `OR` overwriting the other.
- Added authorized `GET /api/resources/:resourceId/preview`.
- Added preview states for PDF and images using short-lived inline presigned URLs.
- Added sanitized server-rendered Markdown previews using `marked` and `sanitize-html`.
- Added escaped/highlighted text and source previews using `highlight.js`.
- Added read-only notebook previews by rendering Markdown/source cells without executing kernels or outputs.
- Added download-only unsupported preview states for ZIP and Office files.
- Added filtered materials UI with query, category, sort, pagination, and preview rendering on material detail pages.
- Updated API and permission documentation for search and preview behavior.
- Dependencies added: `marked`, `sanitize-html`, `highlight.js`, and `@types/sanitize-html`.
- Tests added: expanded `apps/api/test/resources.integration.test.ts` to cover scoped metadata search, tag filtering, sanitized Markdown, image preview URL generation, unsupported ZIP preview state, and unauthorized preview denial.
- Database migrations added: none.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api exec vitest run --config vitest.integration.config.ts test/resources.integration.test.ts` passed with 1 file and 3 tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api test:integration` passed with 3 files and 8 tests.
- Verification command and result: live web smoke after member login returned `200` for `/materials?q=limits&sort=title` and `/materials/00000000-0000-4000-8000-000000000001`.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.

### In progress

- Implement notes, revisions, favorites, and richer profile/dashboard data.
- Next concrete action: add sanitized note APIs for drafts, publish/update, revision restore, and unique favorites.

### Decisions and assumptions

- Decision: preview HTML is generated and sanitized server-side before the web app renders it.
- Reason: uploaded Markdown/notebook/source content must not become an executable HTML surface.
- Decision: PDF and image previews use short-lived inline presigned URLs rather than permanent object URLs.
- Reason: private object storage remains the security boundary.
- Decision: notebooks are rendered as read-only Markdown/source cells only.
- Reason: executing uploaded notebooks is explicitly out of scope and unsafe.

### Blockers

- exact command: initial resource preview/search integration test run.
- concise error: query results ignored `q` because the visibility `OR` replaced the metadata-search `OR`; after fixing that, the test query still matched the course code because the token reused the seeded course suffix.
- attempted fixes: composed filters with `AND` plus a visibility `OR`, then changed the test search token to a fresh random value that appears only in the target resource metadata.
- minimum input required: none.

### Deferred non-MVP work

- Full-text content search remains deferred; MVP search remains metadata-only as required.

## 2026-06-29 — Milestone 6 notes, revisions, favorites, and profile

### Current milestone

- milestone: Milestone 7 — Administrative UI and auditing
- status: in progress
- last verified commit/state: uncommitted Milestone 6 with API-backed note draft/publish/revision restore, sanitized rendered notes, resource and note favorites, profile/dashboard summaries, and passing full verification plus E2E note workflow

### Completed

- Added note APIs for visible note listing, draft creation, detail rendering, draft save, publish/update, soft delete, deleted-note restore, and revision restore.
- Added note visibility enforcement for private, course-member, and all-authenticated-member notes, including draft-content suppression for viewers without edit rights.
- Added server-side note rendering for GitHub-flavored Markdown, syntax-highlighted code blocks, KaTeX math, safe Mermaid blocks, and heading-derived table-of-contents entries.
- Added resource and note favorites with API visibility checks, idempotent duplicate handling, and database partial unique indexes for per-user resource/note favorite uniqueness.
- Added a profile summary API that reports own uploads, authored notes, favorites, recent activity, and storage quota usage.
- Added note list, new-note editor, note detail, note edit, favorite list, resource favorite action, course-space recent notes/materials, dashboard activity, and profile activity UI backed by the API.
- Added Playwright browser coverage for login, note creation, publish, sanitized rendering, Mermaid/math display, favorite, revision update, and revision restore.
- Updated API, architecture, and permissions documentation for notes, favorites, profile summaries, sanitized rendering, and favorite uniqueness.
- Dependencies added: API `katex` and `@types/katex`; web `mermaid`.
- Database migration added: `20260628042000_favorite_partial_uniques` adds partial unique indexes for resource and note favorites.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm db:migrate` passed and applied `20260628042000_favorite_partial_uniques`.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api test:integration` passed with 4 integration files and 10 tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/web test:e2e` passed with 2 Chromium tests.

### In progress

- Implement administrator pages and audit-log visibility for users, courses, invitations, resources, and audit records.
- Next concrete action: inspect existing admin module/page placeholders, then add audited admin list/filter actions and UI for the remaining moderation and audit workflows.

### Decisions and assumptions

- Decision: publishing a note is explicit; draft saves update `draftContent`, while `publish: true` creates a `NoteRevision` and updates published content.
- Reason: the MVP requires autosaved drafts and auditable revision snapshots rather than every keystroke becoming a public revision.
- Decision: revision restore creates a new revision and audit record.
- Reason: restore should not erase the revision chain or hide who restored what.
- Decision: favorite uniqueness is enforced with partial unique indexes plus idempotent API logic.
- Reason: PostgreSQL nullable composite unique constraints do not reliably prevent duplicate favorites when one target column is `NULL`.
- Decision: unsafe Markdown URLs may remain as inert text if the sanitizer strips link attributes; tests assert no executable `javascript:` href survives and injected scripts do not run.
- Reason: preserving harmless text is acceptable, but executable content is not.

### Blockers

- exact command: initial `pnpm --filter @studyhub/web exec playwright test tests/e2e/notes.spec.ts --project=chromium`
- concise error: Playwright Chromium was not installed in the local environment.
- attempted fixes: ran `pnpm --filter @studyhub/web exec playwright install chromium`; reran the focused E2E successfully after later test-hardening fixes.
- minimum input required: none.
- exact command: later focused note E2E run.
- concise error: browser login and publish assertions were racing application readiness/navigation.
- attempted fixes: restored Docker/Compose infrastructure, verified seed credentials, made Playwright start the root dev command from an absolute workspace path, added E2E global setup waits for same-origin health/CSRF, waited for the note creation API response, and narrowed sanitization assertions to the rendered content/security properties.
- minimum input required: none.

### Deferred non-MVP work

- Side-by-side revision comparison summaries remain deferred; revision history and restore are implemented and audited.

## 2026-06-29 — Milestone 7 administrative UI and auditing

### Current milestone

- milestone: Milestone 8 — Reliability, CI, backup, and deployment
- status: in progress
- last verified commit/state: uncommitted Milestone 7 with guarded admin user/resource/audit APIs, admin UI pages, direct-request denial tests, and passing full verification plus admin E2E

### Completed

- Added system-administrator user search with role/status/activity/membership summaries.
- Added audited user disable, enable, and session-revocation flows.
- Added server-side protection against disabling the current or any system-administrator account, matching the user-admin UI safety state.
- Added resource administration for global system administrators and course-scoped course administrators, including soft delete, restore, and duplicate hash inspection.
- Added scoped audit-log listing with action, course, actor, and target filters; course administrators only see audit entries for administrable courses.
- Added `/admin/users`, `/admin/resources`, and `/admin/audit` web pages backed by the real APIs.
- Preserved existing semester, course, invitation, and membership administration pages while connecting the remaining admin surfaces.
- Fixed stale revoked-session browser behavior by allowing `/login` and `/register` to render even when a stale session cookie exists; protected routes still rely on API-authenticated rendering.
- Updated API, architecture, and permission documentation for admin users, resource moderation, audit filters, and stale-cookie handling.
- Tests added: expanded `apps/api/test/admin.integration.test.ts` to cover user search, disable/enable/session revoke, system-admin disable denial, global and scoped resource moderation, duplicate inspection, scoped audit visibility, and ordinary-member denial.
- Tests added: `apps/web/tests/e2e/admin.spec.ts` covers disposable invitation registration, member denial from admin pages, admin user search, disable/enable, disabled-login rejection, session revocation, and audit visibility through Playwright.
- Database migrations added: none.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/api exec vitest run --config vitest.integration.config.ts test/admin.integration.test.ts` passed with 1 file and 5 tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/web exec playwright test tests/e2e/admin.spec.ts --project=chromium` passed with 1 Chromium test.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.
- Verification detail: `pnpm verify` completed formatting, linting, type checking, unit tests, integration tests, Prisma client generation, and production builds for API and web; API integration suite passed with 5 files and 15 tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/web test:e2e` passed with 3 Chromium tests.

### In progress

- Complete reliability, CI, production deployment artifacts, backup/restore exercise, final E2E scenario coverage, and final handoff review.
- Next concrete action: audit Milestone 8 and final acceptance gaps, then implement any missing scripts, docs, tests, or hardening checks.

### Decisions and assumptions

- Decision: Playwright E2E tests run with one worker.
- Reason: the suite intentionally exercises real registrations, sessions, notes, and admin mutations against the shared local development database; serial execution avoids cross-test state races.
- Decision: stale session cookies no longer redirect users away from `/login` and `/register`.
- Reason: cookie presence alone cannot prove a valid server-side session after revocation; the API remains authoritative for protected routes.
- Decision: system-administrator accounts cannot be disabled through the admin endpoint.
- Reason: disabling privileged accounts is high-impact, and UI-only prevention would not satisfy the direct-request authorization requirement.

### Blockers

- exact command: initial concurrent `pnpm verify` and `pnpm --filter @studyhub/web test:e2e`.
- concise error: web typecheck saw stale `.next` route type references while the E2E dev server was also mutating `.next`; the admin E2E also raced shared browser/database state under parallel workers.
- attempted fixes: stopped running verification and E2E concurrently, confirmed web typecheck passes sequentially, set Playwright `workers: 1`, and reran both `pnpm verify` and the full E2E suite successfully.
- minimum input required: none.

### Deferred non-MVP work

- Bulk user import and advanced audit export remain deferred; the MVP includes searchable user administration and filterable audit viewing.

## 2026-06-29 — Milestone 8 reliability, CI, backup, and deployment

### Current milestone

- milestone: Milestone 9 — Final review and handoff
- status: in progress
- last verified commit/state: uncommitted Milestone 8 with CI, production Dockerfiles, readiness checks, expanded E2E coverage, and exercised local backup/restore

### Completed

- Added `/api/health/ready` readiness checks for PostgreSQL and private object storage, plus unit coverage.
- Enabled Nest shutdown hooks for graceful application shutdown.
- Added the missing `apps/web/Dockerfile` production image and updated the API Dockerfile to generate Prisma before build.
- Hardened GitHub Actions to prepare the test database, initialize a private MinIO bucket, migrate both databases, seed development data, run `pnpm verify`, and run Playwright E2E.
- Expanded Playwright coverage to five tests: scaffold smoke, system-admin disable/enable/session revoke/audit, member upload/preview/download/version/search/logout, read-only UI and direct API mutation denial, and note create/publish/favorite/revision restore/sanitization.
- Serialized Playwright workers to keep stateful full-stack E2E deterministic.
- Added S3 SDK-based object backup and restore scripts plus the `pnpm restore:objects` command.
- Added PostgreSQL backup/restore fallbacks through the local Docker Compose `postgres` service for machines without host `pg_dump` or `pg_restore`.
- Normalized Prisma `DATABASE_URL` values before passing them to PostgreSQL CLI tools, stripping the Prisma-only `schema` query parameter.
- Updated deployment and backup/restore documentation with container build commands, same-origin reverse-proxy guidance, readiness endpoints, CI behavior, and executable restore steps.
- Backup/restore exercise performed locally: `pnpm backup:db`, `pnpm backup:objects`, `pnpm restore:db <latest dump>`, `pnpm restore:objects backups/objects`, `pnpm db:migrate`, and direct verification of users, courses, notes, resources, seed object key, and seed object content.
- Database migrations added: none.
- Verification command and result: `pnpm format:check` passed.
- Verification command and result: `pnpm lint` passed.
- Verification command and result: `pnpm typecheck` passed.
- Verification command and result: `pnpm test` passed with API unit tests covering auth token helpers and readiness health plus shared permission tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm test:integration` passed with API integration suite at 5 files and 15 tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm build` passed for API, web, and workspace packages.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm --filter @studyhub/web test:e2e` passed with 5 Chromium tests.
- Verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed.

### In progress

- Perform final repository review, remove generated/debug artifacts, run final acceptance checks, and produce the handoff report.
- Next concrete action: inspect git status, generated files, TODOs/placeholders, security-sensitive strings, and final docs consistency.

### Decisions and assumptions

- Decision: object backup/restore uses the AWS S3 SDK instead of the MinIO `mc` CLI.
- Reason: the app already depends on S3 SDK tooling, and the restore exercise must work on machines without a host `mc` install.
- Decision: PostgreSQL backup/restore scripts use host tools when present and fall back to the local Compose Postgres container.
- Reason: this keeps local development reproducible with Docker alone while still supporting conventional production operator tooling.
- Decision: MinIO-incompatible public-access-block/versioning restore calls are best-effort.
- Reason: local Compose already disables anonymous bucket access; production S3 providers can enforce stronger bucket controls, but restore should not fail on MinIO compatibility differences.

### Blockers

- exact command: initial `pnpm backup:db`.
- concise error: `pg_dump` rejected Prisma's `?schema=public` URL query parameter.
- attempted fixes: normalized PostgreSQL tool URLs by stripping the Prisma-only `schema` parameter in backup and restore scripts.
- minimum input required: none.
- exact command: initial `pnpm restore:db <dump>`.
- concise error: Docker fallback restore failed with Windows path handling through shell invocation.
- attempted fixes: changed restore fallback to copy the dump into the Compose Postgres container and run `pg_restore` there with direct Docker arguments.
- minimum input required: none.
- exact command: initial `pnpm restore:objects backups/objects`.
- concise error: MinIO rejected S3 public-access-block XML with `MalformedXML`.
- attempted fixes: made provider-specific public-access-block/versioning calls best-effort while retaining bucket creation and object upload.
- minimum input required: none.

### Deferred non-MVP work

- Automated scheduled backup orchestration and cross-region object replication remain operator responsibilities; scripts and documented restore drills are provided for the MVP.

## 2026-06-29 — Milestone 9 final review and handoff

### Current milestone

- milestone: complete
- status: complete
- last verified commit/state: uncommitted completed MVP with all required application, infrastructure, migration, seed, verification, E2E, deployment, and backup/restore evidence

### Completed

- Performed final repository review for generated artifacts, required placeholder handlers, skipped tests, direct-request authorization gaps, unsafe storage exposure, and secret/debug leftovers.
- Removed generated build/test/backup artifacts after final verification, leaving source, migrations, docs, lockfile, Docker/CI files, and tests.
- Added authenticated desktop and mobile viewport smoke coverage for primary screens: Dashboard, Courses, Materials, Notes, Favorites, and Profile.
- Confirmed source scans found no blocking TODO/FIXME/skipped tests/fake success handlers. Remaining `ChangeMe-*` values are documented development-only seed/test placeholders in `.env.example`, seed code, and tests.
- Confirmed the final E2E suite covers invited registration, login/logout protection, course/material browsing, resource upload/preview/download/version/search, read-only mutation denial through UI and direct API, note creation/rendering/favorite/revision restore/sanitization, system-admin user disable/enable/session revoke/audit, and desktop/mobile primary-screen smoke.
- Final verification command and result: `pnpm install --frozen-lockfile` passed.
- Final verification command and result: `pnpm infra:up` passed and started healthy PostgreSQL, MinIO, and bucket initialization.
- Final verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm db:migrate` passed with no pending migrations.
- Final verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public S3_ENDPOINT=http://localhost:9000 S3_REGION=us-east-1 S3_ACCESS_KEY_ID=studyhub_minio S3_SECRET_ACCESS_KEY=studyhub_minio_dev_password S3_BUCKET=studyhub-private S3_FORCE_PATH_STYLE=true pnpm db:seed` passed.
- Final verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm verify` passed, including formatting, linting, type checking, unit tests, integration tests, Prisma generation, and production builds.
- Final verification command and result: `DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public TEST_DATABASE_URL=postgresql://studyhub:studyhub_dev_password@localhost:5432/studyhub?schema=public pnpm test:e2e` passed with 6 Chromium tests.
- Final backup/restore evidence: `pnpm backup:db`, `pnpm backup:objects`, `pnpm restore:db <latest dump>`, `pnpm restore:objects backups/objects`, and `pnpm db:migrate` were exercised locally; direct verification showed restored users, courses, notes, resources, `seed/resources/limits-review.md`, and seed object content.

### In progress

- None.

### Decisions and assumptions

- Decision: the MVP is considered complete with single-file download flows; batch download remains deferred as allowed by the goal.
- Reason: single-file authorization, private storage, preview, versioning, and audit behavior are implemented and tested without introducing memory-heavy archive generation.
- Decision: Office and ZIP files remain download-only.
- Reason: the goal explicitly permits download-only unsupported previews for the MVP.

### Blockers

- None.

### Deferred non-MVP work

- Batch downloads.
- Online code/notebook execution, OCR, AI summaries, recommendations, realtime collaboration, video hosting, public social features, payments, Elasticsearch, Kubernetes, and native mobile apps remain intentionally out of scope.
- Automated production backup scheduling, cross-region object replication, long-term object cleanup jobs, and advanced audit export can be added after the MVP.

## 2026-06-30 — Progress timeline correction and bilingual logs

### Change

- Restored the English progress timeline order so Milestone 2 appears between Milestone 1 and Milestone 3 instead of after the final handoff entry.
- Added a Simplified Chinese companion timeline at `docs/progress.zh-CN.md`.
- Updated the project workflow so future progress updates must be recorded in both English and Chinese timeline files.

### Functional Outcome

- Project progress can now be read in the actual work order, with the newest updates at the end.
- English and Chinese readers can track the same project history without losing earlier entries.

### Future Optimization

- A small validation script or review checklist could later check timeline heading order and confirm both language files receive matching entries.

## 2026-06-30 — CI MinIO startup fix

### Change

- Changed GitHub Actions to start MinIO in an explicit Docker step with the required `server /data` command.
- Removed MinIO from the GitHub Actions service container list, while keeping PostgreSQL as a service container.
- Kept the private bucket preparation step after MinIO readiness is confirmed.

### Functional Outcome

- The CI job no longer fails during GitHub Actions container initialization because MinIO is started with its required runtime command.
- Migrations, seed data, verification, and browser tests can still use the same private local S3-compatible endpoint in CI.

### Future Optimization

- If GitHub Actions adds first-class service container command support, MinIO can be moved back into the service container block.

## 2026-06-30 — CI native dependency install fix

### Change

- Updated pnpm configuration so optional platform-native dependencies are installed for the project.
- Explicitly enabled optional dependency installation in GitHub Actions.

### Functional Outcome

- CI can install the Linux native packages required by Rollup, Turborepo, and other platform-specific tooling before running `pnpm verify`.
- The verification pipeline no longer depends on runtime fallback installation for tool binaries.

### Future Optimization

- If a future package manager version removes the optional dependency edge case, the explicit CI environment setting can be reviewed.
