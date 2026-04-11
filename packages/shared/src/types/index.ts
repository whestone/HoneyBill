// ─── Document Types ──────────────────────────────────────────────────────────

export type DocumentType = "QUOTE" | "DELIVERY_NOTE" | "INVOICE" | "CREDIT_NOTE";

export type DocumentStatus =
  | "DRAFT"
  | "FINAL"
  | "SENT"
  | "PAID"
  | "PARTIAL"
  | "CANCELLED";

export type LineItemType = "ITEM" | "TEXT" | "SUBTOTAL" | "PAGEBREAK";

export type EInvoiceProfile = "ZUGFERD_EXTENDED" | "XRECHNUNG" | null;

export type PaymentMethod =
  | "BANK_TRANSFER"
  | "CASH"
  | "DIRECT_DEBIT"
  | "PAYPAL"
  | "OTHER";

// ─── Role ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "accountant" | "viewer";

// ─── Tax Category (EN 16931) ──────────────────────────────────────────────────

export type TaxCategory = "S" | "R" | "Z" | "E" | "O";

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface TaxRate {
  id: number;
  name: string;
  ratePercent: string;
  taxCategory: TaxCategory;
  validFrom: string;
  validTo: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface Customer {
  id: number;
  customerNumber: string;
  companyName: string | null;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  billStreet: string | null;
  billZip: string | null;
  billCity: string | null;
  billCountry: string;
  shipStreet: string | null;
  shipZip: string | null;
  shipCity: string | null;
  shipCountry: string | null;
  vatId: string | null;
  taxExempt: boolean;
  reverseCharge: boolean;
  paymentDays: number;
  leitwegId: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: string;
  taxRateId: number;
  taxRate?: TaxRate;
  categoryId: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  createdAt: string;
}

export interface NumberSeries {
  id: number;
  documentType: DocumentType;
  prefix: string;
  suffix: string;
  yearSegment: boolean;
  monthSegment: boolean;
  padding: number;
  nextCounter: number;
  lastResetAt: string | null;
  resetYearly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplate {
  id: number;
  name: string;
  documentType: DocumentType | null;
  htmlContent: string;
  cssContent: string;
  isDefault: boolean;
  version: number;
  parentId: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface DocumentLineItem {
  id: number;
  documentId: number;
  position: number;
  lineType: LineItemType;
  productId: number | null;
  productSnapshot: Record<string, unknown> | null;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  taxRateId: number | null;
  taxRatePct: string;
  lineNet: string;
  lineTax: string;
  lineGross: string;
  createdAt: string;
}

export interface DocumentTaxLine {
  id: number;
  documentId: number;
  taxRateId: number | null;
  taxRatePct: string;
  taxCategory: TaxCategory;
  taxableAmount: string;
  taxAmount: string;
}

export interface Payment {
  id: number;
  documentId: number;
  paymentDate: string;
  amount: string;
  paymentMethod: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface DocumentFile {
  id: number;
  documentId: number;
  fileType: "PDF" | "ZUGFERD_PDF" | "XRECHNUNG_XML" | "ATTACHMENT";
  filePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  checksumSha256: string | null;
  createdAt: string;
}

export interface Document {
  id: number;
  documentType: DocumentType;
  documentNumber: string | null;
  status: DocumentStatus;
  customerId: number;
  customerSnapshot: Record<string, unknown> | null;
  issueDate: string | null;
  deliveryDate: string | null;
  deliveryDateEnd: string | null;
  dueDate: string | null;
  quoteValidUntil: string | null;
  sourceDocumentId: number | null;
  cancelsDocumentId: number | null;
  subtotalNet: string;
  totalTax: string;
  totalGross: string;
  currency: string;
  paymentDays: number | null;
  paymentTermsText: string | null;
  templateId: number | null;
  einvoiceProfile: EInvoiceProfile;
  leitwegId: string | null;
  internalNotes: string | null;
  createdBy: number | null;
  finalizedBy: number | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  customer?: Customer;
  lineItems?: DocumentLineItem[];
  taxLines?: DocumentTaxLine[];
  payments?: Payment[];
}

export interface PdfSettings {
  accentColor: string;
  headerBgColor: string;
  altRowColor: string;
  bodyFontSize: number;
  titleFontSize: number;
  paddingH: number;
  paddingTop: number;
  paddingBottom: number;
  logoWidth: number;
  logoHeight: number;
  layouts: Record<DocumentType, DocumentLayoutSettings>;
}

export interface DocumentLayoutSettings {
  showPrices: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showTotals: boolean;
  showPaymentInfo: boolean;
  showPositionNumbers: boolean;
  closingText: string;
}

const LAYOUT_INVOICE: DocumentLayoutSettings = {
  showPrices: true,
  showTax: true,
  showDiscount: true,
  showTotals: true,
  showPaymentInfo: true,
  showPositionNumbers: true,
  closingText: "Vielen Dank für Ihren Auftrag.",
};

const LAYOUT_QUOTE: DocumentLayoutSettings = {
  showPrices: true,
  showTax: true,
  showDiscount: true,
  showTotals: true,
  showPaymentInfo: false,
  showPositionNumbers: true,
  closingText: "Dieses Angebot ist 30 Tage gültig.",
};

const LAYOUT_DELIVERY_NOTE: DocumentLayoutSettings = {
  showPrices: false,
  showTax: false,
  showDiscount: false,
  showTotals: false,
  showPaymentInfo: false,
  showPositionNumbers: true,
  closingText: "Bitte prüfen Sie die Lieferung auf Vollständigkeit.",
};

const LAYOUT_CREDIT_NOTE: DocumentLayoutSettings = {
  showPrices: true,
  showTax: true,
  showDiscount: true,
  showTotals: true,
  showPaymentInfo: true,
  showPositionNumbers: true,
  closingText: "Der Betrag wird Ihnen gutgeschrieben.",
};

export const DEFAULT_LAYOUTS: Record<DocumentType, DocumentLayoutSettings> = {
  INVOICE: LAYOUT_INVOICE,
  QUOTE: LAYOUT_QUOTE,
  DELIVERY_NOTE: LAYOUT_DELIVERY_NOTE,
  CREDIT_NOTE: LAYOUT_CREDIT_NOTE,
};

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  accentColor: "#b45309",
  headerBgColor: "#fef3c7",
  altRowColor: "#fffbeb",
  bodyFontSize: 9,
  titleFontSize: 18,
  paddingH: 50,
  paddingTop: 40,
  paddingBottom: 60,
  logoWidth: 100,
  logoHeight: 40,
  layouts: DEFAULT_LAYOUTS,
};

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
}

export interface EmailSettings {
  provider: "smtp" | "outlook";
  smtp: SmtpConfig | null;
  defaultSubject: string;
  defaultBody: string;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: "smtp",
  smtp: null,
  defaultSubject: "{{dokumentTyp}} {{dokumentNummer}} von {{firmenName}}",
  defaultBody:
    "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie {{dokumentTyp}} {{dokumentNummer}} über {{betrag}}.\n\n{{zahlungshinweis}}\n\nMit freundlichen Grüßen\n{{firmenName}}",
};

export const EMAIL_PLACEHOLDERS: { key: string; label: string; example: string }[] = [
  { key: "{{anrede}}", label: "Anrede", example: "Sehr geehrter Herr Mustermann," },
  { key: "{{kundenName}}", label: "Kundenname", example: "Max Mustermann" },
  { key: "{{dokumentNummer}}", label: "Belegnummer", example: "RE-2026-00001" },
  { key: "{{dokumentTyp}}", label: "Belegtyp", example: "Rechnung" },
  { key: "{{betrag}}", label: "Gesamtbetrag", example: "1.190,00 €" },
  { key: "{{faelligkeitsDatum}}", label: "Fälligkeitsdatum", example: "25.04.2026" },
  { key: "{{firmenName}}", label: "Firmenname", example: "Meine Firma GmbH" },
  { key: "{{zahlungshinweis}}", label: "Zahlungshinweis (auto)", example: "Bitte überweisen Sie den Betrag bis zum…" },
];

export interface CompanySettings {
  id: number;
  name: string;
  legalForm: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string;
  vatId: string | null;
  taxNumber: string | null;
  bankIban: string | null;
  bankBic: string | null;
  bankName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoPath: string | null;
  defaultCurrency: string;
  defaultPaymentDays: number;
  pdfSettings: PdfSettings | null;
  emailSettings: EmailSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ─── API Response Wrappers ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ─── Document Label Helpers ───────────────────────────────────────────────────

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  QUOTE: "Angebot",
  DELIVERY_NOTE: "Lieferschein",
  INVOICE: "Rechnung",
  CREDIT_NOTE: "Gutschrift",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Entwurf",
  FINAL: "Final",
  SENT: "Versendet",
  PAID: "Bezahlt",
  PARTIAL: "Teilbezahlt",
  CANCELLED: "Storniert",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Überweisung",
  CASH: "Barzahlung",
  DIRECT_DEBIT: "Lastschrift",
  PAYPAL: "PayPal",
  OTHER: "Sonstige",
};
