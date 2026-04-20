import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CompanySettings, PdfSettings, DocumentType, DocumentLayoutSettings, Document as HBDocument } from "@honeybill/shared";
import {
  DEFAULT_PDF_SETTINGS, DEFAULT_LAYOUTS, type UpdatePdfSettingsInput,
  DOCUMENT_TYPE_LABELS,
} from "@honeybill/shared";
import { useEffect, useState, useMemo } from "react";
import { CheckCircle, FileText } from "lucide-react";
import { usePDF } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/InvoiceTemplate";

// ─── Mock document for PDF preview ───────────────────────────────────────────

const MOCK_NUMBER: Record<DocumentType, string> = {
  INVOICE: "RE-2026-00001", QUOTE: "ANG-2026-00001",
  DELIVERY_NOTE: "LS-2026-00001", CREDIT_NOTE: "GS-2026-00001",
};

function mockDoc(docType: DocumentType): HBDocument {
  return {
    id: 0, documentType: docType, documentNumber: MOCK_NUMBER[docType], status: "FINAL",
    customerId: 0, customerSnapshot: null, layoutOverride: null, globalDiscountPct: "0.00", globalDiscountType: "pct" as const,
    issueDate: "2026-04-10", deliveryDate: docType === "DELIVERY_NOTE" ? "2026-04-11" : null, deliveryDateEnd: null,
    dueDate: docType === "INVOICE" ? "2026-05-10" : null, quoteValidUntil: docType === "QUOTE" ? "2026-05-10" : null,
    sourceDocumentId: null, cancelsDocumentId: null,
    subtotalNet: "1680.67", totalTax: "319.33", totalGross: "2000.00",
    currency: "EUR", paymentDays: docType === "INVOICE" ? 30 : null, paymentTermsText: null,
    templateId: null, einvoiceProfile: null, leitwegId: null, internalNotes: null,
    createdBy: null, finalizedBy: null, finalizedAt: null,
    createdAt: "2026-04-10T00:00:00Z", updatedAt: "2026-04-10T00:00:00Z",
    customer: {
      id: 1, customerNumber: "KD-00001", companyName: "Musterfirma GmbH",
      salutation: null, firstName: null, lastName: null,
      email: "info@musterfirma.de", phone: null,
      billStreet: "Musterstraße 1", billZip: "10115", billCity: "Berlin", billCountry: "DE",
      shipStreet: null, shipZip: null, shipCity: null, shipCountry: null,
      vatId: "DE123456789", taxExempt: false, reverseCharge: false,
      paymentDays: 30, leitwegId: null, notes: null, isArchived: false,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    },
    lineItems: [
      { id: 1, documentId: 0, position: 0, lineType: "ITEM", productId: null, productSnapshot: null,
        description: "Webentwicklung (Frontend)", quantity: "8", unit: "Std",
        unitPrice: "120.00", discountPct: "0.00", discountType: "pct" as const, taxRateId: 1, taxRatePct: "19.00",
        lineNet: "960.00", lineTax: "182.40", lineGross: "1142.40", createdAt: "" },
      { id: 2, documentId: 0, position: 1, lineType: "ITEM" as const, productId: null, productSnapshot: null,
        description: "Beratung & Konzeption", quantity: "4", unit: "Std",
        unitPrice: "150.00", discountPct: "10.00", discountType: "pct" as const, taxRateId: 1, taxRatePct: "19.00",
        lineNet: "540.00", lineTax: "102.60", lineGross: "642.60", createdAt: "" },
      { id: 3, documentId: 0, position: 2, lineType: "ITEM" as const, productId: null, productSnapshot: null,
        description: "Hosting (jährlich)", quantity: "1", unit: "Jahr",
        unitPrice: "180.67", discountPct: "0.00", discountType: "pct" as const, taxRateId: 1, taxRatePct: "19.00",
        lineNet: "180.67", lineTax: "34.33", lineGross: "215.00", createdAt: "" },
    ],
    taxLines: [
      { id: 1, documentId: 0, taxRateId: 1, taxRatePct: "19.00", taxCategory: "S",
        taxableAmount: "1680.67", taxAmount: "319.33" },
    ],
  };
}

// ─── PDF Layout Tab ───────────────────────────────────────────────────────────

const DOC_TYPES: DocumentType[] = ["INVOICE", "QUOTE", "DELIVERY_NOTE", "CREDIT_NOTE"];

