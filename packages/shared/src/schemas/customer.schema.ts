import { z } from "zod";

export const CreateCustomerSchema = z.object({
  customerNumber: z.string().min(1).max(50).optional(), // auto-generated if omitted
  companyName: z.string().max(200).nullable().optional(),
  salutation: z.enum(["Herr", "Frau", "Divers", ""]).nullable().optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  email: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().email().nullable().optional(),
  ),
  phone: z.string().max(50).nullable().optional(),
  billStreet: z.string().max(200).nullable().optional(),
  billZip: z.string().max(20).nullable().optional(),
  billCity: z.string().max(100).nullable().optional(),
  billCountry: z.preprocess(
    (v) => (v === "" || v == null ? "DE" : v),
    z.string().length(2),
  ),
  shipStreet: z.string().max(200).nullable().optional(),
  shipZip: z.string().max(20).nullable().optional(),
  shipCity: z.string().max(100).nullable().optional(),
  shipCountry: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().length(2).nullable().optional(),
  ),
  vatId: z.string().max(50).nullable().optional(),
  taxExempt: z.boolean().default(false),
  reverseCharge: z.boolean().default(false),
  paymentDays: z.number().int().min(0).max(365).default(14),
  leitwegId: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
