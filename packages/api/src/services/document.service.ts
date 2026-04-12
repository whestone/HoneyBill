import { and, eq, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import type { DB } from "../db/index.js";
import { sqlite } from "../db/index.js";
import {
  companySettings,
  customers,
  documentLineItems,
  documentTaxLines,
  documents,
  payments,
  taxRates,
} from "../db/schema.js";
import type { CreateDocumentInput, UpdateDocumentInput } from "@honeybill/shared";
import { computeLineGross, computeLineNet, computeLineTax } from "@honeybill/shared";
import { assignNextNumber } from "./numbering.service.js";
import type { DocumentType } from "@honeybill/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Create Document ──────────────────────────────────────────────────────────

async function getDefaultPaymentDays(db: DB, customerId: number, explicitDays?: number | null): Promise<number | null> {
  if (explicitDays != null) return explicitDays;
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
  if (customer?.paymentDays != null) return customer.paymentDays;
  const [settings] = await db.select().from(companySettings).limit(1);
  return settings?.defaultPaymentDays ?? null;
}

export async function createDocument(
  db: DB,
  input: CreateDocumentInput,
  userId: number | null
) {
  const resolvedPaymentDays = await getDefaultPaymentDays(db, input.customerId, input.paymentDays);

  const [doc] = await db
    .insert(documents)
    .values({
      documentType: input.documentType,
      customerId: input.customerId,
      deliveryDate: input.deliveryDate ?? null,
      deliveryDateEnd: input.deliveryDateEnd ?? null,
      quoteValidUntil: input.quoteValidUntil ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
      cancelsDocumentId: input.cancelsDocumentId ?? null,
      currency: input.currency ?? "EUR",
      paymentDays: resolvedPaymentDays,
      paymentTermsText: input.paymentTermsText ?? null,
      templateId: input.templateId ?? null,
      einvoiceProfile: input.einvoiceProfile ?? null,
      leitwegId: input.leitwegId ?? null,
      globalDiscountPct: input.globalDiscountPct ?? "0.00",
      globalDiscountType: input.globalDiscountType ?? "pct",
      layoutOverride: input.layoutOverride ? JSON.stringify(input.layoutOverride) : null,
      internalNotes: input.internalNotes ?? null,
      createdBy: userId,
      status: "DRAFT",
    })
    .returning();

  if (!doc) throw new Error("Failed to create document");

  // Insert line items
  if (input.lineItems && input.lineItems.length > 0) {
    await upsertLineItems(db, doc.id, input.lineItems);
    await recalcTotals(db, doc.id);
  }

  return doc;
}

// ─── Update Document (DRAFT only) ────────────────────────────────────────────

export async function updateDocument(
  db: DB,
  docId: number,
  input: UpdateDocumentInput
) {
  const existing = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
  });
  if (!existing) throw new Error("Document not found");
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT documents can be edited");
  }

  const { lineItems, layoutOverride, ...docFields } = input;

  await db
    .update(documents)
    .set({
      ...docFields,
      ...(layoutOverride !== undefined ? { layoutOverride: layoutOverride ? JSON.stringify(layoutOverride) : null } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(documents.id, docId));

  if (lineItems !== undefined) {
    // Delete all existing and re-insert
    await db.delete(documentLineItems).where(eq(documentLineItems.documentId, docId));
    if (lineItems.length > 0) {
      await upsertLineItems(db, docId, lineItems);
    }
    await recalcTotals(db, docId);
  }

  return db.query.documents.findFirst({ where: eq(documents.id, docId) });
}

// ─── Finalize Document ────────────────────────────────────────────────────────

export async function finalizeDocument(db: DB, docId: number, userId: number | null) {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
    with: { lineItems: true },
  });
  if (!doc) throw new Error("Document not found");
  if (doc.status !== "DRAFT") throw new Error("Only DRAFT documents can be finalized");

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, doc.customerId),
  });
  if (!customer) throw new Error("Customer not found");

  const [settings] = await db.select().from(companySettings).limit(1);
  const issueDate = today();
  const paymentDays = doc.paymentDays ?? customer.paymentDays ?? settings?.defaultPaymentDays ?? 14;
  const dueDate =
    doc.documentType === "INVOICE" ? addDays(issueDate, paymentDays) : null;

  // Snapshot customer
  const customerSnapshot = JSON.stringify(customer);

  // Re-compute line items with snapshotted tax rates
  const lineItems = await db.query.documentLineItems.findMany({
    where: eq(documentLineItems.documentId, docId),
    with: { taxRate: true },
  });

  // Snapshot products and recompute totals
  const updatedLineItems = [];
  for (const li of lineItems) {
    if (li.lineType !== "ITEM") continue;
    const taxRate = li.taxRate;
    const taxRatePct = taxRate?.ratePercent ?? "0.00";
    const lineNet = computeLineNet(li.quantity, li.unitPrice, li.discountPct, (li.discountType ?? "pct") as "pct" | "abs");
    const lineTax = computeLineTax(lineNet, taxRatePct);
    const lineGross = computeLineGross(lineNet, lineTax);
    updatedLineItems.push({ ...li, taxRatePct, lineNet, lineTax, lineGross });
  }

  // Assign document number atomically
  const docNumber = assignNextNumber(sqlite, doc.documentType as DocumentType, issueDate);

  // Build tax breakdown
  const globalDiscountVal = new Decimal(doc.globalDiscountPct ?? "0.00");
  const globalDiscountType = doc.globalDiscountType ?? "pct";
  const rawSubtotal = updatedLineItems.reduce((acc: Decimal, li: any) => acc.plus(new Decimal(li.lineNet)), new Decimal(0));
  let discountFactor: Decimal;
  if (globalDiscountType === "abs") {
    const absAmt = Decimal.min(globalDiscountVal, rawSubtotal);
    discountFactor = rawSubtotal.isZero() ? new Decimal(1) : rawSubtotal.minus(absAmt).div(rawSubtotal);
  } else {
    discountFactor = new Decimal(1).minus(globalDiscountVal.div(100));
  }

  const taxMap = new Map<string, { taxRateId: number | null; taxCategory: string; net: Decimal; tax: Decimal }>();
  for (const li of updatedLineItems) {
    const key = li.taxRatePct;
    const existing = taxMap.get(key) ?? {
      taxRateId: li.taxRateId,
      taxCategory: li.taxRate?.taxCategory ?? "S",
      net: new Decimal(0),
      tax: new Decimal(0),
    };
    existing.net = existing.net.plus(new Decimal(li.lineNet));
    existing.tax = existing.tax.plus(new Decimal(li.lineTax));
    taxMap.set(key, existing);
  }

  // Apply global discount proportionally to each tax group
  for (const [, data] of taxMap) {
    data.net = data.net.mul(discountFactor).toDecimalPlaces(2, 4);
    data.tax = data.tax.mul(discountFactor).toDecimalPlaces(2, 4);
  }

  const subtotalNet = Array.from(taxMap.values())
    .reduce((acc, v) => acc.plus(v.net), new Decimal(0))
    .toFixed(2);
  const totalTax = Array.from(taxMap.values())
    .reduce((acc, v) => acc.plus(v.tax), new Decimal(0))
    .toFixed(2);
  const totalGross = new Decimal(subtotalNet).plus(new Decimal(totalTax)).toFixed(2);

  // Persist everything in a single SQLite transaction
  sqlite.transaction(() => {
    // Update line items with snapshotted values
    for (const li of updatedLineItems) {
      sqlite
        .prepare(
          `UPDATE document_line_items
           SET tax_rate_pct = ?, line_net = ?, line_tax = ?, line_gross = ?
           WHERE id = ?`
        )
        .run(li.taxRatePct, li.lineNet, li.lineTax, li.lineGross, li.id);
    }

    // Delete old tax lines and re-insert
    sqlite
      .prepare("DELETE FROM document_tax_lines WHERE document_id = ?")
      .run(docId);

    for (const [taxRatePct, data] of taxMap) {
      sqlite
        .prepare(
          `INSERT INTO document_tax_lines
             (document_id, tax_rate_id, tax_rate_pct, tax_category, taxable_amount, tax_amount)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          docId,
          data.taxRateId,
          taxRatePct,
          data.taxCategory,
          data.net.toFixed(2),
          data.tax.toFixed(2)
        );
    }

    // Update document
    sqlite
      .prepare(
        `UPDATE documents SET
           status = 'FINAL',
           document_number = ?,
           issue_date = ?,
           due_date = ?,
           payment_days = ?,
           customer_snapshot = ?,
           subtotal_net = ?,
           total_tax = ?,
           total_gross = ?,
           finalized_by = ?,
           finalized_at = datetime('now'),
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        docNumber,
        issueDate,
        dueDate,
        paymentDays,
        customerSnapshot,
        subtotalNet,
        totalTax,
        totalGross,
        userId,
        docId
      );
  })();

  return db.query.documents.findFirst({ where: eq(documents.id, docId) });
}

