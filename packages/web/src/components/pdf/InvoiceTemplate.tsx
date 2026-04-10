import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Document as HBDocument, CompanySettings, DocumentLineItem } from "@honeybill/shared";
import { DOCUMENT_TYPE_LABELS, formatEur } from "@honeybill/shared";

// Register a standard font (Helvetica is built-in, no download needed)
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  // Header row
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  logo: { width: 100, height: 40, objectFit: "contain" },
  companyBlock: { textAlign: "right", fontSize: 8, color: "#555", lineHeight: 1.5 },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },

  // Document title
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#b45309", marginBottom: 4 },
  docMeta: { fontSize: 8, color: "#666", flexDirection: "row", gap: 16, marginBottom: 20 },

  // Addresses
  addressRow: { flexDirection: "row", gap: 40, marginBottom: 24 },
  addressBlock: { flex: 1 },
  addressLabel: { fontSize: 7, color: "#999", textTransform: "uppercase", marginBottom: 4 },
  addressLine: { fontSize: 9, lineHeight: 1.5 },

  // Table
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
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
  tableRowAlt: { backgroundColor: "#fffbeb" },

  colPos:   { width: "6%"  },
  colDesc:  { flex: 1      },
  colQty:   { width: "9%", textAlign: "right" },
  colUnit:  { width: "8%", textAlign: "center" },
  colPrice: { width: "12%", textAlign: "right" },
  colDisc:  { width: "8%", textAlign: "right" },
  colTax:   { width: "8%", textAlign: "right" },
  colNet:   { width: "12%", textAlign: "right" },

  // Totals
  totalsBlock: { alignSelf: "flex-end", width: 200, marginBottom: 20 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { color: "#555" },
  totalsValue: { fontFamily: "Helvetica-Bold" },
  totalGrossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d97706",
    paddingTop: 6,
    marginTop: 4,
  },
  totalGrossLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalGrossValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#d97706" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
    fontSize: 7,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // Payment
  paymentBlock: { marginTop: 16, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4 },
  paymentTitle: { fontFamily: "Helvetica-Bold", marginBottom: 4 },
  paymentRow: { flexDirection: "row", gap: 20, fontSize: 8 },
  paymentItem: { flexDirection: "row", gap: 4 },
  paymentLabel: { color: "#555" },

  // Notes
  notesBlock: { marginTop: 12, fontSize: 8, color: "#555", lineHeight: 1.6 },
});

interface InvoicePDFProps {
  doc: HBDocument;
  company: CompanySettings;
}

