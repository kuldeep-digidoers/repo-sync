# Multi-Repo Sync Platform — Full Project Plan

**Goal:** A web platform that watches a "main" repo, lets a human pick exactly which files/folders from a push get applied to which client repos, runs a conflict check before touching anything, and applies clean changes automatically (PR + auto-merge) while flagging conflicts for manual resolution.

This document is written to be handed to an AI coding agent (or a dev) module-by-module. Each module has: purpose, tech, data model, API contract, UI spec, and a "definition of done" checklist. Build in the order listed — later modules depend on earlier ones.

---

## 0. Tech Stack (locked decisions)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Fast dev loop, type safety matters here (lots of GitHub API shapes) |
| UI styling | Tailwind CSS, dark theme only | Matches requirement, fast to build consistent dark UI |
| Component layer | shadcn/ui (Radix-based) | Accessible primitives, themeable, not opinionated about visuals |
| State/data fetching | TanStack Query (React Query) | Server state (repos, pushes, jobs) dominates this app |
| Backend | Node.js + TypeScript + Express (or Fastify) | Same language as frontend, huge GitHub SDK support |
| Git operations | Real `git` CLI inside ephemeral Docker containers/jobs, NOT GitHub Contents API | Contents API can't do 3-way merge; only real git can |
| GitHub integration | **GitHub App** (not personal access token, not plain Actions) | One install covers unlimited repos, fine-grained permissions, webhook built in, scales to 100+ repos |
| Database | PostgreSQL | Relational data (repos, pushes, jobs, file selections) with real foreign keys and audit needs |
| ORM | Prisma | Type-safe queries matching TS backend, easy migrations |
| Job queue | BullMQ + Redis | Apply/dry-run jobs are slow (clone, git ops) — must be async, queued, retryable |
| Auth | Your own email/password + GitHub OAuth login | You need a login (for your team), and GitHub OAuth makes connecting repos seamless |
| Hosting (suggested) | Backend+worker on a VPS or Render/Railway; Postgres+Redis managed; Frontend on Vercel/Netlify | Keep infra simple at your scale (5→50 repos) |

**Theme spec (dark, used everywhere):**
- Background: `#0a0a0f` (page), `#13131a` (cards/panels)
- Border: `#26262f`
- Text primary: `#e8e8ec`, text secondary: `#8b8b96`
- Accent (primary action): `#5b8cff` (blue) — used for primary buttons, links, active states
- Success/clean-merge: `#3ecf8e`
- Warning/conflict: `#f5a524`
- Danger: `#f25555`
- Font: Inter or system UI stack; monospace (JetBrains Mono) for diffs/code/SHAs

---

## MODULE 1 — Foundation: Repo Scaffolding & Auth

### Purpose
Stand up the skeleton: monorepo structure, database, login/signup, and a protected dashboard shell. Nothing GitHub-related yet — just "can a user log in and see an empty dashboard."

### Structure
```
/apps
  /web        → React frontend
  /api        → Express backend
  /worker     → BullMQ job processor (separate process, shares /api's db client)
/packages
  /db         → Prisma schema + generated client (shared by api + worker)
  /shared     → Shared TS types (e.g. PushEvent, FileSelection)
```

### Database schema (Module 1 portion)
```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String?
  githubLogin  String?  // set after GitHub OAuth link
  githubToken  String?  // encrypted, for OAuth-based actions (not the App token)
  createdAt    DateTime @default(now())
}
```

### Backend endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | email+password signup, returns JWT |
| POST | `/auth/login` | email+password login, returns JWT |
| GET | `/auth/me` | return current user from JWT |
| GET | `/auth/github/start` | redirect to GitHub OAuth |
| GET | `/auth/github/callback` | handle OAuth callback, link account |

Use JWT in an httpOnly cookie. Hash passwords with `bcrypt` (cost 12).

### Frontend pages
- `/login` — dark theme, email+password fields, "Sign in with GitHub" button below a divider
- `/signup` — same layout, name+email+password
- `/dashboard` — protected route, empty shell for now: left sidebar nav (Dashboard, Repositories, Push History, Settings), top bar with user avatar/logout. Just render "No pushes yet" placeholder.