// ─── Cancel Document ──────────────────────────────────────────────────────────

export async function cancelDocument(db: DB, docId: number, userId: number | null) {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) throw new Error("Document not found");
  if (!["FINAL", "SENT", "PARTIAL"].includes(doc.status)) {
    throw new Error("Only FINAL, SENT, or PARTIAL documents can be cancelled");
  }

  await db
    .update(documents)
    .set({ status: "CANCELLED", updatedAt: new Date().toISOString() })
    .where(eq(documents.id, docId));
}

// ─── Record Payment ───────────────────────────────────────────────────────────

export async function recordPayment(
  db: DB,
  docId: number,
  input: { paymentDate: string; amount: string; paymentMethod?: string | null; reference?: string | null; notes?: string | null },
  userId: number | null
) {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
    with: { payments: true },
  });
  if (!doc) throw new Error("Document not found");
  if (!["FINAL", "SENT", "PARTIAL"].includes(doc.status)) {
    throw new Error("Cannot record payment for document in status: " + doc.status);
  }

  const [payment] = await db
    .insert(payments)
    .values({
      documentId: docId,
      paymentDate: input.paymentDate,
      amount: input.amount,
      paymentMethod: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      createdBy: userId,
    })
    .returning();

  // Calculate total paid (including this payment)
  const allPayments = await db.query.payments.findMany({
    where: eq(payments.documentId, docId),
  });
  const totalPaid = allPayments.reduce(
    (acc, p) => acc.plus(new Decimal(p.amount)),
    new Decimal(0)
  );
  const totalGross = new Decimal(doc.totalGross);

  let newStatus: string;
  if (totalPaid.greaterThanOrEqualTo(totalGross)) {
    newStatus = "PAID";
  } else {
    newStatus = "PARTIAL";
  }

  await db
    .update(documents)
    .set({ status: newStatus, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, docId));

  return payment;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function upsertLineItems(
  db: DB,
  docId: number,
  lineItems: CreateDocumentInput["lineItems"]
) {
  // Get current tax rates for reference
  const allTaxRates = await db.query.taxRates.findMany();
  const taxRateMap = new Map(allTaxRates.map((tr) => [tr.id, tr]));

  const values = lineItems.map((li) => {
    const taxRate = li.taxRateId ? taxRateMap.get(li.taxRateId) : null;
    const taxRatePct = taxRate?.ratePercent ?? "0.00";
    const lineNet = li.lineType === "ITEM" ? computeLineNet(li.quantity, li.unitPrice, li.discountPct, (li.discountType ?? "pct") as "pct" | "abs") : "0.00";
    const lineTax = li.lineType === "ITEM" ? computeLineTax(lineNet, taxRatePct) : "0.00";
    const lineGross = li.lineType === "ITEM" ? computeLineGross(lineNet, lineTax) : "0.00";

    return {
      documentId: docId,
      position: li.position,
      lineType: li.lineType ?? "ITEM",
      productId: li.productId ?? null,
      description: li.description ?? "",
      quantity: li.quantity ?? "1",
      unit: li.unit ?? "Stk",
      unitPrice: li.unitPrice ?? "0.00",
      discountPct: li.discountPct ?? "0.00",
      discountType: li.discountType ?? "pct",
      taxRateId: li.taxRateId ?? null,
      taxRatePct,
      lineNet,
      lineTax,
      lineGross,
    };
  });

  if (values.length > 0) {
    await db.insert(documentLineItems).values(values);
  }
}

