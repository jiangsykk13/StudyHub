# AGENTS.md

## 1. Repository mission

Build and maintain an invitation-only private learning-material sharing platform for a small group of students.

The platform is not a public social network and must not expose course files to anonymous internet users. Its primary jobs are:

1. organize materials by semester and course;
2. let authorized students upload and download files safely;
3. preview PDF, Markdown, image, text, and source-code files;
4. create and share Markdown notes;
5. provide metadata search, filters, favorites, and basic administration;
6. preserve data through migrations, versioning, audit logs, and backups.

Use the configurable placeholder product name `StudyHub`. Do not spread the product name through the codebase; keep branding in a central configuration module so it can be renamed later.

---

## 2. Instruction priority

When working in this repository:

1. follow this `AGENTS.md`;
2. follow the active task or Goal file;
3. inspect the existing implementation before changing architecture;
4. preserve working behavior unless the task explicitly changes it;
5. prefer a complete, tested vertical slice over many unfinished modules.

If a requirement is ambiguous, choose the simplest secure behavior consistent with a private student platform, document the assumption, and continue. Do not stop merely to ask for cosmetic preferences.

---

## 3. Product boundaries

### Required MVP capabilities

- invitation-code registration;
- login, logout, session management, and account disabling;
- roles and resource-level authorization;
- semesters, courses, course membership, and course invitation codes;
- material metadata, categories, tags, upload, download, and duplicate detection;
- private object storage and short-lived authorized download URLs;
- previews for PDF, Markdown, images, plain text, and common source-code files;
- metadata search, filtering, sorting, and pagination;
- Markdown notes with sanitization, code highlighting, math support, and revision snapshots;
- favorites and a personal dashboard;
- administration for users, courses, invites, resources, and audit logs;
- Docker-based local development, database migrations, seed data, tests, CI, and documentation.

### Explicitly out of scope for the MVP

Do not add these unless a later task explicitly requests them:

- public registration or anonymous file access;
- public SEO pages;
- online execution of user-submitted code;
- real-time collaborative editing;
- instant messaging or private messages;
- social following, points, levels, or engagement gamification;
- video hosting or transcoding;
- Elasticsearch, Kubernetes, or microservice decomposition;
- AI summaries, AI question answering, OCR, or recommendation systems;
- native mobile applications;
- payment, advertising, or monetization.

---

## 4. Required technical direction

Use a TypeScript monorepo with current stable, mutually compatible package versions.

### Core stack

- package manager: `pnpm`;
- monorepo/task runner: pnpm workspaces and Turborepo;
- web: Next.js with App Router, React, TypeScript;
- UI: Tailwind CSS and shadcn/ui-compatible components;
- API: NestJS with REST endpoints and OpenAPI documentation;
- database: PostgreSQL;
- ORM and migrations: Prisma;
- object storage: MinIO locally and any S3-compatible service in production;
- validation: shared Zod schemas where practical, plus strict API DTO validation;
- authentication: email/password with Argon2id and opaque server-side sessions;
- testing: Vitest or Jest for unit/integration tests and Playwright for browser E2E tests;
- linting/formatting: ESLint and Prettier;
- local infrastructure: Docker Compose;
- CI: GitHub Actions.

Do not replace this architecture with Firebase, Supabase, a CMS, AList, Docusaurus, or a static-site generator. Those may be considered by a future explicit architecture decision only.

### Authentication architecture

Use same-origin authentication:

- the browser receives a random opaque session token in a `HttpOnly`, `Secure` in production, `SameSite=Lax` cookie;
- store only a cryptographic hash of the session token in PostgreSQL;
- sessions have creation, last-used, and expiration timestamps;
- logout revokes the current session;
- disabling a user revokes all of that user's sessions;
- state-changing requests must enforce same-origin checks and CSRF protection;
- never put access tokens in `localStorage`;
- never log passwords, raw session tokens, invitation codes, or presigned URLs.

---

## 5. Target repository layout

Keep the repository close to this structure:

```text
.
├── AGENTS.md
├── CODEX_GOAL.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── tests/
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── semesters/
│       │   ├── courses/
│       │   ├── invitations/
│       │   ├── resources/
│       │   ├── notes/
│       │   ├── favorites/
│       │   ├── admin/
│       │   ├── audit/
│       │   ├── storage/
│       │   └── common/
│       └── test/
├── packages/
│   ├── config/
│   ├── shared/
│   ├── ui/
│   └── eslint-config/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/
├── docs/
│   ├── architecture.md
│   ├── permissions.md
│   ├── api.md
│   ├── deployment.md
│   ├── backup-restore.md
│   ├── progress.md
│   └── progress.zh-CN.md
└── .github/workflows/ci.yml
```

Small deviations are acceptable when justified in `docs/architecture.md`. Do not create deeply nested abstractions without an immediate use.

---

## 6. Domain model

At minimum, model these concepts explicitly:

- `User`
- `Session`
- `Semester`
- `Course`
- `CourseMember`
- `Invitation`
- `Resource`
- `ResourceVersion`
- `ResourceCategory`
- `Tag`
- `ResourceTag`
- `Note`
- `NoteRevision`
- `Favorite`
- `DownloadRecord`
- `AuditLog`

