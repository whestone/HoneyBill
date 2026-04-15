import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Document as HBDocument, CompanySettings, DocumentLayoutSettings, TotalDisplayMode } from "@honeybill/shared";
import { DEFAULT_PDF_SETTINGS, DEFAULT_LAYOUTS, DOCUMENT_TYPE_LABELS, formatEur } from "@honeybill/shared";
import type { PdfSettings, DocumentType } from "@honeybill/shared";

// Static structural styles
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
    flexDirection: "row", borderRadius: 3, paddingVertical: 5, paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold", fontSize: 8,
  },
  tableRow: {
    flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb",
    paddingVertical: 5, paddingHorizontal: 6,
  },
  totalsBlock: { alignSelf: "flex-end", width: 220, marginBottom: 20 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { color: "#555" },
  totalsValue: { fontFamily: "Helvetica-Bold" },
  totalGrossRow: {
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, paddingTop: 6, marginTop: 4,
  },
  totalGrossLabel: { fontFamily: "Helvetica-Bold" },
  totalGrossValue: { fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute", left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: "#d1d5db",
    paddingTop: 8, fontSize: 7, color: "#9ca3af", flexDirection: "row", justifyContent: "space-between",
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

  // Merge global layout with per-document override
  const globalLayout = s.layouts[doc.documentType as DocumentType] ?? DEFAULT_LAYOUTS.INVOICE;
  const docOverride = (() => {
    const raw = (doc as any).layoutOverride;
    if (!raw) return {};
    if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
    return raw;
  })();
  const layout: DocumentLayoutSettings = { ...globalLayout, ...docOverride };

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
  const cols = buildColumns(layout);

  return (
    <Document>
      <Page
        size="A4"
        style={{
          fontFamily: "Helvetica", fontSize: s.bodyFontSize, color: "#1a1a1a",
          paddingTop: s.paddingTop, paddingBottom: s.paddingBottom, paddingHorizontal: s.paddingH,
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

        {/* Original invoice reference for credit notes / cancellations */}
        {doc.documentType === "CREDIT_NOTE" && (() => {
          const orig = (doc as any).cancelsDocument as { documentNumber?: string; issueDate?: string } | null;
          if (!orig?.documentNumber) return null;
          return (
            <View style={{ backgroundColor: "#fef3c7", borderRadius: 4, padding: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 8, color: "#92400e" }}>
                {"Bezieht sich auf Rechnung Nr. "}
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{orig.documentNumber}</Text>
                {orig.issueDate ? ` vom ${formatDate(orig.issueDate)}` : ""}
              </Text>
            </View>
          );
        })()}

        {/* Addresses */}
        <View style={base.addressRow}>
          <View style={base.addressBlock}>
            <Text style={base.addressLabel}>An</Text>
            <Text style={[base.addressLine, { fontFamily: "Helvetica-Bold" }]}>{customerName}</Text>
            {customer?.billStreet && <Text style={base.addressLine}>{customer.billStreet}</Text>}
            {(customer?.billZip || customer?.billCity) && (
              <Text style={base.addressLine}>{[customer?.billZip, customer?.billCity].filter(Boolean).join(" ")}</Text>
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
            {company.taxNumber && <Text style={base.addressLine}>St.-Nr.: {company.taxNumber}</Text>}
          </View>
        </View>

        {/* Line items table */}
        <View style={base.table}>
          <View style={[base.tableHeader, { backgroundColor: s.headerBgColor }]}>
            {cols.map((c) => <Text key={c.key} style={c.style}>{c.header}</Text>)}
          </View>
          {(doc.lineItems ?? []).map((li, idx) => {
            const rowBg = idx % 2 === 1 ? { backgroundColor: s.altRowColor } : {};
            if (li.lineType === "TEXT") {
              return (
                <View key={li.id} style={[base.tableRow, rowBg]}>
                  <Text style={{ flex: 1, color: "#666", fontStyle: "italic", paddingLeft: layout.colPositionNr ? 18 : 0 }}>
                    {li.description}
                  </Text>
                </View>
              );
            }
            if (li.lineType === "ITEM") {
              const lineGross = (parseFloat(li.lineNet) + parseFloat(li.lineTax)).toFixed(2);
              const values: Record<string, string> = {
                pos: String(li.position + 1),
                date: doc.issueDate ? formatDate(doc.issueDate) : "",
                desc: li.description,
                qty: li.quantity,
                unit: li.unit,
                price: formatEur(li.unitPrice),
                discount: li.discountPct !== "0.00"
                  ? ((li as any).discountType === "abs" ? formatEur(li.discountPct) : `${li.discountPct}%`)
                  : "—",
                tax: `${parseFloat(li.taxRatePct).toLocaleString("de-DE")}%`,
                taxAmt: formatEur(li.lineTax),
                net: formatEur(li.lineNet),
                gross: formatEur(lineGross),
              };
              return (
                <View key={li.id} style={[base.tableRow, rowBg]}>
                  {cols.map((c) => <Text key={c.key} style={c.style}>{values[c.key] ?? ""}</Text>)}
                </View>
              );
            }
            return null;
          })}
        </View>

        {/* Totals */}
        {layout.showTotals && <TotalsBlock doc={doc} layout={layout} s={s} />}

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
        {layout.closingText && <Text style={base.closingText}>{layout.closingText}</Text>}

        {/* Footer */}
        <View style={[base.footer, { bottom: s.paddingBottom / 3, left: s.paddingH, right: s.paddingH }]} fixed>
          <Text>{company.name}{company.legalForm ? ` ${company.legalForm}` : ""}</Text>
          <Text>{company.website ?? ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Totals block with display modes ─────────────────────────────────────────

function TotalsBlock({ doc, layout, s }: { doc: HBDocument; layout: DocumentLayoutSettings; s: PdfSettings }) {
  const td = layout.totalDisplay;
  const showNet = td === "net" || td === "both";
  const showGross = td === "gross" || td === "both";

  // Calculate discount if any line has discount
  const lines = doc.lineItems ?? [];
  const hasLineDiscount = lines.some((li) => li.lineType === "ITEM" && li.discountPct !== "0.00");

  // Raw line totals (before global discount)
  const rawNet = lines
    .filter((li) => li.lineType === "ITEM")
    .reduce((acc, li) => acc + parseFloat(li.lineNet), 0);
  const rawTax = lines
    .filter((li) => li.lineType === "ITEM")
    .reduce((acc, li) => acc + parseFloat(li.lineTax), 0);

  // Global discount
  const globalDiscountPct = parseFloat(doc.globalDiscountPct ?? "0.00");
  const globalDiscountType = (doc.globalDiscountType ?? "pct") as "pct" | "abs";
  const hasGlobalDiscount = globalDiscountPct > 0;
  const discountFactor = globalDiscountType === "abs"
    ? (rawNet > 0 ? Math.max(0, rawNet - globalDiscountPct) / rawNet : 1)
    : 1 - globalDiscountPct / 100;

  // Tax breakdown per rate.
  // For abs global discount: show RAW tax (before gross deduction) so that
  //   Netto + ΣUSt - Bruttorabatt = Gesamtsumme adds up exactly.
  // For pct global discount: show discounted tax (discountFactor already applied to net).
  const taxBreakdownRaw = (() => {
    const map = new Map<string, number>();
    for (const li of lines.filter((l) => l.lineType === "ITEM")) {
      const pct = li.taxRatePct ?? "0.00";
      map.set(pct, (map.get(pct) ?? 0) + parseFloat(li.lineTax));
    }
    return Array.from(map.entries())
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .map(([pct, amount]) => ({ pct, amount }));
  })();

  const taxBreakdown: { pct: string; amount: string }[] = (() => {
    // Use finalized taxLines if available (both pct and abs already applied discountFactor server-side)
    const tl = doc.taxLines ?? [];
    if (tl.length > 0) return tl.map((t) => ({ pct: t.taxRatePct, amount: t.taxAmount }));
    // Draft: apply discountFactor to raw tax (works for both pct and abs since factor is net-based)
    return taxBreakdownRaw.map(({ pct, amount }) => ({ pct, amount: (amount * discountFactor).toFixed(2) }));
  })();

  return (
    <View style={base.totalsBlock}>
      {/* 1. Netto */}
      {showNet && (
        <View style={base.totalsRow}>
          <Text style={base.totalsLabel}>Nettobetrag</Text>
          <Text style={base.totalsValue}>{formatEur(rawNet.toFixed(2))}</Text>
        </View>
      )}

      {/* 2. Nettorabatt (% oder €) */}
      {hasGlobalDiscount && (
        <View style={base.totalsRow}>
          <Text style={[base.totalsLabel, { color: "#dc2626" }]}>
            {globalDiscountType === "abs"
              ? `Rabatt ${formatEur(String(globalDiscountPct))}`
              : `Rabatt ${globalDiscountPct}%`}
          </Text>
          <Text style={[base.totalsValue, { color: "#dc2626" }]}>
            -{globalDiscountType === "abs"
              ? formatEur(String(Math.min(globalDiscountPct, rawNet)))
              : formatEur((rawNet * (globalDiscountPct / 100)).toFixed(2))}
          </Text>
        </View>
      )}

      {/* 3. Steuer pro Steuersatz */}
      {(showNet || showGross) && taxBreakdown.map(({ pct, amount }) => (
        <View key={pct} style={base.totalsRow}>
          <Text style={base.totalsLabel}>USt. {parseFloat(pct).toLocaleString("de-DE")}%</Text>
          <Text style={base.totalsValue}>{formatEur(amount)}</Text>
        </View>
      ))}

      {/* 5. Gesamtsumme */}
      <View style={[base.totalGrossRow, { borderTopColor: s.accentColor }]}>
        <Text style={[base.totalGrossLabel, { fontSize: s.bodyFontSize + 2 }]}>Gesamtsumme</Text>
        <Text style={[base.totalGrossValue, { fontSize: s.bodyFontSize + 2, color: s.accentColor }]}>
          {formatEur(doc.totalGross)}
        </Text>
      </View>
    </View>
  );
}

// ─── Column builder ──────────────────────────────────────────────────────────

interface Column { key: string; header: string; style: Record<string, any> }

function buildColumns(layout: DocumentLayoutSettings): Column[] {
  const cols: Column[] = [];

  if (layout.colPositionNr) cols.push({ key: "pos", header: "Nr.", style: { width: "5%" } });
  cols.push({ key: "desc", header: "Beschreibung", style: { flex: 1 } });
  if (layout.colDate) cols.push({ key: "date", header: "Datum", style: { width: "10%", textAlign: "center" } });
  if (layout.colQuantity) cols.push({ key: "qty", header: "Menge", style: { width: "8%", textAlign: "right" } });
  if (layout.colUnit) cols.push({ key: "unit", header: "Einheit", style: { width: "7%", textAlign: "center" } });
  if (layout.colPrice) cols.push({ key: "price", header: "Einzelpreis", style: { width: "10%", textAlign: "right" } });
  if (layout.colDiscount) cols.push({ key: "discount", header: "Rabatt", style: { width: "7%", textAlign: "right" } });
  if (layout.colNetAmount) cols.push({ key: "net", header: "Nettobetrag", style: { width: "10%", textAlign: "right" } });
  if (layout.colTax) cols.push({ key: "tax", header: "USt. %", style: { width: "7%", textAlign: "right" } });
  if (layout.colTaxAmount) cols.push({ key: "taxAmt", header: "USt.", style: { width: "8%", textAlign: "right" } });
  if (layout.colGrossAmount) cols.push({ key: "gross", header: "Betrag", style: { width: "10%", textAlign: "right" } });

  return cols;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
