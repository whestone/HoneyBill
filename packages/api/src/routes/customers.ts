import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../db/index.js";
import { customers, documents } from "../db/schema.js";
import { CreateCustomerSchema, UpdateCustomerSchema } from "@honeybill/shared";

export async function customerRoutes(app: FastifyInstance) {
  // GET /api/v1/customers
  app.get("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { q?: string; archived?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
    const offset = (page - 1) * limit;
    const archived = q.archived === "true";

    const conditions = [eq(customers.isArchived, archived)];
    if (q.q) {
      const term = `%${q.q}%`;
      conditions.push(
        or(
          like(customers.companyName, term),
          like(customers.firstName, term),
          like(customers.lastName, term),
          like(customers.customerNumber, term),
          like(customers.email, term)
        )!
      );
    }

    const [total, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(...conditions))
        .then((r) => r[0]?.count ?? 0),
      db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    // Aggregates: offene Posten (Summe) + Umsatz der letzten 365 Tage pro Kunde.
    // Batch-Fetch fuer alle sichtbaren Kunden-IDs, keine N+1 Queries.
    const customerIds = rows.map((r) => r.id);
    const openByCustomer = new Map<number, Decimal>();
    const revenueByCustomer = new Map<number, Decimal>();

    if (customerIds.length > 0) {
      const invoices = await db.query.documents.findMany({
        where: and(
          inArray(documents.customerId, customerIds),
          eq(documents.documentType, "INVOICE"),
          inArray(documents.status, ["FINAL", "SENT", "PARTIAL", "PAID"]),
        ),
        with: { payments: true },
      });

      const invoiceIds = invoices.map((i) => i.id);
      const creditNotes = invoiceIds.length > 0
        ? await db.query.documents.findMany({
            where: and(
              eq(documents.documentType, "CREDIT_NOTE"),
              inArray(documents.status, ["FINAL", "SENT", "PAID"]),
              inArray(documents.cancelsDocumentId, invoiceIds),
            ),
          })
        : [];

      const creditByInvoice = new Map<number, Decimal>();
      for (const cn of creditNotes) {
        if (cn.cancelsDocumentId == null) continue;
        const prev = creditByInvoice.get(cn.cancelsDocumentId) ?? new Decimal(0);
        creditByInvoice.set(
          cn.cancelsDocumentId,
          prev.plus(new Decimal(cn.totalGross).abs()),
        );
      }

      const oneYearAgo = new Date(Date.now() - 365 * 86400000)
        .toISOString()
        .slice(0, 10);

      for (const inv of invoices) {
        const paid = (inv.payments ?? []).reduce(
          (acc, p) => acc.plus(new Decimal(p.amount)),
          new Decimal(0),
        );
        const credited = creditByInvoice.get(inv.id) ?? new Decimal(0);

        // Offener Betrag: nur fuer noch offene Rechnungen (ohne PAID).
        if (inv.status === "FINAL" || inv.status === "SENT" || inv.status === "PARTIAL") {
          const open = new Decimal(inv.totalGross).minus(paid).minus(credited);
          if (open.greaterThan(0)) {
            const prev = openByCustomer.get(inv.customerId) ?? new Decimal(0);
            openByCustomer.set(inv.customerId, prev.plus(open));
          }
        }

        // Umsatz 365 Tage: Rechnungen mit Ausstellungsdatum innerhalb der letzten 365 Tage,
        // abzueglich der zugeordneten Gutschriften.
        if (inv.issueDate && inv.issueDate >= oneYearAgo) {
          const revenue = new Decimal(inv.totalGross).minus(credited);
          const prev = revenueByCustomer.get(inv.customerId) ?? new Decimal(0);
          revenueByCustomer.set(inv.customerId, prev.plus(revenue));
        }
      }
    }

    const enrichedRows = rows.map((r) => ({
      ...r,
      openAmount: (openByCustomer.get(r.id) ?? new Decimal(0)).toFixed(2),
      revenue365: (revenueByCustomer.get(r.id) ?? new Decimal(0)).toFixed(2),
    }));

    return reply.send({
      data: enrichedRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });

  // POST /api/v1/customers
  app.post("/", { onRequest: [app.authenticate], preHandler: [app.requirePermission("customers", "edit")] }, async (req, reply) => {
    const input = CreateCustomerSchema.parse(req.body);

    // Auto-generate customer number if not provided
    if (!input.customerNumber) {
      const [last] = await db
        .select({ customerNumber: customers.customerNumber })
        .from(customers)
        .orderBy(desc(customers.id))
        .limit(1);
      const lastNum = last ? parseInt(last.customerNumber.replace(/\D/g, "")) || 0 : 0;
      (input as { customerNumber?: string }).customerNumber = `KD-${String(lastNum + 1).padStart(5, "0")}`;
    }

    const [row] = await db.insert(customers).values(input as typeof input & { customerNumber: string }).returning();
    return reply.status(201).send(row);
  });

  // GET /api/v1/customers/:id
  app.get("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.query.customers.findFirst({ where: eq(customers.id, Number(id)) });
    if (!row) return reply.status(404).send({ message: "Kunde nicht gefunden" });
    return reply.send(row);
  });

  // PUT /api/v1/customers/:id
  app.put("/:id", { onRequest: [app.authenticate], preHandler: [app.requirePermission("customers", "edit")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = UpdateCustomerSchema.parse(req.body);
    const [row] = await db
      .update(customers)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, Number(id)))
      .returning();
    if (!row) return reply.status(404).send({ message: "Kunde nicht gefunden" });
    return reply.send(row);
  });

  // DELETE /api/v1/customers/:id (soft delete)
  app.delete("/:id", { onRequest: [app.authenticate], preHandler: [app.requirePermission("customers", "edit")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db
      .update(customers)
      .set({ isArchived: true, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, Number(id)));
    return reply.status(204).send();
  });

  // GET /api/v1/customers/:id/documents
  app.get("/:id/documents", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await db.query.documents.findMany({
      where: eq(documents.customerId, Number(id)),
      orderBy: [desc(documents.createdAt)],
    });
    return reply.send(rows);
  });
}
