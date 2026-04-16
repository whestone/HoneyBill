import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { productCategories, productPriceHistory, products } from "../db/schema.js";
import { CreateProductSchema, UpdateProductSchema } from "@honeybill/shared";

export async function productRoutes(app: FastifyInstance) {
  // GET /api/v1/products
  app.get("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { q?: string; archived?: string; category?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
    const offset = (page - 1) * limit;
    const archived = q.archived === "true";

    const conditions: ReturnType<typeof eq>[] = [eq(products.isArchived, archived)];
    if (q.category) conditions.push(eq(products.categoryId, Number(q.category)));

    const [total, rows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(...conditions))
        .then((r) => r[0]?.count ?? 0),
      db.query.products.findMany({
        where: and(...conditions),
        with: { taxRate: true },
        orderBy: [desc(products.createdAt)],
        limit,
        offset,
      }),
    ]);

    return reply.send({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // POST /api/v1/products
  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = CreateProductSchema.parse(req.body);
    const [row] = await db.insert(products).values(input).returning();
    if (!row) throw new Error("Produkt konnte nicht erstellt werden");
    // Initialen Preiseintrag in die Historie schreiben
    await db.insert(productPriceHistory).values({
      productId: row.id,
      unitPrice: row.unitPrice,
      validFrom: new Date().toISOString().slice(0, 10),
    });
    return reply.status(201).send(row);
  });

  // GET /api/v1/products/:id
  app.get("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.query.products.findFirst({
      where: eq(products.id, Number(id)),
      with: { taxRate: true, category: true },
    });
    if (!row) return reply.status(404).send({ message: "Produkt nicht gefunden" });
    return reply.send(row);
  });

  // PUT /api/v1/products/:id
  app.put("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = UpdateProductSchema.parse(req.body);
    const [row] = await db
      .update(products)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(products.id, Number(id)))
      .returning();
    if (!row) return reply.status(404).send({ message: "Produkt nicht gefunden" });
    return reply.send(row);
  });

  // DELETE /api/v1/products/:id (soft)
  app.delete("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db
      .update(products)
      .set({ isArchived: true, updatedAt: new Date().toISOString() })
      .where(eq(products.id, Number(id)));
    return reply.status(204).send();
  });

  // GET /api/v1/products/:id/price-history
  app.get("/:id/price-history", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await db.select().from(productPriceHistory)
      .where(eq(productPriceHistory.productId, Number(id)))
      .orderBy(productPriceHistory.validFrom);
    return reply.send(rows);
  });

  // POST /api/v1/products/:id/price-history/successor — neue Preisperiode
  app.post("/:id/price-history/successor", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { unitPrice: string; validFrom: string };
    const today = new Date().toISOString().slice(0, 10);

    const product = await db.query.products.findFirst({ where: eq(products.id, Number(id)) });
    if (!product) return reply.status(404).send({ message: "Produkt nicht gefunden" });

    // Aktive Periode ermitteln
    const active = await db.select().from(productPriceHistory)
      .where(and(eq(productPriceHistory.productId, Number(id)), isNull(productPriceHistory.validTo)))
      .limit(1);

    if (active.length > 0 && body.validFrom <= active[0]!.validFrom) {
      return reply.status(400).send({ message: "Gültig ab muss nach der aktuellen Periode liegen" });
    }

    // Aktive Periode abschließen
    if (active.length > 0) {
      const prevTo = new Date(body.validFrom);
      prevTo.setDate(prevTo.getDate() - 1);
      await db.update(productPriceHistory)
        .set({ validTo: prevTo.toISOString().slice(0, 10) })
        .where(eq(productPriceHistory.id, active[0]!.id));
    }

    // Neue Periode anlegen
    const [row] = await db.insert(productPriceHistory).values({
      productId: Number(id),
      unitPrice: body.unitPrice,
      validFrom: body.validFrom,
    }).returning();

    // Aktuellen Preis am Produkt nur aktualisieren wenn validFrom <= heute
    if (body.validFrom <= today) {
      await db.update(products)
        .set({ unitPrice: body.unitPrice, updatedAt: new Date().toISOString() })
        .where(eq(products.id, Number(id)));
    }

    return reply.status(201).send(row);
  });

  // DELETE /api/v1/products/price-history/:hid
  app.delete("/price-history/:hid", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { hid } = req.params as { hid: string };
    await db.delete(productPriceHistory).where(eq(productPriceHistory.id, Number(hid)));
    return reply.status(204).send();
  });
}

export async function productCategoryRoutes(app: FastifyInstance) {
  app.get("/", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const rows = await db.select().from(productCategories).orderBy(productCategories.name);
    return reply.send(rows);
  });

  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { name } = req.body as { name: string };
    const [row] = await db.insert(productCategories).values({ name }).returning();
    return reply.status(201).send(row);
  });

  app.put("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    const [row] = await db
      .update(productCategories)
      .set({ name })
      .where(eq(productCategories.id, Number(id)))
      .returning();
    if (!row) return reply.status(404).send({ message: "Kategorie nicht gefunden" });
    return reply.send(row);
  });

  app.delete("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.delete(productCategories).where(eq(productCategories.id, Number(id)));
    return reply.status(204).send();
  });
}