Recommended role model:

- `SYSTEM_ADMIN`
- `COURSE_ADMIN`
- `MEMBER`
- `READ_ONLY`

`COURSE_ADMIN` is normally a membership role scoped to a course rather than a global superuser role.

### Authorization rules

- unauthenticated users can access only the login and invitation-registration screens plus health endpoints;
- all materials require authentication;
- course-scoped materials require active course membership unless marked `ALL_MEMBERS`;
- `READ_ONLY` members may browse and download but may not upload, create shared notes, or modify course content;
- `MEMBER` users may create resources and notes and edit only their own content;
- course administrators may manage members, invitations, and content in their course;
- system administrators may manage all users, courses, content, and audit records;
- resource ownership never overrides course or system restrictions;
- every API endpoint must enforce authorization on the server; hiding a button in the UI is not authorization.

Document the final permission matrix in `docs/permissions.md` and test the most important allow/deny cases.

---

## 7. File-storage and upload rules

### Storage

- keep MinIO/S3 buckets private;
- never expose permanent public object URLs;
- use random object keys that do not include the original filename;
- retain the original filename only as database metadata;
- authorize downloads in the API and return a short-lived presigned URL;
- stream uploads and downloads; do not load a 100 MB file entirely into memory;
- isolate storage code behind an interface so local MinIO can be replaced by another S3-compatible provider.

### Upload validation

Default limits, configurable through environment variables:

- maximum file size: 100 MiB;
- per-user storage quota: 5 GiB;
- presigned download lifetime: 5 minutes.

Allowed MVP formats:

- PDF;
- Markdown and plain text;
- common images: PNG, JPEG, WebP, GIF;
- common Office documents: DOCX, PPTX, XLSX;
- ZIP archives;
- Jupyter notebooks;
- common source-code/configuration formats such as C, C++, Java, Python, JavaScript, TypeScript, HTML, CSS, SQL, JSON, YAML, TOML, and shell source files stored as text.

Executable and high-risk formats must be rejected, including `.exe`, `.msi`, `.dll`, `.bat`, `.cmd`, and binary scripts. Validate both extension and detected MIME/signature where possible.

### Integrity and duplicate detection

- compute SHA-256 while streaming the uploaded content;
- reject or warn on an exact duplicate within the same course according to the product flow;
- store size, hash, detected MIME type, uploader, timestamps, and object key;
- a replacement upload creates a new `ResourceVersion`; it must not destructively overwrite the previous object;
- deletion should be soft deletion first; storage cleanup may occur through an explicit maintenance job after a retention period.

---

## 8. Preview and content-safety rules

- sanitize every rendered Markdown/HTML surface;
- do not permit arbitrary embedded scripts, inline event handlers, iframes, or unsafe URLs;
- render PDF through a safe browser/PDF.js viewer;
- render images through controlled object URLs or authorized proxy routes;
- render source files as escaped text with syntax highlighting;
- impose a preview-size threshold for text files;
- Office and ZIP files may be download-only in the MVP; do not pretend to support a preview that is unreliable;
- never execute uploaded notebooks, archives, macros, or source code.

Markdown notes should support:

- GitHub-flavored Markdown;
- fenced code blocks and syntax highlighting;
- KaTeX-compatible math;
- Mermaid diagrams only with a safe configuration;
- table of contents;
- autosaved drafts;
- explicit publish/update;
- revision snapshots and restore.

---

## 9. API and database conventions

- use REST resources with predictable plural paths under `/api`;
- publish OpenAPI documentation in development;
- use DTO/schema validation for every external input;
- reject unknown properties where practical;
- return consistent error objects containing a machine-readable code and safe message;
- use cursor or page-based pagination consistently;
- use database transactions for multi-record state changes;
- add indexes for foreign keys, lookup fields, session hashes, invitation hashes, course membership, resource timestamps, and search fields;
- store invitation codes only as hashes;
- use UTC in the database and ISO 8601 at API boundaries;
- use soft-delete fields where restoration or auditability matters;
- migrations must be committed; do not use schema synchronization in production;
- seed scripts must be idempotent or clearly safe to rerun.

Initial search should cover metadata only: title, description, course, category, tags, uploader, and original filename. Use PostgreSQL capabilities; do not introduce an external search service.

---

## 10. Frontend and UX conventions

Build a responsive desktop-first interface that remains usable on mobile.

Required primary navigation:

- Dashboard
- Courses
- Materials
- Notes
- Favorites
- Profile
- Administration, visible only when authorized

Design requirements:

- use accessible semantic elements;
- all form controls need labels and validation messages;
- keyboard navigation and visible focus states must work;
- avoid information-dense dashboard clutter;
- loading, empty, success, and error states must be explicit;
- destructive actions require confirmation;
- never rely on color alone to communicate status;
- use a centralized branding/config module;
- keep copy in a centralized, i18n-ready structure, but do not build a full translation platform in the MVP.

The initial interface may use English copy consistently. Do not mix languages within the product UI.

---

## 11. Coding standards