### Definition of done
- [ ] User can sign up, log in, log out
- [ ] Protected routes redirect to `/login` when unauthenticated
- [ ] GitHub OAuth link works and stores `githubLogin` on the user
- [ ] Dashboard shell renders in dark theme with sidebar nav

---

## MODULE 2 — GitHub App & Repo Registration

### Purpose
Create the GitHub App that will receive webhooks and perform git operations. Build the "Add Repository" flow so the user can register their main repo and all client repos, each with metadata and documentation notes.

### Why a GitHub App (not a PAT or plain Action)
- One App installation per repo (or org), no per-repo secrets to manage
- Fine-grained permissions (contents: read/write, pull requests: write) scoped only to repos you choose
- Webhooks are built in — no need to maintain Action YAML in every repo
- An App token is short-lived and scoped; safer than a long-lived PAT sitting in your DB

### GitHub App setup (one-time, manual, document this in README)
1. Create the App at `github.com/settings/apps/new`
2. Permissions needed: **Contents: Read & write**, **Pull requests: Read & write**, **Metadata: Read-only**
3. Webhook events to subscribe to: **Push**
4. Webhook URL: `https://<your-backend-domain>/webhooks/github`
5. Generate a private key (`.pem`), store as `GITHUB_APP_PRIVATE_KEY` env var
6. Note the App ID (`GITHUB_APP_ID`) and Webhook secret (`GITHUB_WEBHOOK_SECRET`)
7. Install the App on your GitHub account/org, selecting: the main repo + all client repos (you can add more repos to the installation later without code changes)

### Database schema (Module 2 portion)
```prisma
model Repository {
  id            String   @id @default(uuid())
  githubOwner   String   // e.g. "yourorg"
  githubName    String   // e.g. "repo-a"
  fullName      String   @unique // "yourorg/repo-a"
  installationId Int     // GitHub App installation ID for this repo
  role          RepoRole // MAIN or CLIENT
  branch        String   @default("master") // default branch to track/target
  description   String?  // free text: "Acme Corp — production, custom invoicing module added 2026-03"
  customerName  String?  // for client repos
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum RepoRole {
  MAIN
  CLIENT
}
```

Only one `MAIN` repo is expected at a time, but don't hard-enforce uniqueness in the schema — enforce it in app logic (so you can switch main repos later without a migration).

### Backend endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/repos` | list all registered repos (filter by `role`) |
| POST | `/repos` | register a repo: `{ githubOwner, githubName, role, branch, description, customerName }` — backend verifies the GitHub App is installed on it before saving |
| GET | `/repos/:id` | repo detail |
| PATCH | `/repos/:id` | update description, branch, isActive |
| DELETE | `/repos/:id` | soft-delete (set isActive false, keep history) |
| GET | `/repos/installable` | calls GitHub API to list repos the App is installed on but NOT yet registered in our DB — powers an "add from list" picker instead of manual typing |

### Frontend pages
**`/repositories`**
- Two sections: "Main Repository" (single card, or "Set main repo" CTA if none set) and "Client Repositories" (grid/list of cards)
- Each client repo card shows: customer name, repo full name, branch, short description, last-sync status badge (Synced / Pending / Conflict — wire this up properly in Module 4), and an edit icon
- "+ Add Repository" button opens a modal:
  - Step 1: choose role (Main / Client)
  - Step 2: pick from `/repos/installable` (dropdown of repos the GitHub App can see) — avoids typos, avoids registering a repo the App has no access to
  - Step 3: fill in customer name + description (textarea, placeholder: "Notes on this repo — custom features, known divergences from main, anything future-you should know before syncing")
- Repo detail page `/repositories/:id`: full description editor, branch setting, sync history table (placeholder until Module 5), deactivate button

### Definition of done
- [ ] GitHub App created and installable
- [ ] Webhook endpoint exists (just logs payload for now, verified in Module 3)
- [ ] User can register main repo and multiple client repos via UI, picking from real installed repos
- [ ] Repo list/detail pages render correctly in dark theme
- [ ] Descriptions are editable and persist

---

## MODULE 3 — Push Detection & Diff Extraction

