import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Document as HBDocument, CompanySettings, DocumentLayoutSettings } from "@honeybill/shared";
import { DEFAULT_PDF_SETTINGS, DEFAULT_LAYOUTS, DOCUMENT_TYPE_LABELS, formatEur } from "@honeybill/shared";
import type { PdfSettings, DocumentType } from "@honeybill/shared";

// Static structural styles (layout-only, no colors/sizes from settings)
const base = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  companyBlock: { textAlign: "right", fontSize: 8, color: "#555", lineHeight: 1.5 },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  docMeta: { fontSize: 8, color: "#666", flexDirection: "row", gap: 16, marginBottom: 20 },
  addressRow: { flexDirection: "row", gap: 40, marginBottom: 24 },
  addressBlock: { flex: 1 },
  addressLabel: { fontSize: 7, color: "#999", textTransform: "uppercase", marginBottom: 4 },
  addressLine: { fontSize: 9, lineHeight: 1.5 },
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  totalsBlock: { alignSelf: "flex-end", width: 200, marginBottom: 20 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { color: "#555" },
  totalsValue: { fontFamily: "Helvetica-Bold" },
  totalGrossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 4,
  },
  totalGrossLabel: { fontFamily: "Helvetica-Bold" },
  totalGrossValue: { fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 0.5,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
    fontSize: 7,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paymentBlock: { marginTop: 16, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4 },
  paymentTitle: { fontFamily: "Helvetica-Bold", marginBottom: 4 },
  paymentRow: { flexDirection: "row", gap: 20, fontSize: 8 },
  paymentItem: { flexDirection: "row", gap: 4 },
  paymentLabel: { color: "#555" },
  closingText: { marginTop: 16, fontSize: 9, color: "#555", lineHeight: 1.6 },
});

interface InvoicePDFProps {
  doc: HBDocument;
  company: CompanySettings;
}

