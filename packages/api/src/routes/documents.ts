import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../db/index.js";
import { documentFiles, documentLineItems, documentTaxLines, documents, payments } from "../db/schema.js";
import {
  CreateDocumentSchema,
  CreatePaymentSchema,
  UpdateDocumentSchema,
} from "@honeybill/shared";
import {
  cancelDocument,
  createDocument,
  finalizeDocument,
  recordPayment,
  updateDocument,
} from "../services/document.service.js";
import { generateZugferdXml, generateXRechnungXml } from "../services/einvoice/xrechnung.service.js";
import { packageZugferdPdf } from "../services/einvoice/zugferd.service.js";
import { db as rawDb } from "../db/index.js";
import type { Customer, CompanySettings, Document } from "@honeybill/shared";
import { companySettings, customers } from "../db/schema.js";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.js";

export async function documentRoutes(app: FastifyInstance) {
  // GET /api/v1/documents
  app.get("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as {
      type?: string; status?: string; customer?: string;
      from?: string; to?: string; q?: string; page?: string; limit?: string;
    };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (q.type) conditions.push(eq(documents.documentType, q.type));
    if (q.status) conditions.push(eq(documents.status, q.status));
    if (q.customer) conditions.push(eq(documents.customerId, Number(q.customer)));
    if (q.q) conditions.push(sql`${documents.documentNumber} LIKE ${"%" + q.q + "%"}`);

    const [total, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(conditions.length ? and(...conditions) : undefined)
        .then((r) => r[0]?.count ?? 0),
      db.query.documents.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        with: { customer: true },
        orderBy: [desc(documents.createdAt)],
        limit,
        offset,
      }),
    ]);

    return reply.send({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // GET /api/v1/documents/stats
  app.get("/stats", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevY = now.getMonth() === 0 ? y - 1 : y;
    const thisStart = `${y}-${m}-01`;
    const lastStart = `${prevY}-${String(prevM).padStart(2, "0")}-01`;

    const [invoices, drafts] = await Promise.all([
      db.query.documents.findMany({
        where: and(
          eq(documents.documentType, "INVOICE"),
          inArray(documents.status, ["FINAL", "SENT", "PAID", "PARTIAL"])
        ),
      }),
      db.select({ count: sql<number>`count(*)` }).from(documents)
        .where(eq(documents.status, "DRAFT")).then((r) => r[0]?.count ?? 0),
    ]);

    let revenueThisMonth = new Decimal(0);
    let revenueLastMonth = new Decimal(0);
    for (const inv of invoices) {
      const date = inv.issueDate ?? inv.createdAt.slice(0, 10);
      if (date >= thisStart) revenueThisMonth = revenueThisMonth.plus(inv.totalGross);
      else if (date >= lastStart && date < thisStart) revenueLastMonth = revenueLastMonth.plus(inv.totalGross);
    }

    return reply.send({
      revenueThisMonth: revenueThisMonth.toFixed(2),
      revenueLastMonth: revenueLastMonth.toFixed(2),
      draftCount: Number(drafts),
      invoiceCount: invoices.length,
    });
  });

  // POST /api/v1/documents
  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = CreateDocumentSchema.parse(req.body);
    const payload = req.user as { sub: string };
    const doc = await createDocument(db, input, Number(payload.sub));
    return reply.status(201).send(doc);
  });

  // GET /api/v1/documents/:id
  app.get("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, Number(id)),
      with: {
        customer: true,
        lineItems: { orderBy: [documentLineItems.position] },
        taxLines: true,
        payments: { orderBy: [desc(payments.paymentDate)] },
        cancelsDocument: true,
      },
    });
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    return reply.send(doc);
  });

  // PUT /api/v1/documents/:id
  app.put("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = UpdateDocumentSchema.parse(req.body);
    const doc = await updateDocument(db, Number(id), input);
    return reply.send(doc);
  });

  // DELETE /api/v1/documents/:id (DRAFT only)
  app.delete("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, Number(id)) });
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    if (doc.status !== "DRAFT") return reply.status(409).send({ message: "Nur Entwürfe können gelöscht werden" });
    await db.delete(documents).where(eq(documents.id, Number(id)));
    return reply.status(204).send();
  });

  // POST /api/v1/documents/:id/finalize
  app.post("/:id/finalize", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as { sub: string };
    const doc = await finalizeDocument(db, Number(id), Number(payload.sub));
    return reply.send(doc);
  });

  // POST /api/v1/documents/:id/send
  app.post("/:id/send", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, Number(id)) });
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    if (doc.status !== "FINAL") return reply.status(409).send({ message: "Beleg muss finalisiert sein" });
    await db
      .update(documents)
      .set({ status: "SENT", updatedAt: new Date().toISOString() })
      .where(eq(documents.id, Number(id)));
    return reply.send({ ok: true });
  });

  // PATCH /api/v1/documents/:id/notes — update internalNotes regardless of status
  app.patch("/:id/notes", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { internalNotes } = req.body as { internalNotes: string | null };
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, Number(id)) });
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    await db
      .update(documents)
      .set({ internalNotes: internalNotes ?? null, updatedAt: new Date().toISOString() })
      .where(eq(documents.id, Number(id)));
    return reply.send({ ok: true });
  });

  // POST /api/v1/documents/:id/cancel
  // Cancels a finalized document by creating an auto-finalized counter-document with negated amounts:
  // INVOICE → CREDIT_NOTE (negative), CREDIT_NOTE → INVOICE (double-negation = positive)
  app.post("/:id/cancel", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = Number((req.user as { sub: string }).sub);

    const source = await db.query.documents.findFirst({
      where: eq(documents.id, Number(id)),
      with: { lineItems: true },
    });
    if (!source) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    if (!["FINAL", "SENT", "PARTIAL"].includes(source.status)) {
      return reply.status(409).send({ message: "Nur finalisierte Belege können storniert werden" });
    }

    // Create Stornobeleg: CREDIT_NOTE cancels an INVOICE; INVOICE cancels a CREDIT_NOTE
    const stornoType = source.documentType === "CREDIT_NOTE" ? "INVOICE" : "CREDIT_NOTE";
    const storno = await createDocument(
      db,
      {
        documentType: stornoType,
        customerId: source.customerId,
        cancelsDocumentId: source.id,
        currency: source.currency,
        globalDiscountPct: source.globalDiscountPct ?? "0.00",
        lineItems: (source.lineItems ?? []).map((li) => ({
          position: li.position,
          lineType: li.lineType as "ITEM" | "TEXT" | "SUBTOTAL" | "PAGEBREAK",
          productId: li.productId ?? undefined,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          // Negate the unit price to reverse the original
          unitPrice: li.lineType === "ITEM"
            ? (li.unitPrice.startsWith("-") ? li.unitPrice : `-${li.unitPrice}`)
            : li.unitPrice,
          discountPct: li.discountPct,
          discountType: (li.discountType ?? "pct") as "pct" | "abs",
          taxRateId: li.taxRateId ?? undefined,
        })),
      },
      userId
    );

    // Auto-finalize the Stornorechnung
    await finalizeDocument(db, storno.id, userId);

    // Cancel the original document
    await cancelDocument(db, Number(id), userId);

    return reply.send({ ok: true, stornoId: storno.id });
  });

  // POST /api/v1/documents/:id/convert-to-invoice
  app.post("/:id/convert-to-invoice", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as { sub: string };
    const source = await db.query.documents.findFirst({
      where: eq(documents.id, Number(id)),
      with: { lineItems: true },
    });
    if (!source) return reply.status(404).send({ message: "Beleg nicht gefunden" });

    const invoice = await createDocument(
      db,
      {
        documentType: "INVOICE",
        customerId: source.customerId,
        deliveryDate: source.deliveryDate ?? undefined,
        sourceDocumentId: source.id,
        currency: source.currency,
        paymentDays: source.paymentDays ?? undefined,
        leitwegId: source.leitwegId ?? undefined,
        einvoiceProfile: (source.einvoiceProfile as "ZUGFERD_EXTENDED" | "XRECHNUNG" | null | undefined),
        lineItems: (source.lineItems ?? []).map((li) => ({
          position: li.position,
          lineType: li.lineType as "ITEM" | "TEXT" | "SUBTOTAL" | "PAGEBREAK",
          productId: li.productId ?? undefined,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          discountPct: li.discountPct,
          discountType: (li.discountType ?? "pct") as "pct" | "abs",
          taxRateId: li.taxRateId ?? undefined,
        })),
      },
      Number(payload.sub)
    );
    return reply.status(201).send(invoice);
  });

  // POST /api/v1/documents/:id/create-credit-note
  app.post("/:id/create-credit-note", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as { sub: string };
    const source = await db.query.documents.findFirst({
      where: eq(documents.id, Number(id)),
      with: { lineItems: true },
    });
    if (!source) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    if (source.documentType !== "INVOICE") {
      return reply.status(409).send({ message: "Nur Rechnungen können gutgeschrieben werden" });
    }

    const credit = await createDocument(
      db,
      {
        documentType: "CREDIT_NOTE",
        customerId: source.customerId,
        cancelsDocumentId: source.id,
        currency: source.currency,
        lineItems: (source.lineItems ?? []).map((li) => ({
          position: li.position,
          lineType: li.lineType as "ITEM" | "TEXT" | "SUBTOTAL" | "PAGEBREAK",
          productId: li.productId ?? undefined,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          // Negate unit price so the Gutschrift reverses the original amounts
          unitPrice: li.lineType === "ITEM"
            ? (li.unitPrice.startsWith("-") ? li.unitPrice : `-${li.unitPrice}`)
            : li.unitPrice,
          discountPct: li.discountPct,
          discountType: (li.discountType ?? "pct") as "pct" | "abs",
          taxRateId: li.taxRateId ?? undefined,
        })),
      },
      Number(payload.sub)
    );
    return reply.status(201).send(credit);
  });

  // POST /api/v1/documents/:id/create-delivery-note
  app.post("/:id/create-delivery-note", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as { sub: string };
    const source = await db.query.documents.findFirst({
      where: eq(documents.id, Number(id)),
      with: { lineItems: true },
    });
    if (!source) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    if (!["QUOTE", "INVOICE"].includes(source.documentType)) {
      return reply.status(409).send({ message: "Nur Angebote und Rechnungen können als Lieferschein erstellt werden" });
    }

    const delivery = await createDocument(
      db,
      {
        documentType: "DELIVERY_NOTE",
        customerId: source.customerId,
        sourceDocumentId: source.id,
        deliveryDate: source.deliveryDate ?? undefined,
        currency: source.currency,
        lineItems: (source.lineItems ?? []).map((li) => ({
          position: li.position,
          lineType: li.lineType as "ITEM" | "TEXT" | "SUBTOTAL" | "PAGEBREAK",
          productId: li.productId ?? undefined,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          discountPct: li.discountPct,
          discountType: (li.discountType ?? "pct") as "pct" | "abs",
          taxRateId: li.taxRateId ?? undefined,
        })),
      },
      Number(payload.sub)
    );
    return reply.status(201).send(delivery);
  });

  // GET /api/v1/documents/:id/related
  // BFS traversal: walks the full chain in both directions (parents + children)
  // so that even deep storno chains (A→B→C→D) are fully returned from any node.
  app.get("/:id/related", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const startId = Number(id);

    const visited = new Set<number>([startId]);
    const queue: number[] = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Fetch parents: docs that this doc references
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, current),
        columns: { id: true, sourceDocumentId: true, cancelsDocumentId: true },
      });
      if (doc) {
        for (const pid of [doc.sourceDocumentId, doc.cancelsDocumentId]) {
          if (pid != null && !visited.has(pid)) {
            visited.add(pid);
            queue.push(pid);
          }
        }
      }

      // Fetch children: docs that reference this doc
      const children = await db.query.documents.findMany({
        where: or(eq(documents.sourceDocumentId, current), eq(documents.cancelsDocumentId, current)),
        columns: { id: true },
      });
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          queue.push(child.id);
        }
      }
    }

    visited.delete(startId);
    if (visited.size === 0) return reply.send([]);

    const rows = await db.query.documents.findMany({
      where: inArray(documents.id, Array.from(visited)),
      with: { customer: true },
      orderBy: [asc(documents.createdAt)],
    });
    return reply.send(rows);
  });

  // GET /api/v1/documents/:id/payments
  app.get("/:id/payments", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await db.query.payments.findMany({
      where: eq(payments.documentId, Number(id)),
      orderBy: [desc(payments.paymentDate)],
    });
    return reply.send(rows);
  });

  // POST /api/v1/documents/:id/payments
  app.post("/:id/payments", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = CreatePaymentSchema.parse(req.body);
    const payload = req.user as { sub: string };
    const payment = await recordPayment(db, Number(id), input, Number(payload.sub));
    return reply.status(201).send(payment);
  });

  // DELETE /api/v1/documents/:id/payments/:paymentId
  app.delete("/:id/payments/:paymentId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id, paymentId } = req.params as { id: string; paymentId: string };
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, Number(id)) });
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });

    await db.delete(payments).where(eq(payments.id, Number(paymentId)));

    // Recalculate document status
    const remaining = await db.query.payments.findMany({ where: eq(payments.documentId, Number(id)) });
    const totalPaid = remaining.reduce(
      (acc, p) => acc.plus(new Decimal(p.amount)),
      new Decimal(0)
    );
    const totalGross = new Decimal(doc.totalGross);
    let newStatus: string;
    if (totalPaid.greaterThanOrEqualTo(totalGross)) {
      newStatus = "PAID";
    } else if (totalPaid.greaterThan(0)) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "SENT";
    }
    await db.update(documents).set({ status: newStatus, updatedAt: new Date().toISOString() }).where(eq(documents.id, Number(id)));

    return reply.status(204).send();
  });

  // GET /api/v1/documents/:id/xrechnung-xml
  app.get("/:id/xrechnung-xml", { onRequest: [app.authenticate] }, async (req, reply) => {
    const doc = await getFullDocument(Number((req.params as { id: string }).id));
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });
    const company = await getCompanySettings();
    const xml = generateXRechnungXml(doc as any, doc.customer as Customer, company);
    reply
      .header("Content-Type", "application/xml")
      .header("Content-Disposition", `attachment; filename="xrechnung-${doc.documentNumber}.xml"`);
    return reply.send(xml);
  });

  // GET /api/v1/documents/:id/zugferd-pdf
  // Expects a PDF to be POSTed as multipart, packages it as ZUGFeRD PDF/A-3
  app.post("/:id/zugferd-pdf", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await getFullDocument(Number(id));
    if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });

    const data = await (req as any).file();
    const pdfBytes = await data.toBuffer();

    const company = await getCompanySettings();
    const xml = generateZugferdXml(doc as any, doc.customer as Customer, company);
    const zugferdPdf = await packageZugferdPdf(new Uint8Array(pdfBytes), xml);

    // Save to disk
    const exportDir = path.join(config.exportsDir, "documents", String(id));
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, "zugferd.pdf");
    fs.writeFileSync(filePath, zugferdPdf);

    // Record in document_files
    await db.insert(documentFiles).values({
      documentId: Number(id),
      fileType: "ZUGFERD_PDF",
      filePath: path.relative(config.exportsDir, filePath),
      fileName: `zugferd-${doc.documentNumber}.pdf`,
      fileSize: zugferdPdf.length,
      mimeType: "application/pdf",
    }).onConflictDoNothing();

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="zugferd-${doc.documentNumber}.pdf"`);
    return reply.send(Buffer.from(zugferdPdf));
  });
}

async function getFullDocument(id: number) {
  return db.query.documents.findFirst({
    where: eq(documents.id, id),
    with: {
      customer: true,
      lineItems: { orderBy: [documentLineItems.position] },
      taxLines: true,
    },
  });
}

async function getCompanySettings() {
  const [row] = await db.select().from(companySettings).limit(1);
  return (row ?? {}) as CompanySettings;
}
