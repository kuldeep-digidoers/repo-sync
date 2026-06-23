import type { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "./error-handler.js";

/**
 * Validates request body against a Zod schema.
 * Returns 400 with structured field errors on failure.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const field = issue.path.join(".");
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        next(AppError.badRequest("Validation failed", details));
      } else {
        next(err);
      }
    }
  };
}
