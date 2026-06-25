# RepoSync Platform State Tracking

This document tracks the evolution, implementation state, and design decisions of the Multi-Repo Sync Platform. It is meant to guide developers and AI coding agents during subsequent tasks.

---

## 📂 Project Architecture

```
repo-sync/
├── package.json               # Root monorepo workspace configurations
├── tsconfig.base.json         # Base compiler options shared across workspaces
├── .env                       # Local environment variables (PostgreSQL, Redis, JWT, GitHub)
├── apps/
│   ├── api/                   # Express backend API (Port 3001)
│   ├── web/                   # React 18 + Vite + Tailwind CSS frontend (Port 5173)
│   └── worker/                # BullMQ background worker (idle skeleton)
└── packages/
    ├── db/                    # Prisma schema and PostgreSQL database client singleton
    └── shared/                # Common TypeScript interfaces and API contract schemas
```

--- 

## ⚡ Current System Status

### 1. Database (`packages/db`)
* **ORM:** Prisma
* **Database:** PostgreSQL (running on `localhost:5432` with password `123456`)
* **Tables:**
  * `User`: Stores user details, hashed passwords (bcrypt), and encrypted GitHub access tokens.
  * `Repository`: Stores linked source (`MAIN`) and target (`CLIENT`) repositories, including branch target, descriptions, customer names, and active status.
  * `AppSetting`: Stores runtime GitHub OAuth/App configuration; secrets are encrypted at rest.
  * `PushEvent`: Records tracked upstream repository push commits (with base/head SHAs, author, message, status, and target branch details).
  * `PushFile`: Stores specific files affected in a push event, capturing additions, deletions, change types, and git diff patches.
  * `SyncJob`: Manages target deployment branch configurations, pull request metadata, run results, and status tracking.
  * `SyncJobFile`: Represents individual targeted file merge checks, saving mergeResult enums and conflict Diff hunks.
* **Initialization:** Migrated and pushed successfully using `npm run push -w packages/db`.

### 2. Shared Library (`packages/shared`)
* **TypeScript Types:** Defines shared domain interfaces (e.g., `UserProfile`, `AuthResponse`, `Repository`, `RepoRole`, `PushEvent`, `PushFile`, `PushStatus`, `PaginatedResponse`, `SyncJob`, `SyncJobFile`, `SyncJobStatus`, `MergeResult`, `CreateSyncJobsRequest`) and validation contracts.
* **Status:** Cleanly built to ESNext modules.

### 3. Backend API (`apps/api`)
* **Framework:** Express + TS 5.7
* **Security:** Helmet, CORS, express-rate-limit, Zod input validation.
* **Auth System:**
  * JWT stored in `httpOnly` cookies (secure in production, lax in development).
  * Encrypted token storage at rest using AES-256-GCM.
  * **Module 2, 3 & 4 Integration Endpoints:**
  * `GET /settings/github`: Returns browser-editable GitHub configuration status without exposing secrets.
  * `PATCH /settings/github`: Saves GitHub OAuth/App configuration from the Settings page, encrypting secrets.
  * `GET /repos`: Lists registered repositories (filters by role and isActive).
  * `POST /repos`: Registers a repository (checks GitHub App installation).
  * `GET /repos/:id`: Fetches single repository detail.
  * `PATCH /repos/:id`: Updates branch target, description, or activation status.
  * `DELETE /repos/:id`: Soft-deactivates the repository.
  * `GET /repos/installable`: Queries repositories configured on the App installation.
  * `POST /webhooks/github`: Receives incoming webhook events, validates HMAC-SHA256 signatures, verifies MAIN tracking branch rules, executes GitHub App Compare API requests, and saves transaction-safe PushEvent + PushFiles records.
  * `GET /push-events`: Lists all push events filterable by status with pagination.
  * `GET /push-events/:id`: Fetches specific push event meta + all associated push file diffs.
  * `POST /push-events/:id/triage`: Changes push status to `TRIAGED`.
  * `POST /push-events/:id/sync-jobs`: Creates SyncJob + SyncJobFiles targeting client repos and enqueues dry-runs.
  * `GET /push-events/:id/sync-jobs`: Retrieves sync jobs list for a push event.
  * `GET /sync-jobs/:id`: Fetches sync job detail, file merge results, and conflict markers.
  * `POST /sync-jobs/:id/retry-dry-run`: Resets job status and re-queues the dry-run check.
* **Sync Background Queue:**
  * Uses an in-memory `SyncQueue` class to process git dry-runs in the background without blocking HTTP responses.
  * Clones target repositories dynamically, fetches upstream main commits, builds file-specific patches, and runs a modern git dry-run check (simulating 3-way conflict markers) with clean-up.
  * Supports simulated mock testing when the server is in Mock Mode.

