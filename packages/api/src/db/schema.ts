import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ─── Company Settings ─────────────────────────────────────────────────────────

export const companySettings = sqliteTable("company_settings", {
  id: int("id").primaryKey().default(1),
  name: text("name").notNull().default("Meine Firma"),
  legalForm: text("legal_form"),
  street: text("street"),
  zip: text("zip"),
  city: text("city"),
  country: text("country").notNull().default("DE"),
  vatId: text("vat_id"),
  taxNumber: text("tax_number"),
  bankIban: text("bank_iban"),
  bankBic: text("bank_bic"),
  bankName: text("bank_name"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  logoPath: text("logo_path"),
  defaultCurrency: text("default_currency").notNull().default("EUR"),
  defaultPaymentDays: int("default_payment_days").notNull().default(14),
  pdfSettings: text("pdf_settings"),
  emailSettings: text("email_settings"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: int("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: int("entity_id"),
  oldData: text("old_data"),
  newData: text("new_data"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  mobile: text("mobile"),
  role: text("role").notNull().default("viewer"),
  isActive: int("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Tax Rates ────────────────────────────────────────────────────────────────

export const taxRates = sqliteTable("tax_rates", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ratePercent: text("rate_percent").notNull(),
  taxCategory: text("tax_category").notNull().default("S"),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  isDefault: int("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = sqliteTable("customers", {
  id: int("id").primaryKey({ autoIncrement: true }),
  customerNumber: text("customer_number").notNull().unique(),
  companyName: text("company_name"),
  salutation: text("salutation"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  billStreet: text("bill_street"),
  billZip: text("bill_zip"),
  billCity: text("bill_city"),
  billCountry: text("bill_country").notNull().default("DE"),
  shipStreet: text("ship_street"),
  shipZip: text("ship_zip"),
  shipCity: text("ship_city"),
  shipCountry: text("ship_country"),
  vatId: text("vat_id"),
  taxExempt: int("tax_exempt", { mode: "boolean" }).notNull().default(false),
  reverseCharge: int("reverse_charge", { mode: "boolean" }).notNull().default(false),
  paymentDays: int("payment_days").notNull().default(14),
  leitwegId: text("leitweg_id"),
  notes: text("notes"),
  isArchived: int("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Product Categories ────────────────────────────────────────────────────────

export const productCategories = sqliteTable("product_categories", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Products ────────────────────────────────────────────────────────────────

export const products = sqliteTable("products", {
  id: int("id").primaryKey({ autoIncrement: true }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull().default("Stk"),
  unitPrice: text("unit_price").notNull().default("0.00"),
  taxRateId: int("tax_rate_id")
    .notNull()
    .references(() => taxRates.id),
  categoryId: int("category_id").references(() => productCategories.id),
  isArchived: int("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Number Series ────────────────────────────────────────────────────────────

export const numberSeries = sqliteTable("number_series", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentType: text("document_type").notNull().unique(),
  prefix: text("prefix").notNull().default(""),
  suffix: text("suffix").notNull().default(""),
  yearSegment: int("year_segment", { mode: "boolean" }).notNull().default(true),
  monthSegment: int("month_segment", { mode: "boolean" }).notNull().default(false),
  padding: int("padding").notNull().default(5),
  nextCounter: int("next_counter").notNull().default(1),
  lastResetAt: text("last_reset_at"),
  resetYearly: int("reset_yearly", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Document Templates ───────────────────────────────────────────────────────

export const documentTemplates = sqliteTable("document_templates", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  documentType: text("document_type"),
  htmlContent: text("html_content").notNull(),
  cssContent: text("css_content").notNull().default(""),
  isDefault: int("is_default", { mode: "boolean" }).notNull().default(false),
  version: int("version").notNull().default(1),
  parentId: int("parent_id"),
  createdBy: int("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Documents ────────────────────────────────────────────────────────────────

export const documents = sqliteTable("documents", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number").unique(),
  status: text("status").notNull().default("DRAFT"),
  customerId: int("customer_id")
    .notNull()
    .references(() => customers.id),
  customerSnapshot: text("customer_snapshot"),
  issueDate: text("issue_date"),
  deliveryDate: text("delivery_date"),
  deliveryDateEnd: text("delivery_date_end"),
  dueDate: text("due_date"),
  quoteValidUntil: text("quote_valid_until"),
  sourceDocumentId: int("source_document_id"),
  cancelsDocumentId: int("cancels_document_id"),
  subtotalNet: text("subtotal_net").notNull().default("0.00"),
  totalTax: text("total_tax").notNull().default("0.00"),
  totalGross: text("total_gross").notNull().default("0.00"),
  currency: text("currency").notNull().default("EUR"),
  paymentDays: int("payment_days"),
  paymentTermsText: text("payment_terms_text"),
  templateId: int("template_id"),
  einvoiceProfile: text("einvoice_profile"),
  leitwegId: text("leitweg_id"),
  globalDiscountPct: text("global_discount_pct").notNull().default("0.00"),
  globalDiscountType: text("global_discount_type").notNull().default("pct"),
  layoutOverride: text("layout_override"),
  internalNotes: text("internal_notes"),
  createdBy: int("created_by").references(() => users.id),
  finalizedBy: int("finalized_by").references(() => users.id),
  finalizedAt: text("finalized_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Document Line Items ──────────────────────────────────────────────────────

export const documentLineItems = sqliteTable("document_line_items", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentId: int("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  position: int("position").notNull(),
  lineType: text("line_type").notNull().default("ITEM"),
  productId: int("product_id").references(() => products.id),
  productSnapshot: text("product_snapshot"),
  description: text("description").notNull().default(""),
  quantity: text("quantity").notNull().default("1"),
  unit: text("unit").notNull().default("Stk"),
  unitPrice: text("unit_price").notNull().default("0.00"),
  discountPct: text("discount_pct").notNull().default("0.00"),
  discountType: text("discount_type").notNull().default("pct"),
  taxRateId: int("tax_rate_id").references(() => taxRates.id),
  taxRatePct: text("tax_rate_pct").notNull().default("0.00"),
  lineNet: text("line_net").notNull().default("0.00"),
  lineTax: text("line_tax").notNull().default("0.00"),
  lineGross: text("line_gross").notNull().default("0.00"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Document Tax Lines ───────────────────────────────────────────────────────

export const documentTaxLines = sqliteTable("document_tax_lines", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentId: int("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  taxRateId: int("tax_rate_id").references(() => taxRates.id),
  taxRatePct: text("tax_rate_pct").notNull(),
  taxCategory: text("tax_category").notNull().default("S"),
  taxableAmount: text("taxable_amount").notNull().default("0.00"),
  taxAmount: text("tax_amount").notNull().default("0.00"),
});

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = sqliteTable("payments", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentId: int("document_id")
    .notNull()
    .references(() => documents.id),
  paymentDate: text("payment_date").notNull(),
  amount: text("amount").notNull(),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: int("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Document Files ───────────────────────────────────────────────────────────

export const documentFiles = sqliteTable("document_files", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentId: int("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: int("file_size"),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  checksumSha256: text("checksum_sha256"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const documentsRelations = relations(documents, ({ one, many }) => ({
  customer: one(customers, {
    fields: [documents.customerId],
    references: [customers.id],
  }),
  cancelsDocument: one(documents, {
    fields: [documents.cancelsDocumentId],
    references: [documents.id],
    relationName: "cancellation",
  }),
  lineItems: many(documentLineItems),
  taxLines: many(documentTaxLines),
  payments: many(payments),
  files: many(documentFiles),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  documents: many(documents),
}));

export const documentLineItemsRelations = relations(documentLineItems, ({ one }) => ({
  document: one(documents, {
    fields: [documentLineItems.documentId],
    references: [documents.id],
  }),
  product: one(products, {
    fields: [documentLineItems.productId],
    references: [products.id],
  }),
  taxRate: one(taxRates, {
    fields: [documentLineItems.taxRateId],
    references: [taxRates.id],
  }),
}));

export const documentTaxLinesRelations = relations(documentTaxLines, ({ one }) => ({
  document: one(documents, {
    fields: [documentTaxLines.documentId],
    references: [documents.id],
  }),
  taxRate: one(taxRates, {
    fields: [documentTaxLines.taxRateId],
    references: [taxRates.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  document: one(documents, {
    fields: [payments.documentId],
    references: [documents.id],
  }),
}));

export const documentFilesRelations = relations(documentFiles, ({ one }) => ({
  document: one(documents, {
    fields: [documentFiles.documentId],
    references: [documents.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  taxRate: one(taxRates, {
    fields: [products.taxRateId],
    references: [taxRates.id],
  }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
}));

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  products: many(products),
  lineItems: many(documentLineItems),
  taxLines: many(documentTaxLines),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));
