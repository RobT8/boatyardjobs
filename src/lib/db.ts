import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

/**
 * Pick a writable location for the SQLite file.
 *  - DATA_DIR env var wins, if set (use this to point at a mounted volume).
 *  - On Vercel/serverless the project dir is read-only; only the OS temp dir
 *    (/tmp) is writable, so fall back there. Note this is ephemeral and
 *    per-instance — fine for previews and seed data, but writes won't persist
 *    across cold starts. Swap in a hosted DB (Turso/libSQL, Postgres) for prod.
 *  - Otherwise use ./data for local development.
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "boatyardjobs");
  }
  return path.join(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, "boatyardjobs.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,            -- two-letter code
      category TEXT NOT NULL,          -- role category slug
      employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
      description TEXT NOT NULL,
      salary_min INTEGER,              -- annual USD, nullable
      salary_max INTEGER,
      salary_unit TEXT DEFAULT 'YEAR', -- YEAR | HOUR
      certifications TEXT NOT NULL DEFAULT '[]', -- JSON array
      source TEXT NOT NULL DEFAULT 'direct',     -- 'direct' or aggregator source id
      source_url TEXT,                 -- original listing URL for aggregated jobs
      apply_email TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published', -- published | pending | expired
      posted_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
    CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_posted ON jobs(status, posted_at DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      state TEXT,                      -- null = all states
      category TEXT,                   -- null = all roles
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed INTEGER NOT NULL DEFAULT 0,
      UNIQUE(email, state, category)
    );

    CREATE TABLE IF NOT EXISTS apply_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id),
      clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_job ON apply_clicks(job_id);
  `);
}
