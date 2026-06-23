import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "@repo-sync/db";
import { GithubAppService } from "../lib/github-app.js";
import { AppSettingsService } from "../lib/app-settings.js";

export const webhooksRouter = Router();

/**
 * POST /webhooks/github
 * Handles incoming webhooks from GitHub App.
 * Verifies HMAC signature, confirms tracking branch, retrieves file diffs,
 * and records PushEvent + PushFiles in the database.
 */
webhooksRouter.post("/github", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const githubEvent = req.headers["x-github-event"];
    const deliveryId = req.headers["x-github-delivery"];
    const signature = req.headers["x-hub-signature-256"] as string;

    console.log(`[Webhook Received] Event: ${githubEvent}, Delivery: ${deliveryId}`);

    // 1. Verify HMAC signature if GITHUB_WEBHOOK_SECRET is configured
    const webhookSecret = (await AppSettingsService.getGithubSettings()).webhookSecret;
    if (webhookSecret) {
      if (!signature) {
        return res.status(401).json({ ok: false, error: "Missing signature header" });
      }
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        return res.status(400).json({ ok: false, error: "Missing raw body for verification" });
      }
      const hmac = crypto.createHmac("sha256", webhookSecret);
      const digest = "sha256=" + hmac.update(rawBody).digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        return res.status(401).json({ ok: false, error: "Invalid signature" });
      }
    }

    // 2. Only handle "push" events
    if (githubEvent !== "push") {
      return res.json({ ok: true, message: `Ignored non-push event: ${githubEvent}` });
    }

    const payload = req.body;
    const ref = payload.ref; // e.g. "refs/heads/main"
    const repoFullName = payload.repository?.full_name; // e.g. "owner/name"
    const beforeSha = payload.before;
    const afterSha = payload.after; // Head commit

    if (!repoFullName || !ref) {
      return res.status(400).json({ ok: false, error: "Malformed payload: missing repository or ref" });
    }

    // 3. Find registered MAIN repository
    const mainRepo = await prisma.repository.findFirst({
      where: {
        fullName: { equals: repoFullName, mode: "insensitive" },
        role: "MAIN",
        isActive: true,
      },
    });

    if (!mainRepo) {
      console.log(`[Webhook Ignored] Repository ${repoFullName} is not a registered, active MAIN repository.`);
      return res.json({ ok: true, message: "Ignored: Repository not registered as MAIN" });
    }

    // 4. Confirm branch matches tracked branch
    const expectedRef = `refs/heads/${mainRepo.branch}`;
    if (ref !== expectedRef) {
      console.log(`[Webhook Ignored] Push to ref ${ref} does not match expected branch ref ${expectedRef}`);
      return res.json({ ok: true, message: `Ignored: Push was on branch ${ref}, expected ${expectedRef}` });
    }

    // 5. Check if we already processed this head commit (idempotency check)
    const existingPush = await prisma.pushEvent.findUnique({
      where: { commitSha: afterSha },
    });

    if (existingPush) {
      console.log(`[Webhook Ignored] Commit ${afterSha} has already been processed.`);
      return res.json({ ok: true, message: "Ignored: Commit already processed (idempotency check)" });
    }

    // 6. Gather head commit info from the payload's commits list or head_commit
    const headCommit = payload.head_commit || (payload.commits && payload.commits[0]);
    if (!headCommit) {
      return res.status(400).json({ ok: false, error: "Missing head commit information in push payload" });
    }

    // 7. Get file changes and patches using GitHub Compare API
    // If beforeSha is zero, we compare against headCommit.id^ (or headCommit.id~1).
    const isBaseZero = !beforeSha || beforeSha.match(/^0+$/);
    const baseCommit = isBaseZero ? `${afterSha}~1` : beforeSha;

    let comparisonFiles: any[] = [];
    try {
      const comparison = await GithubAppService.compareCommits(
        mainRepo.installationId,
        mainRepo.fullName,
        baseCommit,
        afterSha
      );
      comparisonFiles = comparison.files;
    } catch (compareError) {
      console.error(`Failed to retrieve git compare diff:`, compareError);
      throw compareError;
    }

    // 8. Write to database: PushEvent and PushFiles in a single transaction
    const pushEvent = await prisma.$transaction(async (tx) => {
      // Calculate timestamp correctly
      let pushedAtDate = new Date();
      if (payload.repository?.pushed_at) {
        // GitHub pushed_at can be an epoch timestamp or ISO string
        const pushedVal = payload.repository.pushed_at;
        pushedAtDate = typeof pushedVal === "number" ? new Date(pushedVal * 1000) : new Date(pushedVal);
      } else if (headCommit.timestamp) {
        pushedAtDate = new Date(headCommit.timestamp);
      }

      const event = await tx.pushEvent.create({
        data: {
          repositoryId: mainRepo.id,
          commitSha: afterSha,
          baseSha: beforeSha,
          branch: ref.replace("refs/heads/", ""),
          authorName: headCommit.author?.name || headCommit.committer?.name || "Unknown Author",
          authorEmail: headCommit.author?.email || headCommit.committer?.email || "unknown@example.com",
          message: headCommit.message || "No commit message",
          pushedAt: pushedAtDate,
          status: "NEW",
        },
      });

      if (comparisonFiles.length > 0) {
        await tx.pushFile.createMany({
          data: comparisonFiles.map((file) => ({
            pushEventId: event.id,
            filePath: file.filename,
            changeType: file.status,
            patch: file.patch || null,
            additions: file.additions,
            deletions: file.deletions,
          })),
        });
      }

      return event;
    });

    console.log(`[Webhook Processed] Created PushEvent ID: ${pushEvent.id} for commit: ${afterSha}`);

    return res.status(201).json({
      ok: true,
      message: "Webhook processed and push event recorded",
      data: {
        pushEventId: pushEvent.id,
        commitSha: pushEvent.commitSha,
      },
    });
  } catch (error) {
    next(error);
  }
});