### 4. React Frontend (`apps/web`)
* **Tech Stack:** React 18 + Vite + Tailwind CSS + TanStack Query + React Router 7.
* **Styling:** Premium dark mode styling (`#0a0a0f` background, `#5b8cff` accent) matching the design guidelines.
* **Routes:**
  * Public: `/login`, `/signup`.
  * Protected Dashboard nested under `/dashboard`:
    * `/dashboard` (Live polling push event webhook stream, system health indicators, and activity stats)
    * `/dashboard/repositories` (Main Repository card, Client Repositories grid, and Multistep "+ Add Repository" dialog)
    * `/dashboard/repositories/:id` (Repository configuration form, description textarea, and placeholder sync history log table)
    * `/dashboard/push-events/:id` (Push event summary details, grouped-folder file tree panel, and inline code diff viewer highlighting green additions/red deletions)
    * `/dashboard/settings` (GitHub OAuth + GitHub App configuration form, including encrypted secret saving and setup links)
* **Status:** Completely typechecked (`tsc --noEmit` passes with 0 errors) and builds successfully.

### 5. Worker (`apps/worker`)
* **Role:** BullMQ consumer process.
* **Status:** Skeleton initialized. Connects to PostgreSQL to verify system connectivity on startup and exits cleanly (idle mode).

---

## 🚀 Execution & Verification

### Dev Command
To start the entire environment in development mode (API, Web, Worker), run:
```bash
npm run dev
```

> [!NOTE]
> Hot-reloading watch mode (`tsx watch`) was disabled for backend/worker services to prevent reaching the system limit for inotify file watchers (`ENOSPC`), ensuring a stable development experience on local environments.

### Verification Scripts
Automated integration test scripts are available:
* **Auth tests:**
  ```bash
  npx tsx /home/ucs/.gemini/antigravity/brain/36657e94-8a3b-43e5-bb62-dd8f45de676b/scratch/test-auth.ts
  ```
* **Repository CRUD tests:**
  ```bash
  npx tsx /home/ucs/.gemini/antigravity/brain/36657e94-8a3b-43e5-bb62-dd8f45de676b/scratch/test-repos.ts
  ```

* **Webhook & Push Event tests:**
  ```bash
  npx tsx /home/ucs/.gemini/antigravity/brain/36657e94-8a3b-43e5-bb62-dd8f45de676b/scratch/test-webhook.ts
  ```
* **Sync Targeting & Dry-Run tests:**
  ```bash
  npx tsx /home/ucs/.gemini/antigravity/brain/36657e94-8a3b-43e5-bb62-dd8f45de676b/scratch/test-sync-dry-run.ts
  ```

---

## ✅ Module 5 & 6 Implementation Status

## 🔐 Real GitHub Configuration Required

To use real repositories from the browser flow, configure these in `/dashboard/settings`:
* `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL` for "Sign in with GitHub" and account repo discovery.
* `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` for GitHub App repo access, webhooks, PR creation, and auto-merge.
* `.env` values remain supported as fallback defaults, but the Settings page is the preferred user-facing configuration path.
* Mock installable repositories are disabled; repository registration requires real GitHub App installation access.
* Repository onboarding is dynamic: choose one GitHub App-installed main repo, or select multiple child/client repos in bulk from the GitHub account/App-installed repository list.
* Repository onboarding fetches real GitHub branches after repo selection and requires branch selection before submit.
* `/dashboard/sync` provides a guided manual sync flow: select main repo/branch, select child repos, choose a main commit, choose changed files, then start dry-run merge jobs.
* GitHub OAuth callback should point to `http://localhost:3001/auth/github/callback` locally, or `https://<api-domain>/auth/github/callback` in production.
* GitHub App webhook URL should point to `http(s)://<api-domain>/webhooks/github`; for local development use a tunnel such as ngrok/cloudflared.
* Install or configure the GitHub App on the exact source/client repositories you want RepoSync to manage. OAuth can show account repos, but only App-installed repos can be selected for real sync.

### Module 5: PR Automation & Auto-Merge
* **Backend apply endpoint:** `POST /push-events/:id/apply` validates that every requested job belongs to the push event, is `CLEAN`, targets an active `CLIENT` repository, and has selected files.
* **Apply worker:** Re-clones the client repo, fetches the main repo commits, builds a patch for selected files only, creates a unique `sync/main-<shortsha>-<jobid>` branch, commits as Sync Bot, pushes the branch, opens a PR, and respects per-repo `autoMergeEnabled`.
* **Real-repo hardening:** Git commands now use argument arrays instead of shell-interpolated strings, reducing breakage/risk from branch names, repository names, and file paths. Empty patches are refused.
* **UI:** The push event sync tab applies only truly `CLEAN` jobs, polls running jobs, surfaces PR links, and blocks empty retry selections.

### Module 6: History, Audit & Polish
* **Global history:** `/dashboard/history` lists push events with filters for source repo, target repo, date range, and push status. Expanded rows show sync jobs, target repos, selected file counts, statuses, and PR links.
* **Repository history:** `/dashboard/repositories/:id` shows sync history scoped to the selected repo, including target-specific job status and PR links for client repos.
* **Audit data:** History API responses include sync job files so the UI can report selective sync scope accurately.
* **Polish fixes:** Date filters include the full end day, history field names now match the API model, and the sync keyboard shortcut no longer references an uninitialized mutation.

### Remaining Real-World Validation
* Run a full dry-run + apply cycle against two non-production real GitHub repositories installed on the GitHub App.
* Confirm the resulting PR changes exactly the selected files and no unselected files.
* Confirm auto-merge behavior on one client repo with `autoMergeEnabled=true`, and manual PR behavior on another with it disabled.
