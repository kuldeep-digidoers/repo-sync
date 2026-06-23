import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { AppSettingsService } from "../lib/app-settings.js";

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get("/github", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await AppSettingsService.getPublicGithubSettings();
    res.json({ ok: true, data: settings });
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch("/github", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const allowedKeys = [
      "oauthClientId",
      "oauthClientSecret",
      "oauthCallbackUrl",
      "appId",
      "appSlug",
      "privateKey",
      "webhookSecret",
    ];

    const data: Record<string, string> = {};
    for (const key of allowedKeys) {
      const value = body[key];
      if (typeof value === "string") {
        data[key] = value;
      }
    }

    const settings = await AppSettingsService.updateGithubSettings(data);
    res.json({ ok: true, data: settings });
  } catch (err) {
    next(err);
  }
});