export function InvoicePDF({ doc, company }: InvoicePDFProps) {
  const customer = doc.customerSnapshot
    ? (doc.customerSnapshot as any)
    : doc.customer;

  const customerName =
    customer?.companyName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "Unbekannter Kunde";

  const itemLines = (doc.lineItems ?? []).filter((li) => li.lineType === "ITEM");
  const textLines = (doc.lineItems ?? []).filter((li) => li.lineType === "TEXT");

  const logoUrl = company.logoPath ? `/uploads/${company.logoPath}` : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text style={[styles.companyName, { fontSize: 16 }]}>{company.name}</Text>
            )}
          </View>
          <View style={styles.companyBlock}>
            {logoUrl && <Text style={styles.companyName}>{company.name}</Text>}
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
        <Text style={styles.docTitle}>
          {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS]}
        </Text>
        <View style={styles.docMeta}>
          {doc.documentNumber && <Text>Nr. {doc.documentNumber}</Text>}
          {doc.issueDate && <Text>Datum: {formatDate(doc.issueDate)}</Text>}
          {doc.dueDate && <Text>Fällig: {formatDate(doc.dueDate)}</Text>}
          {doc.deliveryDate && <Text>Leistungsdatum: {formatDate(doc.deliveryDate)}</Text>}
        </View>

        {/* Addresses */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>An</Text>
            <Text style={[styles.addressLine, { fontFamily: "Helvetica-Bold" }]}>
              {customerName}
            </Text>
            {customer?.billStreet && <Text style={styles.addressLine}>{customer.billStreet}</Text>}
            {(customer?.billZip || customer?.billCity) && (
              <Text style={styles.addressLine}>
                {[customer?.billZip, customer?.billCity].filter(Boolean).join(" ")}
              </Text>
            )}
            {customer?.vatId && <Text style={styles.addressLine}>USt-IdNr.: {customer.vatId}</Text>}
          </View>
          <View style={styles.addressBlock}>
            {company.vatId && (
              <>
                <Text style={styles.addressLabel}>Rechnungssteller</Text>
                <Text style={styles.addressLine}>USt-IdNr.: {company.vatId}</Text>
              </>
            )}
            {company.taxNumber && (
              <Text style={styles.addressLine}>St.-Nr.: {company.taxNumber}</Text>
            )}
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colPos}>#</Text>
            <Text style={styles.colDesc}>Beschreibung</Text>
            <Text style={styles.colQty}>Menge</Text>
            <Text style={styles.colUnit}>Einh.</Text>
            <Text style={styles.colPrice}>Einzelpr.</Text>
            <Text style={styles.colDisc}>Rabatt</Text>
            <Text style={styles.colTax}>MwSt.</Text>
            <Text style={styles.colNet}>Netto</Text>
          </View>
          {(doc.lineItems ?? []).map((li, idx) => {
            if (li.lineType === "TEXT") {
              return (
                <View key={li.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.colDesc, { color: "#666", fontStyle: "italic", paddingLeft: 18 }]}>
                    {li.description}
                  </Text>
                </View>
              );
            }
            if (li.lineType === "ITEM") {
              return (
                <View key={li.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={styles.colPos}>{li.position + 1}</Text>
                  <Text style={styles.colDesc}>{li.description}</Text>
                  <Text style={styles.colQty}>{li.quantity}</Text>
                  <Text style={styles.colUnit}>{li.unit}</Text>
                  <Text style={styles.colPrice}>{formatEur(li.unitPrice)}</Text>
                  <Text style={styles.colDisc}>
                    {li.discountPct !== "0.00" ? `${li.discountPct}%` : "—"}
                  </Text>
                  <Text style={styles.colTax}>{li.taxRatePct}%</Text>
                  <Text style={styles.colNet}>{formatEur(li.lineNet)}</Text>
                </View>
              );
            }
            return null;
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Nettobetrag</Text>
            <Text style={styles.totalsValue}>{formatEur(doc.subtotalNet)}</Text>
          </View>
          {(doc.taxLines ?? []).map((tl) => (
            <View key={tl.id} style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>MwSt. {tl.taxRatePct}%</Text>
              <Text style={styles.totalsValue}>{formatEur(tl.taxAmount)}</Text>
            </View>
          ))}
          <View style={styles.totalGrossRow}>
            <Text style={styles.totalGrossLabel}>Gesamtbetrag</Text>
            <Text style={styles.totalGrossValue}>{formatEur(doc.totalGross)}</Text>
          </View>
        </View>

        {/* Payment info */}
        {(company.bankIban || doc.paymentTermsText) && (
          <View style={styles.paymentBlock}>
            <Text style={styles.paymentTitle}>Zahlungsinformationen</Text>
            <View style={styles.paymentRow}>
              {doc.paymentTermsText && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentLabel}>Zahlungsziel:</Text>
                  <Text>{doc.paymentTermsText}</Text>
                </View>
              )}
              {doc.dueDate && !doc.paymentTermsText && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentLabel}>Fällig bis:</Text>
                  <Text>{formatDate(doc.dueDate)}</Text>
                </View>
              )}
              {company.bankIban && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentLabel}>IBAN:</Text>
                  <Text>{company.bankIban}</Text>
                </View>
              )}
              {company.bankBic && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentLabel}>BIC:</Text>
                  <Text>{company.bankBic}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{company.name}{company.legalForm ? ` ${company.legalForm}` : ""}</Text>
          <Text>{company.website ?? ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
