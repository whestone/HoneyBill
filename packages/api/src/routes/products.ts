import type { FastifyInstance } from "fastify";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { productCategories, products } from "../db/schema.js";
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
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(and(...conditions))
        .then((r) => r[0]?.count ?? 0),
      db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(desc(products.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return reply.send({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // POST /api/v1/products
  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = CreateProductSchema.parse(req.body);
    const [row] = await db.insert(products).values(input).returning();
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
