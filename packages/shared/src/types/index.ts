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
  // Nur von GET /tax-rates geliefert: Anzahl Referenzen in Produkten / Rechnungspositionen.
  // Wenn >0, ist Loeschen nicht erlaubt (GoBD-Schutz).
  usageProducts?: number;
  usageLineItems?: number;
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
  resetMonthly: boolean;
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
  discountType: "pct" | "abs";
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
  globalDiscountPct: string;
  globalDiscountType: "pct" | "abs";
  layoutOverride: Partial<DocumentLayoutSettings> | null;
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

export type TotalDisplayMode = "gross" | "net" | "both";

export interface DocumentLayoutSettings {
  // Column visibility
  colPositionNr: boolean;
  colDate: boolean;
  colQuantity: boolean;
  colUnit: boolean;
  colPrice: boolean;
  colDiscount: boolean;
  colTax: boolean;
  colTaxAmount: boolean;
  colNetAmount: boolean;
  colGrossAmount: boolean;
  // Sections
  showTotals: boolean;
  showPaymentInfo: boolean;
  totalDisplay: TotalDisplayMode;
  closingText: string;
}

const LAYOUT_INVOICE: DocumentLayoutSettings = {
  colPositionNr: true,
  colDate: false,
  colQuantity: true,
  colUnit: true,
  colPrice: true,
  colDiscount: true,
  colTax: true,
  colTaxAmount: false,
  colNetAmount: true,
  colGrossAmount: false,
  showTotals: true,
  showPaymentInfo: true,
  totalDisplay: "both",
  closingText: "Vielen Dank für Ihren Auftrag.",
};

const LAYOUT_QUOTE: DocumentLayoutSettings = {
  colPositionNr: true,
  colDate: false,
  colQuantity: true,
  colUnit: true,
  colPrice: true,
  colDiscount: true,
  colTax: true,
  colTaxAmount: false,
  colNetAmount: true,
  colGrossAmount: false,
  showTotals: true,
  showPaymentInfo: false,
  totalDisplay: "gross",
  closingText: "Dieses Angebot ist 30 Tage gültig.",
};

const LAYOUT_DELIVERY_NOTE: DocumentLayoutSettings = {
  colPositionNr: true,
  colDate: false,
  colQuantity: true,
  colUnit: true,
  colPrice: false,
  colDiscount: false,
  colTax: false,
  colTaxAmount: false,
  colNetAmount: false,
  colGrossAmount: false,
  showTotals: false,
  showPaymentInfo: false,
  totalDisplay: "gross",
  closingText: "Bitte prüfen Sie die Lieferung auf Vollständigkeit.",
};

const LAYOUT_CREDIT_NOTE: DocumentLayoutSettings = {
  colPositionNr: true,
  colDate: false,
  colQuantity: true,
  colUnit: true,
  colPrice: true,
  colDiscount: true,
  colTax: true,
  colTaxAmount: false,
  colNetAmount: true,
  colGrossAmount: false,
  showTotals: true,
  showPaymentInfo: true,
  totalDisplay: "both",
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

export const EMAIL_PLACEHOLDERS: { key: string; group: string; label: string; example: string }[] = [
  // Dokument
  { key: "{{dokumentNummer}}", group: "Dokument", label: "Belegnummer", example: "RE-2026-00001" },
  { key: "{{dokumentTyp}}", group: "Dokument", label: "Belegtyp", example: "Rechnung" },
  { key: "{{ausstellungsDatum}}", group: "Dokument", label: "Ausstellungsdatum", example: "10.04.2026" },
  { key: "{{faelligkeitsDatum}}", group: "Dokument", label: "Fälligkeitsdatum", example: "25.04.2026" },
  { key: "{{nettobetrag}}", group: "Dokument", label: "Nettobetrag", example: "1.000,00 €" },
  { key: "{{betrag}}", group: "Dokument", label: "Gesamtbetrag (brutto)", example: "1.190,00 €" },
  { key: "{{zahlungshinweis}}", group: "Dokument", label: "Zahlungshinweis (auto)", example: "Bitte überweisen Sie…" },
  // Kunde
  { key: "{{anrede}}", group: "Kunde", label: "Anrede (formell)", example: "Sehr geehrter Herr Mustermann," },
  { key: "{{kundenName}}", group: "Kunde", label: "Kundenname (Firma oder Vor+Nachname)", example: "Max Mustermann" },
  { key: "{{kundenVorname}}", group: "Kunde", label: "Vorname", example: "Max" },
  { key: "{{kundenNachname}}", group: "Kunde", label: "Nachname", example: "Mustermann" },
  { key: "{{kundenFirma}}", group: "Kunde", label: "Firmenname (Kunde)", example: "Mustermann GmbH" },
  { key: "{{kundenEmail}}", group: "Kunde", label: "E-Mail (Kunde)", example: "max@mustermann.de" },
  { key: "{{kundenTelefon}}", group: "Kunde", label: "Telefon (Kunde)", example: "+49 30 12345678" },
  { key: "{{kundenStrasse}}", group: "Kunde", label: "Straße (Rechnungsadresse)", example: "Musterstraße 1" },
  { key: "{{kundenPlz}}", group: "Kunde", label: "PLZ", example: "10115" },
  { key: "{{kundenOrt}}", group: "Kunde", label: "Ort", example: "Berlin" },
  { key: "{{kundenUstId}}", group: "Kunde", label: "USt-IdNr.", example: "DE123456789" },
  // Firma
  { key: "{{firmenName}}", group: "Firma", label: "Firmenname", example: "Meine Firma GmbH" },
  { key: "{{firmenStrasse}}", group: "Firma", label: "Straße (Firma)", example: "Hauptstraße 1" },
  { key: "{{firmenPlz}}", group: "Firma", label: "PLZ (Firma)", example: "10115" },
  { key: "{{firmenOrt}}", group: "Firma", label: "Ort (Firma)", example: "Berlin" },
  { key: "{{firmenEmail}}", group: "Firma", label: "E-Mail (Firma)", example: "info@meinefirma.de" },
  { key: "{{firmenTelefon}}", group: "Firma", label: "Telefon (Firma)", example: "+49 30 987654" },
  { key: "{{firmenIban}}", group: "Firma", label: "IBAN", example: "DE12 3456 7890 1234 5678 90" },
  { key: "{{firmenUstId}}", group: "Firma", label: "USt-IdNr. (Firma)", example: "DE987654321" },
  // Mitarbeiter
  { key: "{{mitarbeiterName}}", group: "Mitarbeiter", label: "Vollständiger Name", example: "Anna Schmidt" },
  { key: "{{mitarbeiterVorname}}", group: "Mitarbeiter", label: "Vorname", example: "Anna" },
  { key: "{{mitarbeiterNachname}}", group: "Mitarbeiter", label: "Nachname", example: "Schmidt" },
  { key: "{{mitarbeiterEmail}}", group: "Mitarbeiter", label: "E-Mail", example: "anna@firma.de" },
  { key: "{{mitarbeiterTelefon}}", group: "Mitarbeiter", label: "Telefon (Festnetz)", example: "+49 30 12345678" },
  { key: "{{mitarbeiterMobil}}", group: "Mitarbeiter", label: "Mobil", example: "+49 170 1234567" },
];

export interface NumberSeries {
  id: number;
  documentType: DocumentType;
  prefix: string;
  suffix: string;
  yearSegment: boolean;
  monthSegment: boolean;
  padding: number;
  format: string | null;
  nextCounter: number;
  lastResetAt: string | null;
  resetYearly: boolean;
  resetMonthly: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mobile: string | null;
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
