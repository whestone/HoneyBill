#!/usr/bin/env tsx
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure data directories exist
for (const dir of [
  config.uploadsDir,
  path.join(config.uploadsDir, "logos"),
  path.join(config.uploadsDir, "icc"),
  config.exportsDir,
  path.join(config.exportsDir, "documents"),
]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const migrationsDir = path.join(__dirname, "migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Track applied migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

for (const file of migrationFiles) {
  const name = file;
  const already = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(name);
  if (already) {
    console.log(`  ✓ ${name} (already applied)`);
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  db.exec(sql);
  db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(name);
  console.log(`  ✓ ${name}`);
}

console.log("\nMigrations complete.");
db.close();
