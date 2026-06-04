#!/usr/bin/env node
/**
 * scripts/backup-db.mjs
 * Creates a timestamped copy of the SQLite database in the backups/ directory.
 * Usage: npm run db:backup
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Source DB (matches DATABASE_URL in .env)
const src = path.join(root, "prisma", "dev.db");

if (!fs.existsSync(src)) {
  console.error(`❌  Database not found at: ${src}`);
  console.error("    Run 'npx prisma migrate dev' first to create it.");
  process.exit(1);
}

// Destination: backups/dev-YYYY-MM-DD_HH-MM-SS.db
const backupsDir = path.join(root, "backups");
fs.mkdirSync(backupsDir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timestamp =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
  `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

const dest = path.join(backupsDir, `dev-${timestamp}.db`);

fs.copyFileSync(src, dest);

const size = (fs.statSync(dest).size / 1024).toFixed(1);
console.log(`✅  Backup created: backups/dev-${timestamp}.db (${size} KB)`);
