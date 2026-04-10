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
}

/** Format a document number from series config + counter + date. */
export function formatNumber(series: SeriesRow, counter: number, issueDate: string): string {
  const year = issueDate.slice(0, 4);
  const month = issueDate.slice(5, 7);
  const padded = String(counter).padStart(series.padding, "0");

  let middle = "";
  if (series.year_segment && series.month_segment) {
    middle = `${year}-${month}-`;
  } else if (series.year_segment) {
    middle = `${year}-`;
  } else if (series.month_segment) {
    middle = `${month}-`;
  }

  return `${series.prefix}${middle}${padded}${series.suffix}`;
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

    // Handle yearly reset
    const issueYear = issueDate.slice(0, 4);
    let counter = series.next_counter;

    if (series.reset_yearly && series.last_reset_at?.slice(0, 4) !== issueYear) {
      counter = 1;
    }

    const docNumber = formatNumber(series, counter, issueDate);

    sqlite
      .prepare(
        "UPDATE number_series SET next_counter = ?, last_reset_at = ?, updated_at = datetime('now') WHERE document_type = ?"
      )
      .run(counter + 1, issueDate, documentType);

    return docNumber;
  })();
}

/** Preview the next number without consuming it. */
export function previewNextNumber(sqlite: BetterSQLite3, documentType: DocumentType): string {
  const series = sqlite
    .prepare<string, SeriesRow>("SELECT * FROM number_series WHERE document_type = ?")
    .get(documentType);

  if (!series) return "???";

  const today = new Date().toISOString().slice(0, 10);
  const issueYear = today.slice(0, 4);
  let counter = series.next_counter;

  if (series.reset_yearly && series.last_reset_at?.slice(0, 4) !== issueYear) {
    counter = 1;
  }

  return formatNumber(series, counter, today);
}
