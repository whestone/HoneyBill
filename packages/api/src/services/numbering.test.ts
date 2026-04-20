import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { assignNextNumber, formatNumberFromTemplate } from "./numbering.service.js";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE number_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL DEFAULT '',
      suffix TEXT NOT NULL DEFAULT '',
      year_segment INTEGER NOT NULL DEFAULT 1,
      month_segment INTEGER NOT NULL DEFAULT 0,
      padding INTEGER NOT NULL DEFAULT 5,
      format TEXT,
      next_counter INTEGER NOT NULL DEFAULT 1,
      last_reset_at TEXT,
      reset_yearly INTEGER NOT NULL DEFAULT 1,
      reset_monthly INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe("formatNumberFromTemplate", () => {
  it("ersetzt Platzhalter YYYY, YY, MM und N...", () => {
    expect(formatNumberFromTemplate("RE-{YYYY}-{MM}-{NNNNN}", 42, "2026-04-16")).toBe(
      "RE-2026-04-00042",
    );
  });
});

describe("assignNextNumber — Reset-Logik", () => {
  it("inkrementiert fortlaufend ohne Reset", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO number_series (document_type, format, reset_yearly, reset_monthly) VALUES ('INVOICE', 'RE-{NNNNN}', 0, 0)",
    ).run();
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-01-15")).toBe("RE-00001");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-05-20")).toBe("RE-00002");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2027-02-01")).toBe("RE-00003");
  });

  it("setzt jährlich zurück wenn reset_yearly aktiv ist", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO number_series (document_type, format, reset_yearly, reset_monthly) VALUES ('INVOICE', 'RE-{YYYY}-{NNNNN}', 1, 0)",
    ).run();
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-04-15")).toBe("RE-2026-00001");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-12-31")).toBe("RE-2026-00002");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2027-01-01")).toBe("RE-2027-00001");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2027-03-10")).toBe("RE-2027-00002");
  });

  it("setzt monatlich zurück wenn reset_monthly aktiv ist", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO number_series (document_type, format, reset_yearly, reset_monthly) VALUES ('INVOICE', 'RE-{YYYY}-{MM}-{NNNN}', 0, 1)",
    ).run();
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-04-01")).toBe("RE-2026-04-0001");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-04-15")).toBe("RE-2026-04-0002");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-04-30")).toBe("RE-2026-04-0003");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-05-01")).toBe("RE-2026-05-0001");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2027-01-01")).toBe("RE-2027-01-0001");
  });

  it("monatlich hat Vorrang vor jährlich, wenn beide Flags gesetzt sind", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO number_series (document_type, format, reset_yearly, reset_monthly) VALUES ('INVOICE', 'RE-{YYYY}-{MM}-{NNNN}', 1, 1)",
    ).run();
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-04-15")).toBe("RE-2026-04-0001");
    expect(assignNextNumber(db as any, "INVOICE" as any, "2026-05-15")).toBe("RE-2026-05-0001");
  });
});