async function recalcTotals(db: DB, docId: number) {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  const globalDiscountVal = new Decimal(doc?.globalDiscountPct ?? "0.00");
  const globalDiscountType = doc?.globalDiscountType ?? "pct";

  const lines = await db.query.documentLineItems.findMany({
    where: and(
      eq(documentLineItems.documentId, docId),
      inArray(documentLineItems.lineType, ["ITEM"])
    ),
  });

  const rawNet = lines.reduce((acc, li) => acc.plus(new Decimal(li.lineNet)), new Decimal(0));
  const rawTax = lines.reduce((acc, li) => acc.plus(new Decimal(li.lineTax)), new Decimal(0));

  let discountFactor: Decimal;
  if (globalDiscountType === "abs") {
    const absAmt = Decimal.min(globalDiscountVal, rawNet);
    discountFactor = rawNet.isZero() ? new Decimal(1) : rawNet.minus(absAmt).div(rawNet);
  } else {
    discountFactor = new Decimal(1).minus(globalDiscountVal.div(100));
  }

  const subtotalNet = rawNet.mul(discountFactor).toDecimalPlaces(2, 4).toFixed(2);
  const totalTax = rawTax.mul(discountFactor).toDecimalPlaces(2, 4).toFixed(2);
  const totalGross = new Decimal(subtotalNet).plus(new Decimal(totalTax)).toFixed(2);

  await db
    .update(documents)
    .set({ subtotalNet, totalTax, totalGross, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, docId));
}
