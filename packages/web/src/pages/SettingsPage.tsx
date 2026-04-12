import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CompanySettings, TaxRate, PdfSettings, EmailSettings, DocumentType, DocumentLayoutSettings } from "@honeybill/shared";
import {
  DEFAULT_PDF_SETTINGS, DEFAULT_LAYOUTS, UpdatePdfSettingsSchema, type UpdatePdfSettingsInput,
  DEFAULT_EMAIL_SETTINGS, UpdateEmailSettingsSchema, type UpdateEmailSettingsInput,
  EMAIL_PLACEHOLDERS, DOCUMENT_TYPE_LABELS,
} from "@honeybill/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateCompanySettingsSchema, type UpdateCompanySettingsInput } from "@honeybill/shared";
import { useEffect, useRef, useState, useMemo } from "react";
import { Building2, CheckCircle, Percent, Plus, Trash2, FileText, Mail, Send, Eye, EyeOff, Users, ShieldCheck, UserCog, BadgeCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { usePDF } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/InvoiceTemplate";
import type { Document as HBDocument, User, UserRole } from "@honeybill/shared";
import { CreateUserSchema, UpdateUserSchema } from "@honeybill/shared";

// ─── Main Page ────────────────────────────────────────────────────────────────

const TAB_LABELS = { company: "Firmendaten", taxrates: "Steuersätze", pdflayout: "PDF-Layout", email: "E-Mail", users: "Benutzer" } as const;
type Tab = keyof typeof TAB_LABELS;

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");

  const { data: me } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me"),
  });
  const isAdmin = me?.role === "admin";

  return (
    <div className={`p-6 space-y-4 ${tab === "pdflayout" ? "max-w-6xl" : "max-w-3xl"}`} style={{ minWidth: 0 }}>
      <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          if (t === "users" && !isAdmin) return null;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-honey-500 text-honey-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {tab === "company" && <CompanyTab />}
      {tab === "taxrates" && <TaxRatesTab />}
      {tab === "pdflayout" && <PdfLayoutTab />}
      {tab === "email" && <EmailTab />}
      {tab === "users" && isAdmin && <UsersTab currentUserId={me?.id ?? 0} />}
    </div>
  );
}

// ─── Company Tab ──────────────────────────────────────────────────────────────