### Purpose
When something is pushed to the main repo's tracked branch, capture the commit(s), the changed files, and the diff content — and surface it in the UI as a new "Push Event" ready for triage.

### Database schema (Module 3 portion)
```prisma
model PushEvent {
  id           String   @id @default(uuid())
  repositoryId String   // FK to Repository (the MAIN repo)
  commitSha    String
  baseSha      String   // the "before" SHA from the webhook payload
  branch       String
  authorName   String
  authorEmail  String
  message      String
  pushedAt     DateTime
  status       PushStatus @default(NEW)
  createdAt    DateTime @default(now())

  files        PushFile[]
  syncJobs     SyncJob[] // defined in Module 4
}

enum PushStatus {
  NEW          // detected, not yet triaged
  TRIAGED      // user has opened it and made selections
  COMPLETED    // all selected sync jobs finished (success or flagged)
}

model PushFile {
  id          String   @id @default(uuid())
  pushEventId String
  pushEvent   PushEvent @relation(fields: [pushEventId], references: [id])
  filePath    String
  changeType  String   // "added" | "modified" | "removed" | "renamed"
  patch       String?  // unified diff text for this file, from GitHub API
  additions   Int
  deletions   Int
}
```

### Webhook flow
1. GitHub sends `push` event to `/webhooks/github`
2. Verify HMAC signature using `GITHUB_WEBHOOK_SECRET` — reject if invalid
3. Confirm `repository.full_name` matches a registered `MAIN` repo and `ref` matches its tracked branch — ignore otherwise
4. For each commit in the payload (usually just the head commit for a normal push), call GitHub's **Compare API** (`GET /repos/{owner}/{repo}/compare/{base}...{head}`) to get the full file list + patches in one call, rather than parsing webhook `added/modified/removed` arrays (which are commit-level and miss patch content)
5. Create one `PushEvent` + many `PushFile` rows
6. Push event appears in UI immediately (poll or use simple SSE/WebSocket — see note below)

> **Real-time note:** Don't over-engineer this. Polling `/push-events?status=NEW` every 5-10s from the dashboard is perfectly fine at your scale (a handful of pushes per day). Add WebSockets later only if it becomes annoying.

### Backend endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/push-events` | list, filterable by `status`, paginated, newest first |
| GET | `/push-events/:id` | full detail including all `PushFile` rows with patches |
| POST | `/push-events/:id/triage` | mark as `TRIAGED` (called when user opens the detail screen) |

