import type { FastifyInstance } from "fastify";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../db/index.js";
import { documents, payments } from "../db/schema.js";

export async function openItemsRoutes(app: FastifyInstance) {
  // GET /api/v1/open-items
  app.get("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { customer?: string; overdue?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [
      inArray(documents.status, ["FINAL", "SENT", "PARTIAL"]),
      eq(documents.documentType, "INVOICE"),
    ];
    if (q.customer) conditions.push(eq(documents.customerId, Number(q.customer)));

    const invoices = await db.query.documents.findMany({
      where: and(...conditions),
      with: { customer: true, payments: true },
      orderBy: [documents.dueDate],
      limit,
      offset,
    });

    // Fetch all finalized credit notes for these invoices in one query
    const invoiceIds = invoices.map((inv) => inv.id);
    const creditNotes = invoiceIds.length > 0 ? await db.query.documents.findMany({
      where: and(
        eq(documents.documentType, "CREDIT_NOTE"),
        inArray(documents.status, ["FINAL", "SENT", "PAID"]),
        inArray(documents.cancelsDocumentId, invoiceIds)
      ),
    }) : [];
    const creditNotesByInvoice = new Map<number, Decimal>();
    for (const cn of creditNotes) {
      if (cn.cancelsDocumentId == null) continue;
      const prev = creditNotesByInvoice.get(cn.cancelsDocumentId) ?? new Decimal(0);
      creditNotesByInvoice.set(cn.cancelsDocumentId, prev.plus(new Decimal(cn.totalGross)));
    }

    const today = new Date().toISOString().slice(0, 10);
    const openItems = invoices.map((inv) => {
      const paid = (inv.payments ?? []).reduce(
        (acc, p) => acc.plus(new Decimal(p.amount)),
        new Decimal(0)
      );
      const credited = creditNotesByInvoice.get(inv.id) ?? new Decimal(0);
      const open = new Decimal(inv.totalGross).minus(paid).minus(credited);
      const overdue = inv.dueDate != null && inv.dueDate < today && open.greaterThan(0);
      return {
        ...inv,
        paidAmount: paid.toFixed(2),
        openAmount: open.toFixed(2),
        isOverdue: overdue,
        daysOverdue: overdue && inv.dueDate
          ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
          : 0,
      };
    });

    const filtered = q.overdue === "true" ? openItems.filter((i) => i.isOverdue) : openItems;

    return reply.send({
      data: filtered,
      page,
      limit,
    });
  });

  // GET /api/v1/open-items/summary
  app.get("/summary", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const invoices = await db.query.documents.findMany({
      where: and(
        inArray(documents.status, ["FINAL", "SENT", "PARTIAL"]),
        eq(documents.documentType, "INVOICE")
      ),
      with: { payments: true },
    });

    const allIds = invoices.map((i) => i.id);
    const summaryCreditNotes = allIds.length > 0 ? await db.query.documents.findMany({
      where: and(
        eq(documents.documentType, "CREDIT_NOTE"),
        inArray(documents.status, ["FINAL", "SENT", "PAID"]),
        inArray(documents.cancelsDocumentId, allIds)
      ),
    }) : [];
    const summaryCreditMap = new Map<number, Decimal>();
    for (const cn of summaryCreditNotes) {
      if (cn.cancelsDocumentId == null) continue;
      const prev = summaryCreditMap.get(cn.cancelsDocumentId) ?? new Decimal(0);
      summaryCreditMap.set(cn.cancelsDocumentId, prev.plus(new Decimal(cn.totalGross)));
    }

    const today = new Date().toISOString().slice(0, 10);
    let totalOpen = new Decimal(0);
    let totalOverdue = new Decimal(0);
    let count = 0;
    let overdueCount = 0;

    for (const inv of invoices) {
      const paid = (inv.payments ?? []).reduce(
        (acc, p) => acc.plus(new Decimal(p.amount)),
        new Decimal(0)
      );
      const credited = summaryCreditMap.get(inv.id) ?? new Decimal(0);
      const open = new Decimal(inv.totalGross).minus(paid).minus(credited);
      if (open.greaterThan(0)) {
        count++;
        totalOpen = totalOpen.plus(open);
        if (inv.dueDate && inv.dueDate < today) {
          overdueCount++;
          totalOverdue = totalOverdue.plus(open);
        }
      }
    }

    return reply.send({
      totalOpen: totalOpen.toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
      count,
      overdueCount,
    });
  });
}