function CompanyTab() {
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

  const { data: company, isLoading } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => api.get("/settings/company"),
  });

  const updateCompany = useMutation({
    mutationFn: (data: UpdateCompanySettingsInput) => api.put("/settings/company", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const uploadLogo = useMutation({
    mutationFn: (form: FormData) => api.postForm("/settings/company/logo", form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-settings"] }),
  });

  const { register, handleSubmit, reset } = useForm<UpdateCompanySettingsInput>({
    resolver: zodResolver(UpdateCompanySettingsSchema),
  });

  useEffect(() => {
    if (company) reset(company as UpdateCompanySettingsInput);
  }, [company, reset]);

  const logoRef = useRef<HTMLInputElement>(null);
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    uploadLogo.mutate(form);
  };

  if (isLoading) return <div className="py-8 text-center text-gray-400">Laden…</div>;

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Building2 size={16} /> Firmenlogo
        </h2>
        <div className="flex items-center gap-4">
          {company?.logoPath ? (
            <img src={`/uploads/${company.logoPath}`} alt="Logo" className="h-16 object-contain border rounded" />
          ) : (
            <div className="h-16 w-32 border-2 border-dashed border-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
              Kein Logo
            </div>
          )}
          <div>
            <button onClick={() => logoRef.current?.click()} className="btn-secondary text-xs">
              Logo hochladen
            </button>
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG (max. 2 MB)</p>
          </div>
        </div>
      </div>

      {/* Company form */}
      <form onSubmit={handleSubmit((data) => updateCompany.mutate(data))} className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Firmendaten</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Firmenname *</label>
            <input {...register("name")} required className="input" />
          </div>
          <div>
            <label className="label">Rechtsform</label>
            <input {...register("legalForm")} className="input" placeholder="GmbH, UG, GbR…" />
          </div>
          <div>
            <label className="label">Land (ISO)</label>
            <input {...register("country")} className="input" maxLength={2} placeholder="DE" />
          </div>
          <div className="col-span-2">
            <label className="label">Straße</label>
            <input {...register("street")} className="input" />
          </div>
          <div>
            <label className="label">PLZ</label>
            <input {...register("zip")} className="input" />
          </div>
          <div>
            <label className="label">Ort</label>
            <input {...register("city")} className="input" />
          </div>
          <div>
            <label className="label">E-Mail</label>
            <input {...register("email")} type="email" className="input" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input {...register("phone")} className="input" />
          </div>
          <div>
            <label className="label">Website</label>
            <input {...register("website")} type="url" className="input" placeholder="https://…" />
          </div>
          <div>
            <label className="label">USt-IdNr.</label>
            <input {...register("vatId")} className="input" placeholder="DE123456789" />
          </div>
          <div>
            <label className="label">Steuernummer</label>
            <input {...register("taxNumber")} className="input" />
          </div>
          <div>
            <label className="label">Zahlungsziel (Tage)</label>
            <input
              {...register("defaultPaymentDays", { valueAsNumber: true })}
              type="number"
              min={0}
              className="input"
            />
          </div>
        </div>

        <h3 className="font-medium text-gray-700 pt-2">Bankverbindung</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">IBAN</label>
            <input {...register("bankIban")} className="input font-mono" placeholder="DE12 3456 7890 …" />
          </div>
          <div>
            <label className="label">BIC</label>
            <input {...register("bankBic")} className="input font-mono" />
          </div>
          <div>
            <label className="label">Bank</label>
            <input {...register("bankName")} className="input" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={updateCompany.isPending} className="btn-primary">
            {updateCompany.isPending ? "Speichern…" : "Speichern"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle size={14} /> Gespeichert
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Mock document for PDF preview ───────────────────────────────────────────

const MOCK_NUMBER: Record<DocumentType, string> = {
  INVOICE: "RE-2026-00001", QUOTE: "ANG-2026-00001",
  DELIVERY_NOTE: "LS-2026-00001", CREDIT_NOTE: "GS-2026-00001",
};

function mockDoc(docType: DocumentType): HBDocument {
  return {
    id: 0, documentType: docType, documentNumber: MOCK_NUMBER[docType], status: "FINAL",
    customerId: 0, customerSnapshot: null, layoutOverride: null, globalDiscountPct: "0.00",
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
        unitPrice: "120.00", discountPct: "0.00", taxRateId: 1, taxRatePct: "19.00",
        lineNet: "960.00", lineTax: "182.40", lineGross: "1142.40", createdAt: "" },
      { id: 2, documentId: 0, position: 1, lineType: "ITEM", productId: null, productSnapshot: null,
        description: "Beratung & Konzeption", quantity: "4", unit: "Std",
        unitPrice: "150.00", discountPct: "10.00", taxRateId: 1, taxRatePct: "19.00",
        lineNet: "540.00", lineTax: "102.60", lineGross: "642.60", createdAt: "" },
      { id: 3, documentId: 0, position: 2, lineType: "ITEM", productId: null, productSnapshot: null,
        description: "Hosting (jährlich)", quantity: "1", unit: "Jahr",
        unitPrice: "180.67", discountPct: "0.00", taxRateId: 1, taxRatePct: "19.00",
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

function PdfLayoutTab() {
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

// ─── E-Mail Tab ───────────────────────────────────────────────────────────────

function EmailTab() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: company, isLoading } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => api.get("/settings/company"),
  });

  const [settings, setSettings] = useState<UpdateEmailSettingsInput>(() => ({
    ...DEFAULT_EMAIL_SETTINGS,
    smtp: DEFAULT_EMAIL_SETTINGS.smtp ?? null,
  }));

  useEffect(() => {
    if (company?.emailSettings) {
      setSettings({ ...DEFAULT_EMAIL_SETTINGS, ...company.emailSettings });
    } else if (company?.email) {
      setSettings((s) => ({
        ...s,
        smtp: s.smtp ? s.smtp : { host: "", port: 587, secure: false, user: "", password: "", fromName: company.name ?? "", fromAddress: company.email ?? "" },
      }));
    }
  }, [company]);

  const saveEmail = useMutation({
    mutationFn: (data: UpdateEmailSettingsInput) => api.put("/settings/company/email", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleTest = async () => {
    if (!testEmail) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      await api.post("/settings/company/email/test", { to: testEmail });
      setTestResult({ ok: true });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  const setSmtp = <K extends keyof NonNullable<UpdateEmailSettingsInput["smtp"]>>(
    key: K,
    val: NonNullable<UpdateEmailSettingsInput["smtp"]>[K]
  ) => setSettings((s) => ({ ...s, smtp: { ...(s.smtp ?? { host: "", port: 587, secure: false, user: "", password: "", fromName: "", fromAddress: "" }), [key]: val } }));



  if (isLoading) return <div className="py-8 text-center text-gray-400">Laden…</div>;

  return (
    <div className="space-y-4">
      {/* Provider selection */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Mail size={16} /> Versandmethode
        </h2>
        <div className="flex gap-4">
          {(["smtp", "outlook"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value={p}
                checked={settings.provider === p}
                onChange={() => setSettings((s) => ({ ...s, provider: p }))}
              />
              <span className="text-sm font-medium">
                {p === "smtp" ? "SMTP (eigener Mailserver)" : "Outlook / Standard-E-Mail-Client"}
              </span>
            </label>
          ))}
        </div>
        {settings.provider === "outlook" && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Im Outlook-Modus wird beim Versand ein <code>mailto:</code>-Link geöffnet.
            Das PDF muss manuell als Anhang hinzugefügt werden.
          </p>
        )}
      </div>

      {/* SMTP config */}
      {settings.provider === "smtp" && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">SMTP-Konfiguration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-[1fr_120px_auto] gap-3 items-end">
              <div>
                <label className="label">Postausgangsserver (Host)</label>
                <input value={settings.smtp?.host ?? ""} onChange={(e) => setSmtp("host", e.target.value)} className="input" placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="label">Port</label>
                <input type="number" value={settings.smtp?.port ?? 587} onChange={(e) => setSmtp("port", Number(e.target.value))} className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                <input type="checkbox" checked={settings.smtp?.secure ?? false} onChange={(e) => setSmtp("secure", e.target.checked)} />
                SSL/TLS
              </label>
            </div>
            <div>
              <label className="label">Benutzername / E-Mail</label>
              <input value={settings.smtp?.user ?? ""} onChange={(e) => setSmtp("user", e.target.value)} className="input" autoComplete="username" />
            </div>
            <div>
              <label className="label">Passwort</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={settings.smtp?.password ?? ""}
                  onChange={(e) => setSmtp("password", e.target.value)}
                  className="input pr-9"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Absendername</label>
              <input value={settings.smtp?.fromName ?? ""} onChange={(e) => setSmtp("fromName", e.target.value)} className="input" placeholder="Meine Firma GmbH" />
            </div>
            <div>
              <label className="label">Absender-E-Mail</label>
              <input type="email" value={settings.smtp?.fromAddress ?? ""} onChange={(e) => setSmtp("fromAddress", e.target.value)} className="input" />
            </div>
          </div>

          {/* Test */}
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Testempfänger eingeben…"
              className="input max-w-xs"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testLoading || !testEmail}
              className="btn-secondary text-sm"
            >
              <Send size={14} /> {testLoading ? "Sende…" : "Test-E-Mail"}
            </button>
            {testResult && (
              <span className={`text-sm flex items-center gap-1 ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                {testResult.ok ? <><CheckCircle size={14} /> Erfolgreich gesendet</> : <>Fehler: {testResult.message}</>}
              </span>
            )}
          </div>
        </div>
      )}

      {/* E-Mail-Vorlagen */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Vorlagen</h2>
        <div className="flex gap-6">
          {/* Fields */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="label">Standard-Betreff</label>
              <input
                value={settings.defaultSubject}
                onChange={(e) => setSettings((s) => ({ ...s, defaultSubject: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Standard-E-Mail-Text</label>
              <textarea
                rows={10}
                value={settings.defaultBody}
                onChange={(e) => setSettings((s) => ({ ...s, defaultBody: e.target.value }))}
                className="input font-mono text-xs w-full resize-y"
              />
            </div>
          </div>
          {/* Placeholder sidebar */}
          <div className="w-56 shrink-0 border-l border-gray-100 pl-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Platzhalter</p>
            <div className="space-y-2">
              {EMAIL_PLACEHOLDERS.map((p) => (
                <div key={p.key}>
                  <span className="font-mono text-xs text-gray-700 block leading-tight">{p.key}</span>
                  <span className="text-xs text-gray-400">{p.example}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => saveEmail.mutate({ ...settings, smtp: settings.provider === "outlook" ? null : settings.smtp })} disabled={saveEmail.isPending} className="btn-primary">
          {saveEmail.isPending ? "Speichern…" : "Speichern"}
        </button>
        {saved && <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Gespeichert</span>}
        {saveEmail.isError && <span className="text-red-600 text-sm">{(saveEmail.error as Error)?.message}</span>}
      </div>
    </div>
  );
}

// ─── Tax Rates Tab ────────────────────────────────────────────────────────────

const TAX_CATEGORIES = [
  { value: "S", label: "S – Normalsatz" },
  { value: "R", label: "R – Ermäßigt" },
  { value: "Z", label: "Z – Nullsatz" },
  { value: "E", label: "E – Steuerbefreit" },
  { value: "O", label: "O – Außerhalb Steuerbereich" },
];

function TaxRatesTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: taxRates, isLoading } = useQuery<TaxRate[]>({
    queryKey: ["tax-rates"],
    queryFn: () => api.get("/tax-rates"),
  });

  const deleteTaxRate = useMutation({
    mutationFn: (id: number) => api.delete(`/tax-rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-rates"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Steuersätze mit Gültigkeitszeiträumen für korrekte historische Rückrechnung.
        </p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={14} /> Neuer Steuersatz
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Name</th>
                <th className="table-header text-right">Satz</th>
                <th className="table-header">Kategorie</th>
                <th className="table-header">Gültig ab</th>
                <th className="table-header">Gültig bis</th>
                <th className="table-header">Standard</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {(taxRates ?? []).map((tr) => (
                <tr key={tr.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-medium">{tr.name}</td>
                  <td className="table-cell text-right font-mono">{tr.ratePercent} %</td>
                  <td className="table-cell text-gray-500 text-xs">{tr.taxCategory}</td>
                  <td className="table-cell text-gray-500 text-xs">{tr.validFrom}</td>
                  <td className="table-cell text-gray-500 text-xs">{tr.validTo ?? "—"}</td>
                  <td className="table-cell">
                    {tr.isDefault && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-honey-100 text-honey-700">
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => deleteTaxRate.mutate(tr.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!(taxRates ?? []).length && (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-400 py-8">
                    Keine Steuersätze vorhanden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <CreateTaxRateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

// ─── Create Tax Rate Modal ────────────────────────────────────────────────────

interface TaxRateForm {
  name: string;
  ratePercent: string;
  taxCategory: string;
  validFrom: string;
  validTo: string;
  isDefault: boolean;
}

function CreateTaxRateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TaxRateForm>({
    name: "",
    ratePercent: "19.00",
    taxCategory: "S",
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: "",
    isDefault: false,
  });
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: (data: TaxRateForm) =>
      api.post("/tax-rates", {
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-rates"] });
      onClose();
      setForm({ name: "", ratePercent: "19.00", taxCategory: "S", validFrom: new Date().toISOString().slice(0, 10), validTo: "", isDefault: false });
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const field = (key: keyof TaxRateForm) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Modal open={open} onClose={onClose} title="Neuer Steuersatz">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Bezeichnung *</label>
            <input {...field("name")} required className="input" placeholder="z. B. Normalsatz 19%" />
          </div>
          <div>
            <label className="label">Steuersatz (%) *</label>
            <input
              {...field("ratePercent")}
              required
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input font-mono"
            />
          </div>
          <div>
            <label className="label">Kategorie (EN 16931) *</label>
            <select {...field("taxCategory")} className="input">
              {TAX_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Gültig ab *</label>
            <input {...field("validFrom")} required type="date" className="input" />
          </div>
          <div>
            <label className="label">Gültig bis (leer = unbegrenzt)</label>
            <input {...field("validTo")} type="date" className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            className="rounded"
          />
          Als Standard-Steuersatz verwenden
        </label>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={create.isPending} className="btn-primary">
            <Percent size={14} />
            {create.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  accountant: "Buchhalter",
  viewer: "Betrachter",
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <ShieldCheck size={13} className="text-red-500" />,
  accountant: <UserCog size={13} className="text-honey-600" />,
  viewer: <BadgeCheck size={13} className="text-gray-400" />,
};

function UsersTab({ currentUserId }: { currentUserId: number }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data: userList = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const reactivate = useMutation({
    mutationFn: (id: number) => api.put(`/users/${id}`, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Benutzer</h2>
          <p className="text-xs text-gray-400 mt-0.5">Zugänge verwalten und Rollen vergeben</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus size={14} /> Benutzer hinzufügen
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name / E-Mail</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rolle</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Letzter Login</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {userList.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.fullName}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {ROLE_ICONS[u.role as UserRole]}
                    {ROLE_LABELS[u.role as UserRole]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {u.isActive ? "Aktiv" : "Deaktiviert"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("de-DE") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing(u)}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      Bearbeiten
                    </button>
                    {u.id !== currentUserId && (
                      u.isActive ? (
                        <button
                          onClick={() => { if (confirm(`${u.fullName} deaktivieren?`)) deactivate.mutate(u.id); }}
                          className="btn-danger text-xs py-1 px-2"
                        >
                          Deaktivieren
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivate.mutate(u.id)}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          Reaktivieren
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <UserFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); }}
        />
      )}
      {editing && (
        <UserFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["users"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user?: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email ?? "",
    fullName: user?.fullName ?? "",
    role: (user?.role ?? "viewer") as UserRole,
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEdit || form.password) {
      if (form.password !== form.passwordConfirm) {
        setError("Passwörter stimmen nicht überein");
        return;
      }
      if (form.password.length < 8) {
        setError("Passwort muss mindestens 8 Zeichen haben");
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit) {
        const patch: Record<string, unknown> = {
          email: form.email,
          fullName: form.fullName,
          role: form.role,
        };
        if (form.password) patch.password = form.password;
        await api.put(`/users/${user.id}`, patch);
      } else {
        await api.post("/users", {
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          password: form.password,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Benutzer bearbeiten" : "Benutzer hinzufügen"} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">E-Mail-Adresse</label>
          <input
            className="input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Rolle</label>
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
            <option value="viewer">Betrachter</option>
            <option value="accountant">Buchhalter</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div>
          <label className="label">{isEdit ? "Neues Passwort (leer = unverändert)" : "Passwort"}</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPw ? "text" : "password"}
              required={!isEdit}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? "Leer lassen für keine Änderung" : ""}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {(!isEdit || form.password) && (
          <div>
            <label className="label">Passwort bestätigen</label>
            <input
              className="input"
              type={showPw ? "text" : "password"}
              required={!isEdit}
              value={form.passwordConfirm}
              onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
            />
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary">
            <Users size={14} />
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
