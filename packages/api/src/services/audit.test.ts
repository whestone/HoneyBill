import { describe, expect, it } from "vitest";
import { _internal } from "./audit.service.js";

const { canonicalStringify, computeHash } = _internal;

describe("canonicalStringify", () => {
  it("erzeugt deterministische Ausgabe unabhängig von Key-Reihenfolge", () => {
    const a = canonicalStringify({ b: 2, a: 1 });
    const b = canonicalStringify({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("filtert undefined raus und behandelt null", () => {
    const out = canonicalStringify({ x: undefined, y: null, z: 1 });
    expect(out).toBe('{"y":null,"z":1}');
  });

  it("serialisiert geschachtelte Strukturen deterministisch", () => {
    const a = canonicalStringify({ outer: { b: 2, a: [3, 1, 2] } });
    const b = canonicalStringify({ outer: { a: [3, 1, 2], b: 2 } });
    expect(a).toBe(b);
  });
});

describe("computeHash", () => {
  const base = {
    userId: 1,
    action: "finalize",
    entityType: "document",
    entityId: 42,
    oldData: null,
    newData: { documentNumber: "RE-2026-00001", totalGross: "119.00" },
    ipAddress: "127.0.0.1",
    userAgent: "test",
    createdAt: "2026-04-19T10:00:00.000Z",
  };

  it("ist deterministisch für identische Eingaben", () => {
    expect(computeHash("GENESIS", base)).toBe(computeHash("GENESIS", base));
  });

  it("ändert sich bei Manipulation eines Feldes", () => {
    const h1 = computeHash("GENESIS", base);
    const h2 = computeHash("GENESIS", { ...base, newData: { documentNumber: "RE-2026-00001", totalGross: "999.00" } });
    expect(h1).not.toBe(h2);
  });

  it("ändert sich bei unterschiedlichem prevHash", () => {
    const h1 = computeHash("GENESIS", base);
    const h2 = computeHash("OTHER", base);
    expect(h1).not.toBe(h2);
  });

  it("ergibt einen 64-Zeichen-Hex-String (SHA-256)", () => {
    const h = computeHash("GENESIS", base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
