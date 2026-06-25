# RepoSync GitHub Flow Overview

RepoSync is now built around a UI-first GitHub workflow for real repositories.

## User Flow

1. Go to `Settings`.
2. Click `Connect GitHub` to link your GitHub account.
3. Click `Install / Sync Repos` to install or update the GitHub App repository access.
4. Go to `Repositories`.
5. Add one main repository and select its required branch from the GitHub branch dropdown.
6. Add one or more child repositories and select their required target branch from the GitHub branch dropdown.
7. Go to `Manual Sync`.
8. Select the main repository and branch.
9. Select one or more child repositories. The selected main repo is excluded from child options.
10. Continue to commits, select a main repo commit.
11. Continue to files, select the files from that commit.
12. Click `Merge Selected Files`.

The merge action starts RepoSync's dry-run conflict check first. Clean jobs can then be applied through the push event detail page, which creates PRs and optionally auto-merges according to repository settings.

## Real GitHub APIs Used

RepoSync uses the GitHub App installation token for repository operations:

- List installed repositories
- List account repositories
- List branches
- List commits for a branch
- Read commit file diffs
- Clone/fetch repositories for dry-run checks
- Push sync branches
- Create pull requests
- Auto-merge pull requests when enabled

GitHub OAuth is used for account login, repository discovery, and pre-registration branch discovery.

## One-Time Admin Setup Still Required

GitHub does not allow a third-party app to connect users to GitHub without the product itself having a GitHub OAuth/App identity. That means one admin setup is still required once per deployed RepoSync instance.

In `Settings`, open `Admin Setup` and save:

- OAuth Client ID
- OAuth Client Secret
- OAuth Callback URL
- GitHub App ID
- GitHub App Slug
- GitHub App Private Key
- Webhook Secret

After this, normal users should not need to touch technical configuration. They use `Connect GitHub`, `Install / Sync Repos`, `Repositories`, and `Manual Sync`.

## Step-by-Step GitHub Admin Setup

Use these steps once for your RepoSync installation.

### 1. Decide Your URLs

For local development:

- Web app URL: `http://localhost:5173` or the Vite port currently shown in terminal, for example `http://localhost:5174`
- API URL: `http://localhost:3001`
- OAuth callback URL: `http://localhost:3001/auth/github/callback`
- Webhook URL: use an HTTPS tunnel such as ngrok/cloudflared that points to `http://localhost:3001`, then use `https://<tunnel-domain>/webhooks/github`

If your ngrok tunnel is currently running on the frontend port, for example:

```bash
ngrok http 5174
```

then that tunnel is only for the web UI. Use it as the GitHub App `Homepage URL`, not as the webhook URL:

```text
Homepage URL:
https://<your-ngrok-domain>
```

GitHub webhooks must reach the API server, not the frontend server. For webhooks, run a tunnel to API port `3001`:

```bash
ngrok http 3001
```

Then use:

```text
Webhook URL:
https://<api-ngrok-domain>/webhooks/github

OAuth Callback URL:
https://<api-ngrok-domain>/auth/github/callback
```

If you only want to run one ngrok tunnel during local development, prefer tunneling the API:

```bash
ngrok http 3001
```

Then configure:

```text
Homepage URL:
http://localhost:5174

Webhook URL:
https://<api-ngrok-domain>/webhooks/github

OAuth Callback URL:
https://<api-ngrok-domain>/auth/github/callback
```

For production:

- Web app URL: `https://<your-web-domain>`
- API URL: `https://<your-api-domain>`
- OAuth callback URL: `https://<your-api-domain>/auth/github/callback`
- Webhook URL: `https://<your-api-domain>/webhooks/github`

### 2. Create the GitHub OAuth App

1. Open GitHub Developer Settings: `https://github.com/settings/developers`
2. Go to `OAuth Apps`.
3. Click `New OAuth App`.
4. Fill:
   - Application name: `RepoSync`
   - Homepage URL: your web app URL
   - Authorization callback URL: your OAuth callback URL
