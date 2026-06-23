import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { prisma } from "@repo-sync/db";

async function main() {
  // Verify database connection
  try {
    await prisma.$connect();
    console.log("✓ Worker: Database connected");
  } catch (err) {
    console.error("✗ Worker: Database connection failed:", err);
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────┐
│  Repo Sync Worker                           │
│  Status: Running (idle — no queues yet)     │
│  Module 1: Skeleton only                    │
└─────────────────────────────────────────────┘
  `);

  // Worker queues will be registered in later modules.
  // For now, keep the process alive.
}

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received. Shutting down worker...`);
    await prisma.$disconnect();
    process.exit(0);
  });
});

main().catch((err) => {
  console.error("Fatal worker startup error:", err);
  process.exit(1);
});
