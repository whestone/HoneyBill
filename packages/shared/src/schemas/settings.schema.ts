import { z } from "zod";

export const UpdateCompanySettingsSchema = z.object({
  name: z.string().min(1).max(300),
  legalForm: z.string().max(50).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().length(2).default("DE"),
  vatId: z.string().max(50).nullable().optional(),
  taxNumber: z.string().max(50).nullable().optional(),
  bankIban: z.string().max(34).nullable().optional(),
  bankBic: z.string().max(11).nullable().optional(),
  bankName: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  website: z.string().url().nullable().optional(),
  defaultCurrency: z.string().length(3).default("EUR"),
  defaultPaymentDays: z.number().int().min(0).max(365).default(14),
});

export const UpdateNumberSeriesSchema = z.object({
  prefix: z.string().max(20).default(""),
  suffix: z.string().max(20).default(""),
  yearSegment: z.boolean().default(true),
  monthSegment: z.boolean().default(false),
  padding: z.number().int().min(1).max(10).default(5),
  resetYearly: z.boolean().default(true),
});

export const UpdatePdfSettingsSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#b45309"),
  headerBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#fef3c7"),
  altRowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#fffbeb"),
  bodyFontSize: z.number().int().min(6).max(14).default(9),
  titleFontSize: z.number().int().min(10).max(32).default(18),
  paddingH: z.number().int().min(20).max(80).default(50),
  paddingTop: z.number().int().min(20).max(80).default(40),
  paddingBottom: z.number().int().min(30).max(100).default(60),
  logoWidth: z.number().int().min(40).max(200).default(100),
  logoHeight: z.number().int().min(20).max(100).default(40),
});

export const UpdateEmailSettingsSchema = z.object({
  provider: z.enum(["smtp", "outlook"]).default("smtp"),
  smtp: z.object({
    host: z.string().min(1).max(200),
    port: z.number().int().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    user: z.string().max(200),
    password: z.string().max(500),
    fromName: z.string().max(200),
    fromAddress: z.string().email(),
  }).nullable().default(null),
  defaultSubject: z.string().max(500).default("{{dokumentTyp}} {{dokumentNummer}} von {{firmenName}}"),
  defaultBody: z.string().max(5000).default(
    "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie {{dokumentTyp}} {{dokumentNummer}} über {{betrag}}.\n\n{{zahlungshinweis}}\n\nMit freundlichen Grüßen\n{{firmenName}}"
  ),
});

export const SendDocumentEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  attachPdf: z.boolean().default(true),
});

export type UpdateCompanySettingsInput = z.infer<typeof UpdateCompanySettingsSchema>;
export type UpdateNumberSeriesInput = z.infer<typeof UpdateNumberSeriesSchema>;
export type UpdatePdfSettingsInput = z.infer<typeof UpdatePdfSettingsSchema>;
export type UpdateEmailSettingsInput = z.infer<typeof UpdateEmailSettingsSchema>;
export type SendDocumentEmailInput = z.infer<typeof SendDocumentEmailSchema>;
