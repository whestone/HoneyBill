import type { Database as BetterSQLite3 } from "better-sqlite3";
import type { DocumentType } from "@honeybill/shared";

interface SeriesRow {
  id: number;
  document_type: string;
  prefix: string;
  suffix: string;
  year_segment: number;
  month_segment: number;
  padding: number;
  next_counter: number;
  last_reset_at: string | null;
  reset_yearly: number;
  reset_monthly: number;
  format: string | null;
}

/**
 * Entscheidet, ob der Zaehler fuer das gegebene Ausstellungsdatum zurueckgesetzt
 * werden muss. Monatlich schlaegt jaehrlich: wenn beide Flags aktiv sind, reicht
 * ein Monatswechsel fuer den Reset.
 *
 * - reset_monthly: reset bei Wechsel des Jahr-Monats (YYYY-MM)
 * - reset_yearly:  reset bei Wechsel des Jahres (YYYY)
 */
function shouldReset(series: SeriesRow, issueDate: string): boolean {
  if (!series.last_reset_at) return false; // erster Run — nichts zurueckzusetzen
  if (series.reset_monthly) {
    return series.last_reset_at.slice(0, 7) !== issueDate.slice(0, 7);
  }
  if (series.reset_yearly) {
    return series.last_reset_at.slice(0, 4) !== issueDate.slice(0, 4);
  }
  return false;
}

/**
 * Format template variables:
 *   {YYYY}  → 4-digit year
 *   {YY}    → 2-digit year
 *   {MM}    → 2-digit month
 *   {N}, {NN}, ... → counter padded to N digits
 */
export function formatNumberFromTemplate(format: string, counter: number, issueDate: string): string {
  const year4 = issueDate.slice(0, 4);
  const year2 = issueDate.slice(2, 4);
  const month = issueDate.slice(5, 7);

  // Replace counter placeholder: one or more N inside braces
  const result = format
    .replace(/\{YYYY\}/g, year4)
    .replace(/\{YY\}/g, year2)
    .replace(/\{MM\}/g, month)
    .replace(/\{(N+)\}/g, (_match, ns: string) => String(counter).padStart(ns.length, "0"));

  return result;
}

/** Build default format from legacy columns */
function legacyFormat(series: SeriesRow): string {
  const padStr = "N".repeat(series.padding || 5);
  let middle = "";
  if (series.year_segment && series.month_segment) {
    middle = "{YYYY}-{MM}-";
  } else if (series.year_segment) {
    middle = "{YYYY}-";
  } else if (series.month_segment) {
    middle = "{MM}-";
  }
  return `${series.prefix}${middle}{${padStr}}${series.suffix}`;
}

/** Resolve the effective format: use stored format if set, else derive from legacy columns */
function effectiveFormat(series: SeriesRow): string {
  return series.format?.trim() || legacyFormat(series);
}

/** Atomically assign the next document number. Must be called inside a transaction context. */
export function assignNextNumber(sqlite: BetterSQLite3, documentType: DocumentType, issueDate: string): string {
  return sqlite.transaction(() => {
    const series = sqlite
      .prepare<string, SeriesRow>("SELECT * FROM number_series WHERE document_type = ?")
      .get(documentType);

    if (!series) {
      throw new Error(`No number series configured for document type: ${documentType}`);
    }

    let counter = series.next_counter;
    if (shouldReset(series, issueDate)) {
      counter = 1;
    }

    const fmt = effectiveFormat(series);
    const docNumber = formatNumberFromTemplate(fmt, counter, issueDate);

    sqlite
      .prepare(
        "UPDATE number_series SET next_counter = ?, last_reset_at = ?, updated_at = datetime('now') WHERE document_type = ?"
      )
      .run(counter + 1, issueDate, documentType);

    return docNumber;
  })();
}

/** Preview the next number without consuming it. */
export function previewNextNumber(sqlite: BetterSQLite3, documentType: DocumentType, format?: string): string {
  const series = sqlite
    .prepare<string, SeriesRow>("SELECT * FROM number_series WHERE document_type = ?")
    .get(documentType);

  if (!series) return "???";

  const today = new Date().toISOString().slice(0, 10);
  let counter = series.next_counter;
  if (shouldReset(series, today)) {
    counter = 1;
  }

  const fmt = format ?? effectiveFormat(series);
  return formatNumberFromTemplate(fmt, counter, today);
}

/** Validate a format string: must contain at least one {N+} placeholder */
export function validateFormat(format: string): boolean {
  return /\{N+\}/.test(format);
}