const COLUMN_TOGGLES: { key: keyof DocumentLayoutSettings; label: string }[] = [
  { key: "colPositionNr", label: "Lfd. Nr." },
  { key: "colDate", label: "Datum" },
  { key: "colQuantity", label: "Menge" },
  { key: "colUnit", label: "Einheit" },
  { key: "colPrice", label: "Preis" },
  { key: "colDiscount", label: "Rabatt" },
  { key: "colTax", label: "USt. %" },
  { key: "colTaxAmount", label: "USt. Betrag" },
  { key: "colNetAmount", label: "Netto" },
  { key: "colGrossAmount", label: "Brutto" },
];

const SECTION_TOGGLES: { key: keyof DocumentLayoutSettings; label: string }[] = [
  { key: "showTotals", label: "Summenblock" },
  { key: "showPaymentInfo", label: "Zahlungsinformationen" },
];

const TOTAL_DISPLAY_OPTIONS: { value: string; label: string }[] = [
  { value: "gross", label: "Brutto" },
  { value: "net", label: "Netto" },
  { value: "both", label: "Brutto & Netto" },
];

export function PdfLayoutTab() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [previewType, setPreviewType] = useState<DocumentType>("INVOICE");

  const { data: company, isLoading } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => api.get("/settings/company"),
  });

  const [settings, setSettings] = useState<PdfSettings>({ ...DEFAULT_PDF_SETTINGS, layouts: { ...DEFAULT_LAYOUTS } });

  useEffect(() => {
    if (company?.pdfSettings) {
      const merged = { ...DEFAULT_PDF_SETTINGS, ...company.pdfSettings };
      merged.layouts = { ...DEFAULT_LAYOUTS };
      if (company.pdfSettings.layouts) {
        for (const dt of DOC_TYPES) {
          if (company.pdfSettings.layouts[dt]) {
            merged.layouts[dt] = { ...DEFAULT_LAYOUTS[dt], ...company.pdfSettings.layouts[dt] };
          }
        }
      }
      setSettings(merged);
    }
  }, [company]);

  const savePdf = useMutation({
    mutationFn: (data: UpdatePdfSettingsInput) => api.put("/settings/company/pdf", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const previewCompany = useMemo<CompanySettings>(() => ({
    ...(company ?? {
      id: 1, name: "Meine Firma", legalForm: null, street: null, zip: null, city: null,
      country: "DE", vatId: null, taxNumber: null, bankIban: "DE89 3704 0044 0532 0130 00",
      bankBic: "COBADEFFXXX", bankName: null, email: null, phone: null, website: null,
      logoPath: null, defaultCurrency: "EUR", defaultPaymentDays: 14, createdAt: "", updatedAt: "",
    }),
    pdfSettings: settings,
  } as CompanySettings), [company, settings]);

  const previewDoc = useMemo(() => mockDoc(previewType), [previewType]);

  const [instance, updateInstance] = usePDF({
    document: <InvoicePDF doc={previewDoc} company={previewCompany} />,
  });

  useEffect(() => {
    updateInstance(<InvoicePDF doc={previewDoc} company={previewCompany} />);
  }, [previewCompany, previewDoc]);

  const set = <K extends keyof PdfSettings>(key: K, val: PdfSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const currentLayout = settings.layouts[previewType];
  const setLayout = <K extends keyof DocumentLayoutSettings>(key: K, val: DocumentLayoutSettings[K]) =>
    setSettings((prev) => ({
      ...prev,
      layouts: { ...prev.layouts, [previewType]: { ...prev.layouts[previewType], [key]: val } },
    }));

  if (isLoading) return <div className="py-8 text-center text-gray-400">Laden…</div>;

  return (
    <div className="grid grid-cols-[400px_1fr] gap-6 items-start">
      {/* Controls */}
      <div className="space-y-4">
        {/* Document type tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {DOC_TYPES.map((dt) => (
            <button
              key={dt}
              type="button"
              onClick={() => setPreviewType(dt)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                previewType === dt ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {DOCUMENT_TYPE_LABELS[dt]}
            </button>
          ))}
        </div>

        {/* Layout settings per doc type */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">
            Layout: {DOCUMENT_TYPE_LABELS[previewType]}
          </h2>

          {/* Column visibility */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sichtbare Spalten</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {COLUMN_TOGGLES.map((t) => (
                <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentLayout[t.key] as boolean}
                    onChange={(e) => setLayout(t.key, e.target.checked as any)}
                    className="accent-honey-600"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Abschnitte</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {SECTION_TOGGLES.map((t) => (
                <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentLayout[t.key] as boolean}
                    onChange={(e) => setLayout(t.key, e.target.checked as any)}
                    className="accent-honey-600"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Total display mode */}
          {currentLayout.showTotals && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Gesamtbetrag anzeigen als</p>
              <div className="flex flex-col gap-1.5">
                {TOTAL_DISPLAY_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`totalDisplay-${previewType}`}
                      value={o.value}
                      checked={currentLayout.totalDisplay === o.value}
                      onChange={() => setLayout("totalDisplay", o.value as any)}
                      className="accent-honey-600"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Closing text */}
          <div>
            <label className="label text-xs">Schlusstext</label>
            <textarea
              rows={3}
              value={currentLayout.closingText}
              onChange={(e) => setLayout("closingText", e.target.value)}
              className="input w-full text-xs resize-y"
              placeholder="z. B. Vielen Dank für Ihren Auftrag."
            />
          </div>
        </div>

        {/* Colors */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={16} /> Farben
          </h2>
          <ColorRow label="Akzentfarbe" hint="Titel, Summen-Rahmen" value={settings.accentColor}
            onChange={(v) => set("accentColor", v)} />
          <ColorRow label="Tabellenkopf" hint="Hintergrund der Kopfzeile" value={settings.headerBgColor}
            onChange={(v) => set("headerBgColor", v)} />
          <ColorRow label="Zebrastreifen" hint="Jede zweite Tabellenzeile" value={settings.altRowColor}
            onChange={(v) => set("altRowColor", v)} />
        </div>

        {/* Typography & spacing */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Schrift & Abstände</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberRow label="Schrift (Body)" unit="pt" min={6} max={14}
              value={settings.bodyFontSize} onChange={(v) => set("bodyFontSize", v)} />
            <NumberRow label="Titel" unit="pt" min={10} max={32}
              value={settings.titleFontSize} onChange={(v) => set("titleFontSize", v)} />
            <NumberRow label="Rand seitlich" unit="px" min={20} max={80}
              value={settings.paddingH} onChange={(v) => set("paddingH", v)} />
            <NumberRow label="Rand oben" unit="px" min={20} max={80}
              value={settings.paddingTop} onChange={(v) => set("paddingTop", v)} />
            <NumberRow label="Rand unten" unit="px" min={30} max={100}
              value={settings.paddingBottom} onChange={(v) => set("paddingBottom", v)} />
          </div>
        </div>

        {/* Logo */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Logo-Maße</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberRow label="Breite" unit="px" min={40} max={200}
              value={settings.logoWidth} onChange={(v) => set("logoWidth", v)} />
            <NumberRow label="Höhe" unit="px" min={20} max={100}
              value={settings.logoHeight} onChange={(v) => set("logoHeight", v)} />
          </div>
        </div>

        {/* Reset + Save */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSettings({ ...DEFAULT_PDF_SETTINGS, layouts: { ...DEFAULT_LAYOUTS } })}
            className="btn-secondary text-sm"
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            onClick={() => savePdf.mutate(settings as any)}
            disabled={savePdf.isPending}
            className="btn-primary"
          >
            {savePdf.isPending ? "Speichern…" : "Speichern"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle size={14} /> Gespeichert
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="card overflow-hidden sticky top-4">
        <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500 font-medium">
          Vorschau: {DOCUMENT_TYPE_LABELS[previewType]}
        </div>
        {instance.loading ? (
          <div className="h-[800px] flex items-center justify-center text-gray-400 text-sm">
            PDF wird generiert…
          </div>
        ) : instance.url ? (
          <object
            data={instance.url}
            type="application/pdf"
            className="w-full h-[800px]"
          >
            <div className="h-[800px] flex items-center justify-center text-gray-400 text-sm">
              PDF-Vorschau nicht verfügbar
            </div>
          </object>
        ) : (
          <div className="h-[800px] flex items-center justify-center text-gray-400 text-sm">
            Fehler beim Generieren der Vorschau
          </div>
        )}
      </div>
    </div>
  );
}

function ColorRow({ label, hint, value, onChange }: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-xs text-gray-400">{hint}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)}
          className="input w-24 font-mono text-xs"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function NumberRow({ label, unit, min, max, value, onChange }: {
  label: string; unit: string; min: number; max: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="label text-xs">{label} <span className="text-gray-400">({unit})</span></label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input"
      />
    </div>
  );
}