### Frontend pages
**`/dashboard`** (update from Module 1's placeholder)
- Feed of recent push events as cards: commit message, author, relative time, file count badge, status badge (color-coded: NEW = blue, TRIAGED = amber, COMPLETED = green)
- Clicking a card goes to `/push-events/:id`

**`/push-events/:id`** — this is the most important screen in the whole app, build it carefully:
- Header: commit message, SHA (short, monospace, copyable), author, timestamp, link to view commit on GitHub
- File list panel (left or top): every changed file from `PushFile`, grouped by top-level folder, each row showing `+adds / -deletions` in green/red, changeType icon
- Clicking a file expands an inline diff viewer below it (use a library like `react-diff-viewer-continued` or render the unified `patch` text yourself with monospace + colored line backgrounds — added lines tinted green-on-dark, removed tinted red-on-dark)
- This screen does NOT yet have repo-selection — that's Module 4. For now it's purely "inspect what changed."

### Definition of done
- [ ] Pushing to main repo's tracked branch creates a `PushEvent` with correct file-level patches (verify against a real test push, not just webhook payload inspection)
- [ ] Push events list and detail render correctly, diffs are readable in dark theme
- [ ] Re-pushing the same SHA doesn't create duplicates (idempotency check on `commitSha`)

---

## MODULE 4 — Sync Targeting & Dry-Run Conflict Check

### Purpose
This is the core value of the whole platform. From a push event's detail screen, let the user select target client repos and specific files, then run a **dry-run** that tells them, per repo per file, whether it will merge cleanly, merge with auto-resolution, or conflict — **before anything is written to any client repo.**

### Conceptual model
For each `(PushEvent, target ClientRepo)` pair the user creates, we build a `SyncJob`. A `SyncJob` has many `SyncJobFile` rows (the files the user selected for that specific repo — selection can differ per repo, e.g. push 5 files but only sync 3 of them into repo-b).

### Database schema (Module 4 portion)
```prisma
model SyncJob {
  id              String   @id @default(uuid())
  pushEventId     String
  pushEvent       PushEvent @relation(fields: [pushEventId], references: [id])
  targetRepoId    String
  targetRepo      Repository @relation(fields: [targetRepoId], references: [id])
  status          SyncJobStatus @default(PENDING)
  branchName      String?  // e.g. "sync/main-a1b2c3d"
  prUrl           String?
  prNumber        Int?
  errorMessage    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  files           SyncJobFile[]
}

enum SyncJobStatus {
  PENDING          // created, dry-run not yet run
  DRY_RUN_RUNNING
  CLEAN            // dry run passed, all selected files mergeable, ready to apply
  CONFLICT         // dry run found at least one conflicting file
  APPLYING
  APPLIED          // PR created (and merged, if auto-merge is on)
  FAILED           // unexpected error (network, auth, etc.) — distinct from CONFLICT
}

model SyncJobFile {
  id           String   @id @default(uuid())
  syncJobId    String
  syncJob      SyncJob  @relation(fields: [syncJobId], references: [id])
  filePath     String
  mergeResult  MergeResult @default(PENDING)
  conflictDiff String?  // if CONFLICT, store the conflict markers / hunk for display
}

enum MergeResult {
  PENDING
  CLEAN       // file unchanged on target side, patch applies directly
  MERGED      // 3-way merge succeeded automatically (target had unrelated changes)
  CONFLICT    // same lines touched on both sides
}
```

### The dry-run engine (this is the riskiest technical piece — build and test standalone first)

Run this as a worker job (BullMQ), not inline in the API request — it involves real git operations and should not block the HTTP response.

**Algorithm per `SyncJob`:**
1. Get an installation access token for the target repo via the GitHub App (short-lived, scoped)
2. In an ephemeral workspace (e.g. `/tmp/sync-jobs/<jobId>/`):
   ```bash
   git clone --branch <target-branch> --depth 50 https://x-access-token:<token>@github.com/<owner>/<target-repo>.git target
   ```
   (Shallow clone is enough — we only need recent history for merge-base purposes; if merge-base lookups fail, fall back to deeper clone.)
3. Also fetch the **main repo's** relevant commits so we have the patch source:
   ```bash
   git -C target remote add upstream https://x-access-token:<token>@github.com/<mainOwner>/<mainRepo>.git
   git -C target fetch upstream <pushEvent.baseSha> <pushEvent.commitSha>
   ```
4. For the *selected files only*, build a patch limited to those paths:
   ```bash
   git -C target diff <baseSha> <commitSha> -- <file1> <file2> ... > selected.patch
   ```
5. Attempt the merge using `git merge-tree` (modern 3-way merge-tree, available git ≥2.38) which simulates the merge without touching the working directory or any branch:
   ```bash
   git -C target merge-tree --write-tree <target-branch-tip> <commitSha> -- <file1> <file2>
   ```
   - Exit code 0, clean tree → **CLEAN/MERGED** depending on whether target had any changes in that file (you can tell by checking if the file's blob hash on target differs from its blob hash at `baseSha`)
   - Non-zero / conflict markers in output → **CONFLICT**, capture the conflict hunk text from the output for display
6. Write `SyncJobFile.mergeResult` per file, then roll up: if any file is `CONFLICT` → `SyncJob.status = CONFLICT`, else `CLEAN`
7. Clean up the ephemeral workspace (`rm -rf`) regardless of outcome

> **Important constraint to respect (per your requirement):** the dry-run must operate **only on the files the user explicitly selected**, never the full diff and never the full tree. If file X changed in main but the user didn't select it for repo-b, repo-b's dry-run must not even look at file X. This is what prevents "everything got wiped" — the unit of operation is always the explicit file selection, never "make target look like main."

### Backend endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/push-events/:id/sync-jobs` | body: `{ targetRepoIds: string[], filesByRepo: { [repoId]: string[] } }` — creates one `SyncJob` + `SyncJobFile` rows per repo, enqueues dry-run jobs |
| GET | `/push-events/:id/sync-jobs` | list sync jobs for this push, with live status |
| GET | `/sync-jobs/:id` | full detail incl. per-file merge results and conflict diffs |
| POST | `/sync-jobs/:id/retry-dry-run` | re-run dry-run (e.g. after target repo changed) |

### Frontend — extending `/push-events/:id`
Add a right-hand panel (or a second tab: "Inspect" / "Sync"):
- **Repo selector**: checklist of all active client repos (customer name + repo name), multi-select
- **Per-repo file selector**: once repos are checked, show the same file list from Module 3 but now with per-repo checkboxes — e.g. a small grid where rows = files, columns = selected client repos, checkbox at each intersection. Default: all files checked for all selected repos (most common case), user unchecks what they don't want for a given repo
- **"Run Dry Run" button** — disabled until at least one repo+file combo is selected
- After dry run completes (poll status every 2-3s while `DRY_RUN_RUNNING`), show a results table:

  | Repo | Status badge | Files |
  |---|---|---|
  | Acme Corp (repo-a) | 🟢 Clean | 4/4 mergeable |
  | Beta Inc (repo-b) | 🟡 Conflict | 3/4 mergeable, 1 conflict |
  | Gamma LLC (repo-c) | 🟢 Clean | 4/4 mergeable |

- Clicking a repo row expands per-file results; a `CONFLICT` file shows the conflict hunk in a monospace diff block (target's lines vs incoming lines, clearly labeled) with a note: "This file will be skipped for this repo. Resolve manually or exclude it and re-run."
- Two action buttons appear once dry-run is done: **"Apply to Clean Repos"** (proceeds with every `CLEAN`/non-conflicted repo, Module 5) and, per conflicted repo, an **"Exclude conflicting file & retry"** quick action that removes that one file from that one repo's selection and re-runs just that repo's dry-run

### Definition of done
- [ ] User can select any subset of repos and, per repo, any subset of files from a push
- [ ] Dry run correctly reports CLEAN for untouched files, MERGED for non-overlapping changes, CONFLICT for overlapping changes — validate with a deliberately constructed test case (modify the same line in both main and a test client repo)
- [ ] No git write operations happen anywhere in this module — dry run is read-only against the target repo
- [ ] Conflict hunks are clearly displayed and understandable without opening GitHub

---

## MODULE 5 — Apply Engine (PR Creation + Optional Auto-Merge)

### Purpose
Take `SyncJob`s with status `CLEAN` and actually write the change: create a branch on the target repo, apply the patch, push, open a PR, and (per repo setting) auto-merge it.

### Database additions
```prisma
model Repository {
  // ...existing fields from Module 2
  autoMergeEnabled Boolean @default(false) // per-repo: skip manual PR click for clean syncs
}
```

### Apply flow (worker job, triggered by "Apply to Clean Repos")
1. For each `SyncJob` with status `CLEAN`:
2. Re-clone target repo fresh (don't reuse the dry-run workspace — avoid stale state)
3. Create branch: `git checkout -b sync/main-<shortsha>`
4. Apply only the selected files' patch:
   ```bash
   git apply --index selected.patch
   ```
   (If `git apply` fails despite a clean dry-run — rare race condition if target moved — mark job `FAILED` with the error, do NOT force-push, surface in UI for manual retry)
5. Commit: message template `"Sync from main @ <shortsha>: <original commit message>"`, author set to a dedicated bot identity (e.g. "Sync Bot <sync-bot@yourcompany.com>")
6. Push branch to target repo
7. Open PR via GitHub API: `POST /repos/{owner}/{repo}/pulls`, title = commit message, body = auto-generated summary listing exactly which files were synced and a link back to the original push event in your platform (for traceability)
8. If `targetRepo.autoMergeEnabled` is true: immediately call the merge endpoint `PUT /repos/{owner}/{repo}/pulls/{number}/merge` (use `squash` or `merge` per your preference — squash is cleaner for this use case)
9. Update `SyncJob.status = APPLIED`, store `prUrl`/`prNumber`
10. Once all `SyncJob`s for a `PushEvent` reach a terminal state (`APPLIED`, `CONFLICT`, or `FAILED`), set `PushEvent.status = COMPLETED`

### Backend endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/push-events/:id/apply` | body: `{ syncJobIds: string[] }` — applies only the specified (presumably CLEAN) jobs, enqueues apply workers |
| GET | `/sync-jobs/:id/status` | lightweight polling endpoint for live status during apply |

### Frontend
- "Apply to Clean Repos" button (from Module 4) triggers this; show a progress list (repo name + spinner → checkmark or error icon) as jobs complete, polling `/sync-jobs/:id/status`
- On completion, each repo row becomes a link to its PR (if not auto-merged) or shows "Merged ✅" with a link to the merge commit (if auto-merged)
- Repo settings page (`/repositories/:id`): toggle for "Auto-merge clean syncs" with a one-line explanation: "When the dry run is fully clean, skip the manual PR click and merge immediately."

### Definition of done
- [ ] Applying a clean sync job results in exactly the selected files changing in the target repo, nothing else
- [ ] PR is opened with a clear, traceable description
- [ ] Auto-merge setting is respected per repo
- [ ] A failure mid-apply does not leave the target repo in a broken state (test: kill the worker mid-job, confirm target repo's default branch is untouched since we only ever push to a new branch)

---

## MODULE 6 — History, Audit & Polish

### Purpose
Make the system trustworthy over time: a full audit trail of what was synced where and when, plus the UI refinement pass.

### Frontend pages
- **`/history`** — table of all `PushEvent`s with expandable rows showing every `SyncJob` that resulted from them: target repo, status, PR link, timestamp. Filterable by repo, by date range, by status. This is your "what did we actually ship to Acme Corp on March 3rd" answer.
- **`/repositories/:id`** sync history tab — same data, scoped to one repo, answers "what's been synced into repo-b, ever"
- Dashboard summary cards: total repos, pending conflicts needing attention (link straight to them), syncs this week

### Polish pass (apply across all modules)
- Empty states for every list (no repos yet, no pushes yet, no conflicts — friendly, not bare)
- Toast notifications for async actions (dry run started, apply completed, etc.) — use a lightweight lib like `sonner`, styled for dark theme
- Loading skeletons instead of spinners for list/table content
- Consistent status badge component used everywhere (NEW/TRIAGED/COMPLETED, CLEAN/CONFLICT/etc.) — one component, color-coded, reused
- Keyboard-friendly: Esc closes modals, Cmd/Ctrl+Enter submits the file-selection form

### Definition of done
- [ ] Full history of every sync is queryable and filterable
- [ ] No dead-end empty screens anywhere in the app
- [ ] Visual consistency pass complete across all 5 prior modules

---

## Build Order Summary

```
Module 1: Auth + shell           (no GitHub yet — pure scaffolding)
Module 2: GitHub App + repo registry
Module 3: Webhook → push detection → diff viewer
Module 4: Repo/file selection → dry-run conflict engine   ← highest risk, validate early
Module 5: Apply engine → PR creation → auto-merge
Module 6: History/audit + polish pass
```

**Recommended validation checkpoint:** Before building any UI for Module 4, build the dry-run `merge-tree` logic as a standalone Node script run against two of your real test repos (not production client repos). Deliberately create a conflicting scenario and a non-conflicting scenario. Confirm the output matches expectations. Only then wire it into the job queue and UI. This is the one piece where a subtle bug could repeat your original bad experience — isolate and prove it first.

---

## Environment Variables Needed

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...        # PEM contents, base64-encoded if needed
GITHUB_WEBHOOK_SECRET=...
GITHUB_OAUTH_CLIENT_ID=...        # for user login via GitHub
GITHUB_OAUTH_CLIENT_SECRET=...
```

---

## Open Decisions to Confirm Before/During Build

- Squash-merge vs regular merge for auto-merged PRs (squash recommended — keeps client repo history clean)
- Bot identity for commits (name/email) — needs its own GitHub presence if you want commits clearly attributed
- Retention: how long to keep `PushEvent`/`SyncJob` history (recommend: forever, it's small relational data, valuable for audits)
- Whether non-MAIN-branch pushes (feature branches on main repo) should ever trigger this flow, or strictly only the tracked production branch — plan above assumes only the tracked branch