- enable strict TypeScript settings;
- avoid `any`; when unavoidable, isolate and explain it;
- prefer small modules with explicit dependencies;
- keep controllers thin and business rules in services/domain functions;
- use dependency injection for storage, hashing, clock, and other external boundaries when it improves testability;
- do not duplicate authorization logic across controllers;
- do not commit generated build output, local object-storage data, database volumes, or secrets;
- do not hard-code ports, credentials, cookie secrets, storage keys, or admin passwords;
- maintain `.env.example` with safe placeholders and descriptions;
- use structured logging and redact sensitive fields;
- comments should explain non-obvious decisions, not restate the code;
- user-facing errors must not leak stack traces, SQL, filesystem paths, object keys, or internal exception text.

Before adding a dependency, verify that the need cannot be met safely by existing dependencies or platform APIs. Avoid abandoned or unnecessary packages.

---

## 12. Required commands

The root workspace should provide stable commands with these meanings:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm infra:up
pnpm infra:down
```

`pnpm dev` should start the application after infrastructure and environment setup are complete. Document any required preliminary command in `README.md`.

Prefer one-command local verification:

```bash
pnpm verify
```

`pnpm verify` should run formatting checks, linting, type checking, unit/integration tests, and production builds. Browser E2E tests may be a separate documented step if they require running services.

---

## 13. Testing expectations

Every major feature requires tests at the appropriate layer.

### Unit tests

Cover pure rules such as:

- permission decisions;
- invitation validity;
- quota calculations;
- accepted/rejected file types;
- resource visibility;
- session expiration;
- duplicate-file decisions.

### Integration tests

Run against a real test PostgreSQL database and, where storage behavior matters, a test MinIO instance. Cover:

- registration with valid, invalid, expired, exhausted, and revoked invitations;
- login/logout/session revocation;
- course membership and role enforcement;
- authorized and unauthorized upload/download;
- resource creation and version creation;
- metadata search/filtering;
- note revisions;
- administrator actions and audit entries.

### E2E tests

Playwright must verify at least:

1. invited user registration and login;
2. course discovery/join flow where applicable;
3. resource upload, listing, preview, and download authorization;
4. Markdown note creation and rendering;
5. a read-only member being blocked from uploading;
6. an administrator disabling a user;
7. anonymous access being redirected or rejected.

Tests must assert behavior, not only status codes. Avoid brittle selectors; use accessible roles and stable test IDs only when necessary.

---

## 14. Security checklist

Before declaring a milestone complete, check:

- password hashing uses Argon2id;
- session and invitation tokens use cryptographically secure randomness;
- raw tokens are never stored in the database;
- cookies have correct production flags;
- CORS is not configured as a wildcard with credentials;
- CSRF and origin protections cover state-changing browser requests;
- authorization occurs at every protected endpoint;
- object storage is private;
- signed URLs are short-lived;
- upload size and user quota are enforced server-side;
- file content is never executed;
- Markdown is sanitized;
- login, invitation validation, and upload endpoints are rate-limited;
- logs and audit records do not contain secrets;
- dependencies and container images are pinned or reproducibly locked;
- `.env` and secrets are ignored by Git;
- backup and restore procedures are documented and tested at least manually.

---

## 15. Work protocol for Codex

For substantial work:

1. read `AGENTS.md`, `CODEX_GOAL.md`, `README.md`, and relevant architecture documents;
2. inspect the repository and current test status;
3. record the current milestone and assumptions in both `docs/progress.md` and `docs/progress.zh-CN.md`;
4. implement one coherent vertical slice;
5. add or update tests;
6. run the narrowest useful checks first, then the full relevant verification;
7. inspect the diff for security, authorization, data-loss, and regression risks;
8. update documentation and both progress logs;
9. continue to the next milestone only when the current one is verifiably usable.

Maintain `docs/progress.md` and `docs/progress.zh-CN.md` as append-only project timelines: the English and Simplified Chinese versions of the same project history. Every code or documentation change must add a new dated entry to both files without deleting or overwriting earlier entries. Keep entries in chronological order from oldest to newest; for same-day entries, keep the actual milestone or work order, and place the newest entry at the end. Each entry should summarize what changed, what user-facing or operational function was added or improved, and what could be optimized later. Keep the wording focused on product behavior and project progress rather than detailed implementation mechanics.

Do not mark work complete because files were created. Completion requires executable behavior and passing verification.

When blocked:

- attempt reasonable local fixes;
- do not silently weaken security, remove tests, skip migrations, or fake external behavior;
- record the exact failing command, relevant output, attempted fixes, and the smallest user input needed;
- leave the repository in a coherent, buildable state whenever possible.

---

## 16. Definition of done

A feature is done only when:

- the implementation exists end to end;
- server-side authorization is present;
- validation and safe failure states are implemented;
- relevant tests pass;
- lint, type checking, and builds pass;
- database migrations are included;
- environment/configuration changes are reflected in `.env.example`;
- user and operator documentation is updated;
- no secret, temporary debug bypass, skipped test, placeholder handler, or untracked TODO blocks the advertised behavior.

The project MVP is done only when the acceptance criteria in `CODEX_GOAL.md` are satisfied and a fresh clone can be started by following `README.md`.
