import { z } from "zod";

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  unit: z.string().min(1).max(50).default("Stk"),
  unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/, "Muss eine Zahl sein"),
  taxRateId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullable().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
