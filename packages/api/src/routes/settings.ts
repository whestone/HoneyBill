import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { db } from "../db/index.js";
import { companySettings, numberSeries, taxRates } from "../db/schema.js";
import { UpdateCompanySettingsSchema, UpdateNumberSeriesSchema, UpdatePdfSettingsSchema } from "@honeybill/shared";
import { previewNextNumber } from "../services/numbering.service.js";
import { sqlite } from "../db/index.js";
import { config } from "../config.js";
import type { DocumentType } from "@honeybill/shared";

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/v1/settings/company
  app.get("/company", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const [row] = await db.select().from(companySettings).limit(1);
    if (!row) return reply.send({});
    const parsed = {
      ...row,
      pdfSettings: row.pdfSettings ? JSON.parse(row.pdfSettings) : null,
    };
    return reply.send(parsed);
  });

  // PUT /api/v1/settings/company
  app.put("/company", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = UpdateCompanySettingsSchema.parse(req.body);
    const existing = await db.select().from(companySettings).limit(1);
    if (existing.length === 0) {
      const [row] = await db.insert(companySettings).values({ id: 1, ...input }).returning();
      return reply.send(row);
    }
    const [row] = await db
      .update(companySettings)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(companySettings.id, 1))
      .returning();
    return reply.send(row);
  });

  // PUT /api/v1/settings/company/pdf
  app.put("/company/pdf", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = UpdatePdfSettingsSchema.parse(req.body);
    const existing = await db.select().from(companySettings).limit(1);
    const json = JSON.stringify(input);
    if (existing.length === 0) {
      const [row] = await db.insert(companySettings).values({ id: 1, pdfSettings: json } as any).returning();
      return reply.send({ ...row, pdfSettings: input });
    }
    const [row] = await db
      .update(companySettings)
      .set({ pdfSettings: json, updatedAt: new Date().toISOString() })
      .where(eq(companySettings.id, 1))
      .returning();
    return reply.send({ ...row, pdfSettings: input });
  });

  // POST /api/v1/settings/company/logo (multipart)
  app.post("/company/logo", { onRequest: [app.authenticate] }, async (req, reply) => {
    const data = await (req as any).file();
    const logoDir = path.join(config.uploadsDir, "logos");
    fs.mkdirSync(logoDir, { recursive: true });
    const ext = path.extname(data.filename) || ".png";
    const filename = `logo${ext}`;
    const filePath = path.join(logoDir, filename);
    const buffer = await data.toBuffer();
    fs.writeFileSync(filePath, buffer);
    const relativePath = `logos/${filename}`;
    await db
      .update(companySettings)
      .set({ logoPath: relativePath, updatedAt: new Date().toISOString() })
      .where(eq(companySettings.id, 1));
    return reply.send({ logoPath: relativePath });
  });
}

export async function taxRateRoutes(app: FastifyInstance) {
  // GET /api/v1/tax-rates
  app.get("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { active?: string };
    let rows;
    if (q.active === "true") {
      rows = await db
        .select()
        .from(taxRates)
        .where(eq(taxRates.validTo, null as unknown as string));
    } else {
      rows = await db.select().from(taxRates).orderBy(taxRates.validFrom);
    }
    return reply.send(rows);
  });

  // POST /api/v1/tax-rates
  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = req.body as {
      name: string; ratePercent: string; taxCategory?: string; validFrom: string; isDefault?: boolean;
    };
    const [row] = await db.insert(taxRates).values({
      name: body.name,
      ratePercent: body.ratePercent,
      taxCategory: body.taxCategory ?? "S",
      validFrom: body.validFrom,
      isDefault: body.isDefault ?? false,
    }).returning();
    return reply.status(201).send(row);
  });

  // GET /api/v1/tax-rates/:id
  app.get("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.query.taxRates.findFirst({ where: eq(taxRates.id, Number(id)) });
    if (!row) return reply.status(404).send({ message: "Steuersatz nicht gefunden" });
    return reply.send(row);
  });

  // PUT /api/v1/tax-rates/:id
  app.put("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<typeof taxRates.$inferInsert>;
    const [row] = await db
      .update(taxRates)
      .set(body)
      .where(eq(taxRates.id, Number(id)))
      .returning();
    if (!row) return reply.status(404).send({ message: "Steuersatz nicht gefunden" });
    return reply.send(row);
  });

  // DELETE /api/v1/tax-rates/:id
  app.delete("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.delete(taxRates).where(eq(taxRates.id, Number(id)));
    return reply.status(204).send();
  });
}

export async function numberSeriesRoutes(app: FastifyInstance) {
  // GET /api/v1/number-series
  app.get("/", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const rows = await db.select().from(numberSeries);
    return reply.send(rows);
  });

  // PUT /api/v1/number-series/:documentType
  app.put("/:documentType", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { documentType } = req.params as { documentType: string };
    const input = UpdateNumberSeriesSchema.parse(req.body);
    const [row] = await db
      .update(numberSeries)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(numberSeries.documentType, documentType))
      .returning();
    if (!row) return reply.status(404).send({ message: "Nummernkreis nicht gefunden" });
    return reply.send(row);
  });

  // POST /api/v1/number-series/:documentType/preview
  app.post("/:documentType/preview", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { documentType } = req.params as { documentType: string };
    const preview = previewNextNumber(sqlite, documentType as DocumentType);
    return reply.send({ preview });
  });
}
