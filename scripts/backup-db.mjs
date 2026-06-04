#!/usr/bin/env node
/**
 * scripts/backup-db.mjs
 * Creates a timestamped copy of the SQLite database in the backups/ directory.
 *
 * DB path resolution order:
 *   1. DATABASE_URL in .env  (strips the "file:" prefix, resolves relative to project root)
 *   2. DATABASE_URL in .env.local (same logic)
 *   3. Fallback: prisma/dev.db
 *
 * Usage: npm run db:backup
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Parse a .env file (no external deps) and return key/value pairs
// ---------------------------------------------------------------------------
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Resolve DATABASE_URL → absolute file path
// ---------------------------------------------------------------------------
function resolveDbPath(databaseUrl) {
  // Expected format: "file:./some/path.db" or "file:/absolute/path.db"
  if (!databaseUrl) return null;
  const filePrefix = "file:";
  if (!databaseUrl.startsWith(filePrefix)) return null;
  const rawPath = databaseUrl.slice(filePrefix.length);
  return path.resolve(root, rawPath);
}

// Read env files (.env.local takes precedence over .env, matching Next.js behaviour)
const env = {
  ...parseEnvFile(path.join(root, ".env")),
  ...parseEnvFile(path.join(root, ".env.local")),
};

const fromEnv = resolveDbPath(env["DATABASE_URL"]);
const fallback = path.join(root, "prisma", "dev.db");

let src = null;
let srcLabel = null;

if (fromEnv && fs.existsSync(fromEnv)) {
  src = fromEnv;
  srcLabel = `DATABASE_URL → ${path.relative(root, fromEnv)}`;
} else if (fromEnv) {
  // Env file found but path doesn't exist yet
  console.error(`❌  DATABASE_URL points to: ${fromEnv}`);
  console.error("    File not found. Run 'npx prisma migrate dev' first.");
  process.exit(1);
} else if (fs.existsSync(fallback)) {
  src = fallback;
  srcLabel = `fallback → ${path.relative(root, fallback)}`;
} else {
  console.error("❌  Could not locate the SQLite database.");
  console.error("    Set DATABASE_URL in .env or run 'npx prisma migrate dev'.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Copy to backups/<name>-YYYY-MM-DD_HH-MM-SS.db
// ---------------------------------------------------------------------------
const backupsDir = path.join(root, "backups");
fs.mkdirSync(backupsDir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timestamp =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
  `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

const baseName = path.basename(src, ".db"); // e.g. "dev"
const dest = path.join(backupsDir, `${baseName}-${timestamp}.db`);

fs.copyFileSync(src, dest);

const size = (fs.statSync(dest).size / 1024).toFixed(1);
console.log(`✅  Backup created: backups/${path.basename(dest)} (${size} KB)`);
console.log(`    Source: ${srcLabel}`);