export function InvoicePDF({ doc, company }: InvoicePDFProps) {
  const savedLayouts = (company.pdfSettings?.layouts ?? {}) as Partial<Record<DocumentType, Partial<DocumentLayoutSettings>>>;
  const mergedLayouts = Object.fromEntries(
    (["INVOICE", "QUOTE", "DELIVERY_NOTE", "CREDIT_NOTE"] as DocumentType[]).map(
      (dt) => [dt, { ...DEFAULT_LAYOUTS[dt], ...(savedLayouts[dt] ?? {}) }]
    )
  ) as Record<DocumentType, DocumentLayoutSettings>;
  const s: PdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(company.pdfSettings ?? {}), layouts: mergedLayouts };
  const layout: DocumentLayoutSettings = s.layouts[doc.documentType as DocumentType] ?? DEFAULT_LAYOUTS.INVOICE;

  const customer = (() => {
    const raw = doc.customerSnapshot ?? (doc as any).customer;
    if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
    return raw ?? null;
  })();

  const customerName =
    customer?.companyName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "Unbekannter Kunde";

  const logoUrl = company.logoPath ? `/uploads/${company.logoPath}` : null;

  // Dynamic column definitions based on layout
  const cols = buildColumns(layout);

  return (
    <Document>
      <Page
        size="A4"
        style={{
          fontFamily: "Helvetica",
          fontSize: s.bodyFontSize,
          color: "#1a1a1a",
          paddingTop: s.paddingTop,
          paddingBottom: s.paddingBottom,
          paddingHorizontal: s.paddingH,
        }}
      >
        {/* Header */}
        <View style={base.headerRow}>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={{ width: s.logoWidth, height: s.logoHeight, objectFit: "contain" }} />
            ) : (
              <Text style={[base.companyName, { fontSize: 16 }]}>{company.name}</Text>
            )}
          </View>
          <View style={base.companyBlock}>
            {logoUrl && <Text style={base.companyName}>{company.name}</Text>}
            {company.legalForm && <Text>{company.legalForm}</Text>}
            {company.street && <Text>{company.street}</Text>}
            {(company.zip || company.city) && (
              <Text>{[company.zip, company.city].filter(Boolean).join(" ")}</Text>
            )}
            {company.email && <Text>{company.email}</Text>}
            {company.phone && <Text>{company.phone}</Text>}
          </View>
        </View>

        {/* Document title */}
        <Text style={{ fontSize: s.titleFontSize, fontFamily: "Helvetica-Bold", color: s.accentColor, marginBottom: 4 }}>
          {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS]}
        </Text>
        <View style={base.docMeta}>
          {doc.documentNumber && <Text>Nr. {doc.documentNumber}</Text>}
          {doc.issueDate && <Text>Datum: {formatDate(doc.issueDate)}</Text>}
          {doc.dueDate && layout.showPaymentInfo && <Text>Fällig: {formatDate(doc.dueDate)}</Text>}
          {doc.deliveryDate && <Text>Leistungsdatum: {formatDate(doc.deliveryDate)}{doc.deliveryDateEnd ? ` – ${formatDate(doc.deliveryDateEnd)}` : ""}</Text>}
        </View>

        {/* Addresses */}
        <View style={base.addressRow}>
          <View style={base.addressBlock}>
            <Text style={base.addressLabel}>An</Text>
            <Text style={[base.addressLine, { fontFamily: "Helvetica-Bold" }]}>
              {customerName}
            </Text>
            {customer?.billStreet && <Text style={base.addressLine}>{customer.billStreet}</Text>}
            {(customer?.billZip || customer?.billCity) && (
              <Text style={base.addressLine}>
                {[customer?.billZip, customer?.billCity].filter(Boolean).join(" ")}
              </Text>
            )}
            {customer?.vatId && <Text style={base.addressLine}>USt-IdNr.: {customer.vatId}</Text>}
          </View>
          <View style={base.addressBlock}>
            {company.vatId && (
              <>
                <Text style={base.addressLabel}>Rechnungssteller</Text>
                <Text style={base.addressLine}>USt-IdNr.: {company.vatId}</Text>
              </>
            )}
            {company.taxNumber && (
              <Text style={base.addressLine}>St.-Nr.: {company.taxNumber}</Text>
            )}
          </View>
        </View>

        {/* Line items table */}
        <View style={base.table}>
          <View style={[base.tableHeader, { backgroundColor: s.headerBgColor }]}>
            {cols.map((c) => (
              <Text key={c.key} style={c.style}>{c.header}</Text>
            ))}
          </View>
          {(doc.lineItems ?? []).map((li, idx) => {
            const rowStyle = idx % 2 === 1 ? { backgroundColor: s.altRowColor } : {};
            if (li.lineType === "TEXT") {
              return (
                <View key={li.id} style={[base.tableRow, rowStyle]}>
                  <Text style={{ flex: 1, color: "#666", fontStyle: "italic", paddingLeft: layout.showPositionNumbers ? 18 : 0 }}>
                    {li.description}
                  </Text>
                </View>
              );
            }
            if (li.lineType === "ITEM") {
              const values: Record<string, string> = {
                pos: String(li.position + 1),
                desc: li.description,
                qty: li.quantity,
                unit: li.unit,
                price: formatEur(li.unitPrice),
                discount: li.discountPct !== "0.00" ? `${li.discountPct}%` : "—",
                tax: `${li.taxRatePct}%`,
                net: formatEur(li.lineNet),
              };
              return (
                <View key={li.id} style={[base.tableRow, rowStyle]}>
                  {cols.map((c) => (
                    <Text key={c.key} style={c.style}>{values[c.key] ?? ""}</Text>
                  ))}
                </View>
              );
            }
            return null;
          })}
        </View>

        {/* Totals */}
        {layout.showTotals && (
          <View style={base.totalsBlock}>
            <View style={base.totalsRow}>
              <Text style={base.totalsLabel}>Nettobetrag</Text>
              <Text style={base.totalsValue}>{formatEur(doc.subtotalNet)}</Text>
            </View>
            {layout.showTax && (doc.taxLines ?? []).map((tl) => (
              <View key={tl.id} style={base.totalsRow}>
                <Text style={base.totalsLabel}>MwSt. {tl.taxRatePct}%</Text>
                <Text style={base.totalsValue}>{formatEur(tl.taxAmount)}</Text>
              </View>
            ))}
            <View style={[base.totalGrossRow, { borderTopColor: s.accentColor }]}>
              <Text style={[base.totalGrossLabel, { fontSize: s.bodyFontSize + 2 }]}>Gesamtbetrag</Text>
              <Text style={[base.totalGrossValue, { fontSize: s.bodyFontSize + 2, color: s.accentColor }]}>
                {formatEur(doc.totalGross)}
              </Text>
            </View>
          </View>
        )}

        {/* Payment info */}
        {layout.showPaymentInfo && (company.bankIban || company.bankBic || doc.paymentTermsText || doc.dueDate || doc.paymentDays) && (
          <View style={base.paymentBlock}>
            <Text style={base.paymentTitle}>Zahlungsinformationen</Text>
            <View style={base.paymentRow}>
              {doc.paymentTermsText ? (
                <View style={base.paymentItem}>
                  <Text style={base.paymentLabel}>Zahlungsziel:</Text>
                  <Text>{doc.paymentTermsText}</Text>
                </View>
              ) : doc.paymentDays != null ? (
                <View style={base.paymentItem}>
                  <Text style={base.paymentLabel}>Zahlungsziel:</Text>
                  <Text>{doc.paymentDays} Tage{doc.dueDate ? ` (bis ${formatDate(doc.dueDate)})` : ""}</Text>
                </View>
              ) : doc.dueDate ? (
                <View style={base.paymentItem}>
                  <Text style={base.paymentLabel}>Fällig bis:</Text>
                  <Text>{formatDate(doc.dueDate)}</Text>
                </View>
              ) : null}
              {company.bankIban && (
                <View style={base.paymentItem}>
                  <Text style={base.paymentLabel}>IBAN:</Text>
                  <Text>{company.bankIban}</Text>
                </View>
              )}
              {company.bankBic && (
                <View style={base.paymentItem}>
                  <Text style={base.paymentLabel}>BIC:</Text>
                  <Text>{company.bankBic}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Closing text */}
        {layout.closingText && (
          <Text style={base.closingText}>{layout.closingText}</Text>
        )}

        {/* Footer */}
        <View
          style={[
            base.footer,
            { bottom: s.paddingBottom / 3, left: s.paddingH, right: s.paddingH },
          ]}
          fixed
        >
          <Text>{company.name}{company.legalForm ? ` ${company.legalForm}` : ""}</Text>
          <Text>{company.website ?? ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Column builder ──────────────────────────────────────────────────────────

interface Column {
  key: string;
  header: string;
  style: Record<string, any>;
}

function buildColumns(layout: DocumentLayoutSettings): Column[] {
  const cols: Column[] = [];

  if (layout.showPositionNumbers) {
    cols.push({ key: "pos", header: "#", style: { width: "6%" } });
  }

  cols.push({ key: "desc", header: "Beschreibung", style: { flex: 1 } });
  cols.push({ key: "qty", header: "Menge", style: { width: "9%", textAlign: "right" } });
  cols.push({ key: "unit", header: "Einh.", style: { width: "8%", textAlign: "center" } });

  if (layout.showPrices) {
    cols.push({ key: "price", header: "Einzelpr.", style: { width: "12%", textAlign: "right" } });
  }
  if (layout.showDiscount) {
    cols.push({ key: "discount", header: "Rabatt", style: { width: "8%", textAlign: "right" } });
  }
  if (layout.showTax) {
    cols.push({ key: "tax", header: "MwSt.", style: { width: "8%", textAlign: "right" } });
  }
  if (layout.showPrices) {
    cols.push({ key: "net", header: "Netto", style: { width: "12%", textAlign: "right" } });
  }

  return cols;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
