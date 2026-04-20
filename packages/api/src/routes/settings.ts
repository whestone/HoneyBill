import type { FastifyInstance } from "fastify";
import { eq, and, isNull, lte, sql } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import nodemailer from "nodemailer";
import { db } from "../db/index.js";
import { companySettings, documents, documentLineItems, numberSeries, products, taxRates } from "../db/schema.js";
import {
  UpdateCompanySettingsSchema, UpdateNumberSeriesSchema,
  UpdatePdfSettingsSchema, UpdateEmailSettingsSchema, SendDocumentEmailSchema,
  DOCUMENT_TYPE_LABELS, formatEur,
} from "@honeybill/shared";
import type { Customer } from "@honeybill/shared";
import { generateZugferdXml, generateXRechnungXml } from "../services/einvoice/xrechnung.service.js";
import { packageZugferdPdf } from "../services/einvoice/zugferd.service.js";
import { getFullDocument, getCompanySettings } from "./documents.js";
import { previewNextNumber } from "../services/numbering.service.js";
import { sqlite } from "../db/index.js";
import { config } from "../config.js";
import type { DocumentType, EmailSettings } from "@honeybill/shared";

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/v1/settings/company
  app.get("/company", { onRequest: [app.authenticate] }, async (_req, reply) => {
    const [row] = await db.select().from(companySettings).limit(1);
    if (!row) return reply.send({});
    const parsed = {
      ...row,
      pdfSettings: row.pdfSettings ? JSON.parse(row.pdfSettings) : null,
      emailSettings: row.emailSettings ? JSON.parse(row.emailSettings) : null,
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

  // PUT /api/v1/settings/company/email
  app.put("/company/email", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = UpdateEmailSettingsSchema.parse(req.body);
    const existing = await db.select().from(companySettings).limit(1);
    const json = JSON.stringify(input);
    if (existing.length === 0) {
      const [row] = await db.insert(companySettings).values({ id: 1, emailSettings: json } as any).returning();
      return reply.send({ ...row, emailSettings: input });
    }
    const [row] = await db
      .update(companySettings)
      .set({ emailSettings: json, updatedAt: new Date().toISOString() })
      .where(eq(companySettings.id, 1))
      .returning();
    return reply.send({ ...row, emailSettings: input });
  });

  // POST /api/v1/settings/company/email/test
  app.post("/company/email/test", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = req.body as { to: string };
    const [row] = await db.select().from(companySettings).limit(1);
    const emailSettings: EmailSettings | null = row?.emailSettings ? JSON.parse(row.emailSettings) : null;
    if (!emailSettings?.smtp) return reply.status(400).send({ message: "SMTP nicht konfiguriert" });
    const { smtp } = emailSettings;
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"${smtp.fromName}" <${smtp.fromAddress}>`,
        to: body.to,
        subject: "HoneyBill – SMTP-Verbindungstest",
        text: "Die SMTP-Verbindung funktioniert korrekt.",
      });
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message ?? "SMTP-Fehler" });
    }
  });

  // POST /api/v1/settings/company/email/send-document (multipart: to, subject, body, pdf?)
  app.post("/company/email/send-document", { onRequest: [app.authenticate] }, async (req, reply) => {
    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    let pdfBuffer: Buffer | null = null;
    let pdfFilename = "dokument.pdf";

    for await (const part of parts) {
      if (part.type === "file") {
        pdfBuffer = await part.toBuffer();
        pdfFilename = part.filename || pdfFilename;
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const input = SendDocumentEmailSchema.parse({
      to: fields.to,
      subject: fields.subject,
      body: fields.body,
      attachPdf: fields.attachPdf !== "false",
      attachFormat: fields.attachFormat ?? "PDF",
      documentId: fields.documentId ? Number(fields.documentId) : undefined,
    });

    const [row] = await db.select().from(companySettings).limit(1);
    const emailSettings: EmailSettings | null = row?.emailSettings ? JSON.parse(row.emailSettings) : null;

    if (emailSettings?.provider === "outlook" || !emailSettings?.smtp) {
      return reply.status(400).send({ message: "Für den Outlook-Modus bitte den mailto-Link im Browser nutzen." });
    }

    // Anhänge je nach Format aufbauen.
    const attachments: NonNullable<nodemailer.SendMailOptions["attachments"]> = [];
    if (pdfBuffer && input.attachPdf) {
      if (input.attachFormat === "ZUGFERD" || input.attachFormat === "XRECHNUNG") {
        if (!input.documentId) {
          return reply.status(400).send({ message: "documentId erforderlich für E-Rechnung-Anhang." });
        }
        const doc = await getFullDocument(input.documentId);
        if (!doc) return reply.status(404).send({ message: "Beleg nicht gefunden" });
        const company = await getCompanySettings();

        if (input.attachFormat === "ZUGFERD") {
          // PDF durch ZUGFeRD-PDF/A-3 ersetzen (XML eingebettet).
          const xml = generateZugferdXml(doc as any, doc.customer as Customer, company);
          const zugferd = await packageZugferdPdf(new Uint8Array(pdfBuffer), xml);
          const zfName = `zugferd-${doc.documentNumber ?? "dokument"}.pdf`;
          attachments.push({ filename: zfName, content: Buffer.from(zugferd), contentType: "application/pdf" });
        } else {
          // XRECHNUNG: PDF + separate XRechnung-XML.
          attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" });
          const xml = generateXRechnungXml(doc as any, doc.customer as Customer, company);
          const xmlName = `xrechnung-${doc.documentNumber ?? "dokument"}.xml`;
          attachments.push({ filename: xmlName, content: xml, contentType: "application/xml" });
        }
      } else {
        attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" });
      }
    }

    const { smtp } = emailSettings;
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
      });

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${smtp.fromName}" <${smtp.fromAddress}>`,
        to: input.to,
        subject: input.subject,
        text: input.body,
        attachments,
      };

      await transporter.sendMail(mailOptions);
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message ?? "E-Mail konnte nicht gesendet werden" });
    }
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
    const q = req.query as { active?: string; name?: string };
    let rows;
    if (q.name) {
      rows = await db.select().from(taxRates).where(eq(taxRates.name, q.name)).orderBy(taxRates.validFrom);
    } else if (q.active === "true") {
      const today = new Date().toISOString().slice(0, 10);
      rows = await db.select().from(taxRates)
        .where(and(isNull(taxRates.validTo), lte(taxRates.validFrom, today)))
        .orderBy(taxRates.validFrom);
    } else {
      rows = await db.select().from(taxRates).orderBy(taxRates.validFrom);
    }

    // Usage-Counts anhaengen, damit die UI "Loeschen"-Buttons passend deaktivieren kann.
    // Zwei Aggregat-Queries sind billiger als N+1.
    const rateIds = rows.map((r) => r.id);
    const usage = new Map<number, { products: number; lineItems: number }>();
    for (const id of rateIds) usage.set(id, { products: 0, lineItems: 0 });
    if (rateIds.length > 0) {
      const idList = rateIds.join(",");
      const prodRows = sqlite
        .prepare(
          `SELECT tax_rate_id AS id, COUNT(*) AS c FROM products WHERE tax_rate_id IN (${idList}) GROUP BY tax_rate_id`,
        )
        .all() as { id: number; c: number }[];
      for (const r of prodRows) usage.get(r.id)!.products = r.c;
      const liRows = sqlite
        .prepare(
          `SELECT tax_rate_id AS id, COUNT(*) AS c FROM document_line_items WHERE tax_rate_id IN (${idList}) GROUP BY tax_rate_id`,
        )
        .all() as { id: number; c: number }[];
      for (const r of liRows) usage.get(r.id)!.lineItems = r.c;
    }

    const enriched = rows.map((r) => ({
      ...r,
      usageProducts: usage.get(r.id)?.products ?? 0,
      usageLineItems: usage.get(r.id)?.lineItems ?? 0,
    }));
    return reply.send(enriched);
  });

  // POST /api/v1/tax-rates
  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = req.body as {
      name: string; ratePercent: string; taxCategory?: string; validFrom: string; isDefault?: boolean;
    };
    if (body.isDefault) {
      await db.update(taxRates).set({ isDefault: false }).where(eq(taxRates.isDefault, true));
    }
    const [row] = await db.insert(taxRates).values({
      name: body.name,
      ratePercent: body.ratePercent,
      taxCategory: body.taxCategory ?? "S",
      validFrom: body.validFrom,
      isDefault: body.isDefault ?? false,
    }).returning();
    return reply.status(201).send(row);
  });

  // POST /api/v1/tax-rates/:id/successor — neue Periode für bestehenden Satz
  app.post("/:id/successor", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { ratePercent: string; validFrom: string };

    const parent = await db.query.taxRates.findFirst({ where: eq(taxRates.id, Number(id)) });
    if (!parent) return reply.status(404).send({ message: "Steuersatz nicht gefunden" });

    if (body.validFrom <= parent.validFrom) {
      return reply.status(400).send({ message: "Gültig ab muss nach dem Vorgänger liegen" });
    }

    // validTo des neuen Satzes darf keine aktive Periode überschneiden
    const newFrom = new Date(body.validFrom);
    newFrom.setDate(newFrom.getDate() - 1);
    const validToDate = newFrom.toISOString().slice(0, 10);

    // Alle aktiven Sätze gleichen Namens abschließen
    await db.update(taxRates)
      .set({ validTo: validToDate })
      .where(and(eq(taxRates.name, parent.name), isNull(taxRates.validTo)));

    // Exklusives Default: andere Sätze zurücksetzen falls Parent Standard war
    if (parent.isDefault) {
      await db.update(taxRates).set({ isDefault: false }).where(eq(taxRates.isDefault, true));
    }

    const [row] = await db.insert(taxRates).values({
      name: parent.name,
      ratePercent: body.ratePercent,
      taxCategory: parent.taxCategory,
      validFrom: body.validFrom,
      isDefault: parent.isDefault,
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

  // PUT /api/v1/tax-rates/:id — nur Metadaten, nie validTo/validFrom/ratePercent
  app.put("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<typeof taxRates.$inferInsert>;
    const { validTo: _vt, validFrom: _vf, ratePercent: _rp, ...meta } = body as any;
    if (meta.isDefault) {
      await db.update(taxRates).set({ isDefault: false }).where(eq(taxRates.isDefault, true));
    }
    const [row] = await db
      .update(taxRates)
      .set(meta)
      .where(eq(taxRates.id, Number(id)))
      .returning();
    if (!row) return reply.status(404).send({ message: "Steuersatz nicht gefunden" });
    return reply.send(row);
  });

  // DELETE /api/v1/tax-rates/:id
  app.delete("/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const taxRateId = Number(id);

    // Prüfen, ob der Steuersatz noch referenziert wird
    const [usedInProducts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.taxRateId, taxRateId));
    if ((usedInProducts?.count ?? 0) > 0) {
      return reply.status(400).send({
        message: `Steuersatz wird noch von ${usedInProducts!.count} Produkt(en) verwendet und kann nicht gelöscht werden. Bitte zuerst die Produkte auf einen anderen Steuersatz umstellen.`,
      });
    }
    const [usedInLineItems] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentLineItems)
      .where(eq(documentLineItems.taxRateId, taxRateId));
    if ((usedInLineItems?.count ?? 0) > 0) {
      return reply.status(400).send({
        message: `Steuersatz wird noch in ${usedInLineItems!.count} Rechnungsposition(en) verwendet und kann nicht gelöscht werden.`,
      });
    }

    await db.delete(taxRates).where(eq(taxRates.id, taxRateId));
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
    const body = (req.body ?? {}) as { format?: string };
    const preview = previewNextNumber(sqlite, documentType as DocumentType, body.format);
    return reply.send({ preview });
  });
}