5. Click `Register application`.
6. Copy the `Client ID`.
7. Click `Generate a new client secret`.
8. Copy the client secret immediately.
9. In RepoSync, go to `Settings` -> `Admin Setup`.
10. Paste:
    - `OAuth Client ID`
    - `OAuth Client Secret`
    - `OAuth Callback URL`

### 3. Create the GitHub App

1. Open GitHub Developer Settings: `https://github.com/settings/developers`
2. Go to `GitHub Apps`.
3. Click `New GitHub App`.
4. Fill:
   - GitHub App name: `RepoSync` or a unique name like `YourCompany RepoSync`
   - Homepage URL: your web app URL
   - Webhook URL: your webhook URL
   - Webhook secret: create a strong random string and save it
5. Set permissions:
   - Repository permissions -> Contents: `Read and write`
   - Repository permissions -> Pull requests: `Read and write`
   - Repository permissions -> Metadata: `Read-only`
6. Subscribe to events:
   - Push
7. Choose where this app can be installed:
   - For private/team use, select `Only on this account`
8. Click `Create GitHub App`.

### 4. Copy GitHub App Values into RepoSync 

After creating the GitHub App:

1. On the GitHub App general page, copy `App ID`.
2. Copy the app slug from the URL.
   - Example URL: `https://github.com/settings/apps/my-reposync-app`
   - App slug: `my-reposync-app`
3. Scroll to `Private keys`.
4. Click `Generate a private key`.
5. Open the downloaded `.pem` file and copy the full contents.
6. In RepoSync, go to `Settings` -> `Admin Setup`.
7. Paste:
   - `GitHub App ID`
   - `GitHub App Slug`
   - `GitHub App Private Key`
   - `Webhook Secret`
8. Click `Save Admin Setup`.

### 5. Install the GitHub App on Repositories

1. In RepoSync, go to `Settings`.
2. Click `Install / Sync Repos`.
3. GitHub opens the GitHub App installation page.
4. Select your account or organization.
5. Choose repository access:
   - Select the main repo.
   - Select all child/client repos you want RepoSync to sync into.
6. Click `Install` or `Save`.
7. Return to RepoSync.
8. Go to `Repositories`.
9. Click `Refresh`.
10. Your real GitHub repositories should appear for selection.

### 6. Connect Your GitHub User Account

1. In RepoSync, go to `Settings`.
2. Click `Connect GitHub`.
3. Approve GitHub OAuth.
4. Return to RepoSync.
5. The Settings page should show your GitHub username as connected.

### 7. Validate the Setup

In RepoSync:

1. Go to `Repositories`.
2. Add one main repo.
3. Select its branch from the branch dropdown.
4. Add child repos.
5. Select their target branch.
6. Go to `Manual Sync`.
7. Select main repo, branch, child repos, commit, and files.
8. Start the merge check.

If repositories do not appear:

- Confirm the GitHub App is installed on those repositories.
- Confirm the GitHub OAuth account has access to those repositories.
- Confirm `GitHub App ID`, `GitHub App Slug`, and private key are saved correctly.
- Confirm local webhook URL uses HTTPS if testing webhooks locally.

## Required GitHub App Permissions

Configure the GitHub App with:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

Subscribe the GitHub App to:

- Push events

Webhook URL:

- Local development: use an HTTPS tunnel to `/webhooks/github`
- Production: `https://<api-domain>/webhooks/github`
- Example when ngrok points to API port `3001`: `https://<api-ngrok-domain>/webhooks/github`

OAuth callback URL:

- Local development: `http://localhost:3001/auth/github/callback`
- Production: `https://<api-domain>/auth/github/callback`
- Example when ngrok points to API port `3001`: `https://<api-ngrok-domain>/auth/github/callback`

## Production Safety

RepoSync does not directly write to child repository default branches. It creates a sync branch, opens a pull request, and only merges clean jobs. Conflict jobs stay visible for review.
