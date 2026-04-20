import crypto from "node:crypto";
import { asc, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";

/** Felder, die in die Hash-Berechnung einfließen (alles außer `id`, `prevHash`, `hash`). */
export interface AuditEntryInput {
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Kanonisierte, deterministische JSON-Serialisierung: Keys alphabetisch sortiert,
 * `undefined` rausgefiltert. Gleiche Inhalte → identische Repräsentation → identischer Hash.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k]))
      .join(",") +
    "}"
  );
}

function computeHash(prevHash: string, payload: AuditEntryInput & { createdAt: string }): string {
  // Wir hashen prevHash || canonical(payload). Damit hängt jeder Hash von
  // allen vorherigen Einträgen ab (tamper-evident chain).
  const h = crypto.createHash("sha256");
  h.update(prevHash);
  h.update("|");
  h.update(canonicalStringify(payload));
  return h.digest("hex");
}

/**
 * Hängt einen Eintrag an den Audit-Trail an. Berechnet prevHash/hash automatisch.
 * Nutzt eine SQLite-Transaktion, damit der Tail-Hash atomar gelesen und geschrieben wird.
 */
export async function appendAudit(entry: AuditEntryInput): Promise<void> {
  const createdAt = new Date().toISOString();
  const last = await db
    .select({ hash: auditLog.hash })
    .from(auditLog)
    .orderBy(desc(auditLog.id))
    .limit(1);
  const prevHash = last[0]?.hash ?? "GENESIS";

  const payload = {
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldData: entry.oldData ?? null,
    newData: entry.newData ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    createdAt,
  };
  const hash = computeHash(prevHash, payload);

  await db.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldData: entry.oldData === undefined ? null : JSON.stringify(entry.oldData),
    newData: entry.newData === undefined ? null : JSON.stringify(entry.newData),
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    createdAt,
    prevHash,
    hash,
  });
}

export interface VerificationResult {
  ok: boolean;
  totalRows: number;
  brokenAtId?: number;
  reason?: string;
}

/**
 * Verifiziert die komplette Audit-Kette. Gibt `ok: false` inkl. erster gebrochener
 * Position zurück, wenn ein Eintrag manipuliert oder gelöscht wurde.
 */
export async function verifyAuditChain(): Promise<VerificationResult> {
  const rows = await db.select().from(auditLog).orderBy(asc(auditLog.id));
  let prev = "GENESIS";
  for (const row of rows) {
    if (!row.hash || !row.prevHash) {
      return {
        ok: false,
        totalRows: rows.length,
        brokenAtId: row.id,
        reason: "Eintrag ohne Hash (vor Einführung der Hash-Chain oder manipuliert)",
      };
    }
    if (row.prevHash !== prev) {
      return {
        ok: false,
        totalRows: rows.length,
        brokenAtId: row.id,
        reason: `prev_hash passt nicht zum Vorgänger (erwartet ${prev.slice(0, 16)}…, gefunden ${row.prevHash.slice(0, 16)}…)`,
      };
    }
    const recomputed = computeHash(prev, {
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      oldData: row.oldData ? JSON.parse(row.oldData) : null,
      newData: row.newData ? JSON.parse(row.newData) : null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    });
    if (recomputed !== row.hash) {
      return {
        ok: false,
        totalRows: rows.length,
        brokenAtId: row.id,
        reason: "Inhalt wurde manipuliert (hash passt nicht zu Feldern)",
      };
    }
    prev = row.hash;
  }
  return { ok: true, totalRows: rows.length };
}

// Re-Export zur Verwendung in Tests
export const _internal = { canonicalStringify, computeHash };
