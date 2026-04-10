import { z } from "zod";

const LineItemSchema = z.object({
  id: z.number().int().optional(), // omit for new items
  position: z.number().int().min(0),
  lineType: z.enum(["ITEM", "TEXT", "SUBTOTAL", "PAGEBREAK"]).default("ITEM"),
  productId: z.number().int().positive().nullable().optional(),
  description: z.string().max(2000).default(""),
  quantity: z.string().regex(/^\d+(\.\d{1,6})?$/).default("1"),
  unit: z.string().max(50).default("Stk"),
  unitPrice: z.string().regex(/^-?\d+(\.\d{1,4})?$/).default("0.00"),
  discountPct: z.string().regex(/^\d+(\.\d{1,4})?$/).default("0.00"),
  taxRateId: z.number().int().positive().nullable().optional(),
});

export const CreateDocumentSchema = z.object({
  documentType: z.enum(["QUOTE", "DELIVERY_NOTE", "INVOICE", "CREDIT_NOTE"]),
  customerId: z.number().int().positive(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  deliveryDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  quoteValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sourceDocumentId: z.number().int().positive().nullable().optional(),
  cancelsDocumentId: z.number().int().positive().nullable().optional(),
  currency: z.string().length(3).default("EUR"),
  paymentDays: z.number().int().min(0).max(365).nullable().optional(),
  paymentTermsText: z.string().max(500).nullable().optional(),
  templateId: z.number().int().positive().nullable().optional(),
  einvoiceProfile: z.enum(["ZUGFERD_EXTENDED", "XRECHNUNG"]).nullable().optional(),
  leitwegId: z.string().max(100).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  lineItems: z.array(LineItemSchema).min(0),
});

export const UpdateDocumentSchema = CreateDocumentSchema.omit({
  documentType: true,
  cancelsDocumentId: true,
}).partial();

export const CreatePaymentSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  paymentMethod: z
    .enum(["BANK_TRANSFER", "CASH", "DIRECT_DEBIT", "PAYPAL", "OTHER"])
    .nullable()
    .optional(),
  reference: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
export type LineItemInput = z.infer<typeof LineItemSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
