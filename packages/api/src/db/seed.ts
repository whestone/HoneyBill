#!/usr/bin/env tsx
/**
 * Seed script: inserts default company settings, tax rates, number series,
 * and an admin user. Safe to run multiple times (idempotent).
 */
import Database from "better-sqlite3";
import * as argon2 from "argon2";
import { config } from "../config.js";

const db = new Database(config.dbPath);
db.pragma("foreign_keys = ON");

// ─── Company Settings ─────────────────────────────────────────────────────────
const existing = db.prepare("SELECT id FROM company_settings WHERE id = 1").get();
if (!existing) {
  db.prepare(`
    INSERT INTO company_settings (id, name, country, default_currency, default_payment_days)
    VALUES (1, 'Meine Firma GmbH', 'DE', 'EUR', 14)
  `).run();
  console.log("✓ Company settings created");
}

// ─── Tax Rates ────────────────────────────────────────────────────────────────
const taxRateRows = [
  { name: "Normalsatz 19%", rate_percent: "19.00", tax_category: "S", valid_from: "2007-01-01", is_default: 1 },
  { name: "Ermäßigt 7%",    rate_percent: "7.00",  tax_category: "R", valid_from: "2007-01-01", is_default: 0 },
  { name: "Steuerfrei 0%",  rate_percent: "0.00",  tax_category: "Z", valid_from: "2007-01-01", is_default: 0 },
];

for (const tr of taxRateRows) {
  const ex = db.prepare("SELECT id FROM tax_rates WHERE name = ? AND valid_from = ?").get(tr.name, tr.valid_from);
  if (!ex) {
    db.prepare(`
      INSERT INTO tax_rates (name, rate_percent, tax_category, valid_from, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(tr.name, tr.rate_percent, tr.tax_category, tr.valid_from, tr.is_default);
    console.log(`✓ Tax rate: ${tr.name}`);
  }
}

// ─── Number Series ────────────────────────────────────────────────────────────
const series = [
  { document_type: "QUOTE",         prefix: "ANG-", year_segment: 1 },
  { document_type: "DELIVERY_NOTE", prefix: "LS-",  year_segment: 1 },
  { document_type: "INVOICE",       prefix: "RE-",  year_segment: 1 },
  { document_type: "CREDIT_NOTE",   prefix: "GS-",  year_segment: 1 },
];

for (const s of series) {
  const ex = db.prepare("SELECT id FROM number_series WHERE document_type = ?").get(s.document_type);
  if (!ex) {
    db.prepare(`
      INSERT INTO number_series (document_type, prefix, year_segment, padding, next_counter, reset_yearly)
      VALUES (?, ?, ?, 5, 1, 1)
    `).run(s.document_type, s.prefix, s.year_segment);
    console.log(`✓ Number series: ${s.document_type}`);
  }
}

// ─── Admin User ───────────────────────────────────────────────────────────────
const adminEmail = "admin";
const adminPassword = "admin";
const adminHash = await argon2.hash(adminPassword);
// Migrate legacy email if exists, otherwise upsert by new email
const legacyAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@honeybill.local'").get() as { id: number } | undefined;
const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (legacyAdmin) {
  db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE email = 'admin@honeybill.local'").run(adminEmail, adminHash);
  console.log(`✓ Admin migrated: ${adminEmail} / ${adminPassword}`);
} else if (!adminExists) {
  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_active)
    VALUES (?, ?, 'Administrator', 'admin', 1)
  `).run(adminEmail, adminHash);
  console.log(`✓ Admin user created: ${adminEmail} / ${adminPassword}`);
} else {
  db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(adminHash, adminEmail);
  console.log(`✓ Admin password reset: ${adminEmail} / ${adminPassword}`);
}

console.log("\nSeed complete.");
db.close();
