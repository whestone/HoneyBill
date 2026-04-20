#!/usr/bin/env tsx
/**
 * Seed script: inserts default company settings, tax rates, number series,
 * and an admin user. Safe to run multiple times (idempotent).
 *
 * Admin-Passwort:
 *   - Erst-Seed: aus env INITIAL_ADMIN_PASSWORD gelesen, sonst wird ein sicheres
 *     Zufalls-Passwort generiert und EINMALIG auf stdout geschrieben.
 *   - Folge-Seeds: Passwort wird NICHT mehr geändert oder geloggt.
 *     Passwort-Resets erfolgen über den regulären Flow (z.B. Admin-Endpoint).
 */
import Database from "better-sqlite3";
import * as argon2 from "argon2";
import crypto from "node:crypto";
import { config } from "../config.js";

const db = new Database(config.dbPath);
db.pragma("foreign_keys = ON");

function generatePassword(): string {
  // 24 Zeichen aus url-safe base64, ~144 Bit Entropie
  return crypto.randomBytes(18).toString("base64url");
}

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
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? "admin";

// Legacy-Migration: alte admin@honeybill.local auf neuen Account umschreiben,
// ohne das Passwort zu ändern.
const legacyAdmin = db
  .prepare("SELECT id FROM users WHERE email = 'admin@honeybill.local'")
  .get() as { id: number } | undefined;
if (legacyAdmin) {
  db.prepare("UPDATE users SET email = ? WHERE email = 'admin@honeybill.local'").run(adminEmail);
  console.log(`✓ Admin-E-Mail migriert: admin@honeybill.local → ${adminEmail} (Passwort unverändert)`);
}

const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail) as
  | { id: number }
  | undefined;

if (!adminExists) {
  const passwordFromEnv = process.env.INITIAL_ADMIN_PASSWORD;
  const generated = !passwordFromEnv;
  const password = passwordFromEnv ?? generatePassword();
  if (generated && password.length < 12) {
    throw new Error("Generiertes Admin-Passwort ist zu kurz — bitte Seed-Skript prüfen.");
  }
  if (!generated && password.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD muss mindestens 12 Zeichen lang sein.");
  }
  const adminHash = await argon2.hash(password);
  db.prepare(
    `
    INSERT INTO users (email, password_hash, full_name, role, is_active)
    VALUES (?, ?, 'Administrator', 'admin', 1)
  `,
  ).run(adminEmail, adminHash);

  if (generated) {
    console.log("\n" + "─".repeat(70));
    console.log("✓ Admin-Benutzer angelegt");
    console.log(`  E-Mail:   ${adminEmail}`);
    console.log(`  Passwort: ${password}`);
    console.log("  → Dieses Passwort wird NUR jetzt angezeigt. Sicher speichern!");
    console.log("─".repeat(70) + "\n");
  } else {
    console.log(`✓ Admin-Benutzer angelegt: ${adminEmail} (Passwort aus INITIAL_ADMIN_PASSWORD)`);
  }
} else {
  console.log(`✓ Admin-Benutzer existiert bereits: ${adminEmail} (Passwort unverändert)`);
}

console.log("\nSeed complete.");
db.close();
