import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useDocument, useFinalizeDocument, useDeleteDocument } from "@/api/hooks/useDocuments";
import { useTaxRates } from "@/api/hooks/useProducts";
import type {
  Document as HBDocument,
  DocumentLineItem,
  TaxRate,
  Customer,
  Product,
  PaginatedResponse,
  DocumentLayoutSettings,
} from "@honeybill/shared";
import {
  computeLineGross,
  computeLineNet,
  computeLineTax,
  formatEur,
  DOCUMENT_TYPE_LABELS,
  DEFAULT_LAYOUTS,
  Decimal,
} from "@honeybill/shared";
import { ArrowLeft, AlertCircle, CheckCircle, Plus, Save, Trash2, GripVertical, Search, FileText, Settings2 } from "lucide-react";
import { TypeBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import type { DocumentType, CompanySettings } from "@honeybill/shared";

// ─── Types ─────────────────────────────────────────────────────────────────

interface LineRow {
  key: string; // local only (for React key)
  id?: number;
  position: number;
  lineType: "ITEM" | "TEXT";
  productId: number | null;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  discountType: "pct" | "abs";
  taxRateId: number | null;
  // computed
  lineNet: string;
  lineTax: string;
  lineGross: string;
}

let _keyCounter = 0;
function newKey() {
  return `row-${++_keyCounter}`;
}

function toRow(li: DocumentLineItem, taxRates: TaxRate[]): LineRow {
  return {
    key: newKey(),
    id: li.id,
    position: li.position,
    lineType: li.lineType === "TEXT" ? "TEXT" : "ITEM",
    productId: li.productId ?? null,
    description: li.description,
    quantity: li.quantity,
    unit: li.unit,
    unitPrice: li.unitPrice,
    discountPct: li.discountPct,
    discountType: (li.discountType ?? "pct") as "pct" | "abs",
    taxRateId: li.taxRateId ?? null,
    lineNet: li.lineNet,
    lineTax: li.lineTax,
    lineGross: li.lineGross,
  };
}

function recompute(row: LineRow, taxRates: TaxRate[]): LineRow {
  if (row.lineType !== "ITEM") return { ...row, lineNet: "0.00", lineTax: "0.00", lineGross: "0.00" };
  const taxRate = taxRates.find((tr) => tr.id === row.taxRateId);
  const taxRatePct = taxRate?.ratePercent ?? "0.00";
  const lineNet = computeLineNet(row.quantity || "0", row.unitPrice || "0", row.discountPct || "0", row.discountType);
  const lineTax = computeLineTax(lineNet, taxRatePct);
  const lineGross = computeLineGross(lineNet, lineTax);
  return { ...row, lineNet, lineTax, lineGross };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DocumentEditorPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: doc, isLoading } = useDocument(Number(id));
  const { data: taxRates = [] } = useTaxRates();
  const finalize = useFinalizeDocument();
  const deleteDoc = useDeleteDocument();

  const [rows, setRows] = useState<LineRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const { data: company } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => api.get("/settings/company"),
  });

  // Doc-level fields
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentDays, setPaymentDays] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState("");
  const [einvoiceProfile, setEinvoiceProfile] = useState<string>("");
  const [globalDiscountPct, setGlobalDiscountPct] = useState("0.00");
  const [globalDiscountType, setGlobalDiscountType] = useState<"pct" | "abs">("pct");
  const [layoutOverride, setLayoutOverride] = useState<Partial<DocumentLayoutSettings> | null>(null);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);

  // Load doc into state once
  useEffect(() => {
    if (!doc) return;
    setRows((doc.lineItems ?? []).map((li) => toRow(li, taxRates)));
    setDeliveryDate(doc.deliveryDate ?? "");
    setPaymentDays(doc.paymentDays != null ? String(doc.paymentDays) : "");
    setInternalNotes(doc.internalNotes ?? "");
    setEinvoiceProfile(doc.einvoiceProfile ?? "");
    setGlobalDiscountPct(doc.globalDiscountPct ?? "0.00");
    setGlobalDiscountType((doc.globalDiscountType ?? "pct") as "pct" | "abs");
    const lo = (() => {
      const raw = (doc as any).layoutOverride;
      if (!raw) return null;
      if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
      return raw;
    })();
    setLayoutOverride(lo);
  }, [doc?.id]); // only on doc id change, not every render

  // Totals
  const rawSubtotalNet = rows
    .reduce((acc, r) => acc.plus(new Decimal(r.lineNet)), new Decimal(0));
  const rawTotalTax = rows
    .reduce((acc, r) => acc.plus(new Decimal(r.lineTax)), new Decimal(0));

  const rawTotalGross = rawSubtotalNet.plus(rawTotalTax);
  const gDiscount = new Decimal(globalDiscountPct || "0");
  const hasGlobalDiscount = gDiscount.greaterThan(0);
  let discountFactor: Decimal;
  let globalDiscountDisplay: Decimal; // amount shown as "discount" in sidebar
  if (globalDiscountType === "abs") {
    // abs discount reduces the gross directly
    const absAmt = Decimal.min(gDiscount, rawTotalGross);
    globalDiscountDisplay = absAmt;
    discountFactor = rawTotalGross.isZero() ? new Decimal(1) : rawTotalGross.minus(absAmt).div(rawTotalGross);
  } else {
    discountFactor = new Decimal(1).minus(gDiscount.div(100));
    globalDiscountDisplay = rawSubtotalNet.minus(rawSubtotalNet.mul(discountFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  const subtotalNet = rawSubtotalNet.mul(discountFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

  const taxGroups: Record<string, { net: Decimal; tax: Decimal; label: string }> = {};
  for (const r of rows) {
    if (r.lineType !== "ITEM" || !r.taxRateId) continue;
    const tr = taxRates.find((t) => t.id === r.taxRateId);
    const pct = tr?.ratePercent ?? "0.00";
    if (!taxGroups[pct]) taxGroups[pct] = { net: new Decimal(0), tax: new Decimal(0), label: `${pct}%` };
    taxGroups[pct]!.net = taxGroups[pct]!.net.plus(new Decimal(r.lineNet));
    taxGroups[pct]!.tax = taxGroups[pct]!.tax.plus(new Decimal(r.lineTax));
  }

  const totalTax = Object.values(taxGroups)
    .reduce((acc, g) => acc.plus(g.tax.mul(discountFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)), new Decimal(0))
    .toFixed(2);
  const totalGross = new Decimal(subtotalNet).plus(new Decimal(totalTax)).toFixed(2);

  // Row helpers
  const updateRow = (key: string, patch: Partial<LineRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, ...patch };
        return recompute(updated, taxRates);
      })
    );
    setDirty(true);
  };

  const addRow = (type: "ITEM" | "TEXT" = "ITEM") => {
    const defaultTaxRate = taxRates.find((tr) => tr.isDefault) ?? taxRates[0] ?? null;
    const newRow: LineRow = recompute(
      {
        key: newKey(),
        position: rows.length,
        lineType: type,
        productId: null,
        description: "",
        quantity: "1",
        unit: "Stk",
        unitPrice: "0.00",
        discountPct: "0.00",
        discountType: "pct",
        taxRateId: defaultTaxRate?.id ?? null,
        lineNet: "0.00",
        lineTax: "0.00",
        lineGross: "0.00",
      },
      taxRates
    );
    setRows((prev) => [...prev, newRow]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key).map((r, i) => ({ ...r, position: i })));
    setDirty(true);
  };

  const applyProduct = (key: string, product: Product) => {
    updateRow(key, {
      productId: product.id,
      description: product.name,
      unit: product.unit,
      unitPrice: product.unitPrice,
      taxRateId: product.taxRateId,
    });
  };

  // Save
  const save = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await api.put(`/documents/${doc.id}`, {
        deliveryDate: deliveryDate || null,
        paymentDays: paymentDays ? Number(paymentDays) : null,
        internalNotes: internalNotes || null,
        einvoiceProfile: einvoiceProfile || null,
        globalDiscountPct: globalDiscountPct || "0.00",
        globalDiscountType,
        layoutOverride: layoutOverride || null,
        lineItems: rows.map((r, i) => ({
          position: i,
          lineType: r.lineType,
          productId: r.productId,
          description: r.description,
          quantity: r.quantity,
          unit: r.unit,
          unitPrice: r.unitPrice,
          discountPct: r.discountPct,
          discountType: r.discountType,
          taxRateId: r.taxRateId,
        })),
      });
      qc.invalidateQueries({ queryKey: ["documents", doc.id] });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [doc, rows, deliveryDate, paymentDays, internalNotes, einvoiceProfile, globalDiscountPct, globalDiscountType, layoutOverride, qc]);

  const handleFinalize = async () => {
    setFinalizeError(null);
    await save();
    finalize.mutate(Number(id), {
      onSuccess: () => navigate({ to: "/documents/$id", params: { id: String(id) } }),
      onError: (e: any) => setFinalizeError(e?.message ?? "Fehler beim Finalisieren"),
    });
  };

  const handleDelete = () => {
    if (!confirm("Entwurf wirklich löschen?")) return;
    deleteDoc.mutate(Number(id), { onSuccess: () => navigate({ to: "/documents" }) });
  };

  if (isLoading || !doc) return <div className="p-6 text-gray-400">Laden…</div>;
  if (doc.status !== "DRAFT") {
    navigate({ to: "/documents/$id", params: { id: String(id) } });
    return null;
  }

  const customer = doc.customer as Customer | undefined;
  const customerName =
    customer?.companyName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "Unbekannter Kunde";

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/documents" })}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <TypeBadge type={doc.documentType as DocumentType} />
              <span className="text-sm font-medium text-gray-500">Entwurf</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-700 font-semibold">{customerName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {finalizeError && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> {finalizeError}
            </span>
          )}
          {dirty && !finalizeError && (
            <span className="text-xs text-honey-600 font-medium">Ungespeicherte Änderungen</span>
          )}
          <button onClick={handleDelete} className="btn-danger">
            <Trash2 size={14} /> Löschen
          </button>
          <button
            onClick={() => setShowPdf(true)}
            className="btn-secondary"
          >
            <FileText size={14} /> Vorschau
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-secondary"
          >
            <Save size={14} />
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <button
            onClick={handleFinalize}
            disabled={finalize.isPending || saving}
            className="btn-primary"
          >
            <CheckCircle size={14} />
            {finalize.isPending ? "Finalisieren…" : "Finalisieren"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-y-auto">
        {/* Main editor area */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">

          {/* Doc header fields */}
          <div className="card p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="label">Typ</label>
                <div className="py-2 text-gray-700 font-medium">
                  {DOCUMENT_TYPE_LABELS[doc.documentType as DocumentType]}
                </div>
              </div>
              <div>
                <label className="label">Kunde</label>
                <div className="py-2 text-gray-700">{customerName}</div>
              </div>
              <div>
                <label className="label">Lieferdatum</label>
                <input
                  type="date"
                  className="input"
                  value={deliveryDate}
                  onChange={(e) => { setDeliveryDate(e.target.value); setDirty(true); }}
                />
              </div>
              <div>
                <label className="label">Zahlungsziel (Tage)</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  placeholder="14"
                  value={paymentDays}
                  onChange={(e) => { setPaymentDays(e.target.value); setDirty(true); }}
                />
              </div>
              <div>
                <label className="label">E-Rechnung Profil</label>
                <select
                  className="input"
                  value={einvoiceProfile}
                  onChange={(e) => { setEinvoiceProfile(e.target.value); setDirty(true); }}
                >
                  <option value="">Kein E-Rechnung Export</option>
                  <option value="ZUGFERD_EXTENDED">ZUGFeRD 2.3 EXTENDED</option>
                  <option value="XRECHNUNG">XRechnung 3.0</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="label">Interne Notiz (wird nicht gedruckt)</label>
                <input
                  className="input"
                  value={internalNotes}
                  onChange={(e) => { setInternalNotes(e.target.value); setDirty(true); }}
                  placeholder="Interne Notizen…"
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-900">Positionen</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => addRow("TEXT")}
                  className="btn-secondary text-xs py-1"
                >
                  + Textzeile
                </button>
                <button
                  onClick={() => addRow("ITEM")}
                  className="btn-primary text-xs py-1"
                >
                  <Plus size={12} /> Position
                </button>
              </div>
            </div>

            {/* Table header */}
            <div className="grid text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2 bg-gray-50 border-b border-gray-100"
              style={{ gridTemplateColumns: "2rem 1fr 5rem 4rem 7rem 5rem 6rem 6rem 2rem" }}>
              <span></span>
              <span>Beschreibung</span>
              <span className="text-right">Menge</span>
              <span className="text-center">Einh.</span>
              <span className="text-right">Einzelpr. €</span>
              <span className="text-right">Rabatt %</span>
              <span>MwSt.</span>
              <span className="text-right">Netto €</span>
              <span></span>
            </div>

            {rows.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                Noch keine Positionen. Klicke "+ Position" um zu beginnen.
              </div>
            )}

            {rows.map((row, idx) => (
              <LineItemRow
                key={row.key}
                row={row}
                idx={idx}
                taxRates={taxRates}
                onChange={(patch) => updateRow(row.key, patch)}
                onRemove={() => removeRow(row.key)}
                onProductSelect={(p) => applyProduct(row.key, p)}
              />
            ))}

            {/* Add button at bottom */}
            {rows.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
                <button onClick={() => addRow("ITEM")} className="text-xs text-honey-600 hover:text-honey-700 font-medium flex items-center gap-1">
                  <Plus size={12} /> Position hinzufügen
                </button>
                <span className="text-gray-200">|</span>
                <button onClick={() => addRow("TEXT")} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Plus size={12} /> Textzeile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Totals sidebar */}
        <div className="w-64 shrink-0 p-4 space-y-4 border-l border-gray-200 bg-white overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900">Summen</h3>
          <div className="space-y-2 text-sm">
            {hasGlobalDiscount && (
              <div className="flex justify-between text-gray-400">
                <span>Zwischensumme</span>
                <span>{formatEur(rawSubtotalNet.toFixed(2))}</span>
              </div>
            )}
            {hasGlobalDiscount && (
              <div className="flex justify-between text-red-600">
                <span>Gesamtrabatt {globalDiscountType === "abs" ? `${globalDiscountPct} €` : `${globalDiscountPct}%`}</span>
                <span>-{formatEur(globalDiscountDisplay.toFixed(2))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Netto gesamt</span>
              <span className="font-medium">{formatEur(subtotalNet)}</span>
            </div>
            {Object.entries(taxGroups).map(([pct, g]) => (
              <div key={pct} className="flex justify-between text-gray-500">
                <span>MwSt. {pct}</span>
                <span>{formatEur(g.tax.mul(discountFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2))}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-honey-200">
              <span>Gesamt</span>
              <span className="text-honey-700">{formatEur(totalGross)}</span>
            </div>
          </div>

          {/* Global discount */}
          <div>
            <label className="label">Gesamtrabatt</label>
            <div className="flex gap-1">
              <input
                type="number"
                className="input text-sm flex-1 min-w-0"
                min={0}
                max={globalDiscountType === "pct" ? 100 : undefined}
                step={0.01}
                value={globalDiscountPct}
                onChange={(e) => { setGlobalDiscountPct(e.target.value); setDirty(true); }}
                placeholder="0.00"
              />
              <div className="flex rounded border border-gray-300 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => { setGlobalDiscountType("pct"); setDirty(true); }}
                  className={`px-2 py-1 ${globalDiscountType === "pct" ? "bg-honey-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >%</button>
                <button
                  type="button"
                  onClick={() => { setGlobalDiscountType("abs"); setDirty(true); }}
                  className={`px-2 py-1 ${globalDiscountType === "abs" ? "bg-honey-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >€</button>
              </div>
            </div>
          </div>

          {/* Layout override button */}
          <button
            onClick={() => setShowLayoutSettings(true)}
            className="btn-secondary w-full justify-center text-xs"
          >
            <Settings2 size={13} /> PDF-Layout anpassen
          </button>

          <div className="pt-2 space-y-2">
            <button onClick={save} disabled={saving} className="btn-secondary w-full justify-center text-sm">
              <Save size={13} /> {saving ? "…" : "Speichern"}
            </button>
            <button onClick={handleFinalize} disabled={finalize.isPending || saving} className="btn-primary w-full justify-center text-sm">
              <CheckCircle size={13} /> Finalisieren
            </button>
          </div>
        </div>
      </div>

      {/* Layout Override Modal */}
      {showLayoutSettings && (
        <LayoutOverrideModal
          docType={doc.documentType as DocumentType}
          override={layoutOverride}
          companyLayouts={company?.pdfSettings?.layouts ?? null}
          onSave={(lo) => { setLayoutOverride(lo); setDirty(true); setShowLayoutSettings(false); }}
          onClose={() => setShowLayoutSettings(false)}
        />
      )}

      {/* PDF Preview Modal */}
      {showPdf && company && (
        <Modal open={showPdf} onClose={() => setShowPdf(false)} title="Vorschau" size="full">
          <PdfPreview doc={doc} company={company} />
        </Modal>
      )}
    </div>
  );
}

// ─── Line Item Row ───────────────────────────────────────────────────────────

interface RowProps {
  row: LineRow;
  idx: number;
  taxRates: TaxRate[];
  onChange: (patch: Partial<LineRow>) => void;
  onRemove: () => void;
  onProductSelect: (p: Product) => void;
}

function LineItemRow({ row, idx, taxRates, onChange, onRemove, onProductSelect }: RowProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  if (row.lineType === "TEXT") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50 group"
      >
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <input
          className="flex-1 text-sm text-gray-600 italic bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5"
          placeholder="Textzeile eingeben…"
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative border-b border-gray-50 hover:bg-amber-50/20 group">
      <div
        className="grid items-start gap-1 px-3 py-2"
        style={{ gridTemplateColumns: "2rem 1fr 5rem 4rem 7rem 5rem 6rem 6rem 2rem" }}
      >
        <div className="flex items-center pt-1.5">
          <GripVertical size={14} className="text-gray-300" />
        </div>

        {/* Description + product search */}
        <div ref={descRef}>
          <div className="flex items-center gap-1">
            <input
              className="w-full text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5"
              placeholder="Beschreibung…"
              value={row.description}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
              onChange={(e) => onChange({ description: e.target.value })}
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowProductModal(true); }}
              className="text-gray-300 hover:text-honey-500 shrink-0"
              title="Alle Produkte durchsuchen"
            >
              <Search size={12} />
            </button>
          </div>
          {showAutocomplete && (
            <ProductAutocomplete
              query={row.description}
              anchorRef={descRef}
              onSelect={(p) => { onProductSelect(p); setShowAutocomplete(false); }}
            />
          )}
        </div>

        {/* Quantity */}
        <input
          className="text-sm text-right bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5"
          value={row.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          type="number"
          min="0"
          step="1"
        />

        {/* Unit */}
        <input
          className="text-sm text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5"
          value={row.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
        />

        {/* Unit price */}
        <input
          className="text-sm text-right bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5 font-mono"
          value={row.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value })}
          type="number"
          min="0"
          step="0.01"
        />

        {/* Discount + type toggle */}
        <div className="flex items-center gap-0.5">
          <input
            className="text-sm text-right bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5 w-12"
            value={row.discountPct}
            onChange={(e) => onChange({ discountPct: e.target.value })}
            type="number"
            min="0"
            max={row.discountType === "pct" ? 100 : undefined}
            step="0.01"
          />
          <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
            <button type="button"
              onClick={() => onChange({ discountType: "pct" })}
              className={`px-1 py-0.5 leading-none ${row.discountType === "pct" ? "bg-honey-400 text-white" : "text-gray-400 hover:bg-gray-50"}`}
            >%</button>
            <button type="button"
              onClick={() => onChange({ discountType: "abs" })}
              className={`px-1 py-0.5 leading-none ${row.discountType === "abs" ? "bg-honey-400 text-white" : "text-gray-400 hover:bg-gray-50"}`}
            >€</button>
          </div>
        </div>

        {/* Tax rate */}
        <select
          className="text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-honey-300 rounded px-1 py-0.5"
          value={row.taxRateId ?? ""}
          onChange={(e) =>
            onChange({ taxRateId: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">—</option>
          {taxRates.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.ratePercent}%
            </option>
          ))}
        </select>

        {/* Line net (computed, read-only) */}
        <div className="text-sm text-right font-medium pt-0.5 font-mono">
          {formatEur(row.lineNet)}
        </div>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 mt-0.5"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {showProductModal && (
        <ProductBrowserModal
          onSelect={(p) => { onProductSelect(p); setShowProductModal(false); }}
          onClose={() => setShowProductModal(false)}
        />
      )}
    </div>
  );
}

// ─── Layout Override Modal ──────────────────────────────────────────────────

const COLUMN_TOGGLES: { key: keyof DocumentLayoutSettings; label: string }[] = [
  { key: "colPositionNr", label: "Pos.-Nr." },
  { key: "colDate", label: "Datum" },
  { key: "colQuantity", label: "Menge" },
  { key: "colUnit", label: "Einheit" },
  { key: "colPrice", label: "Einzelpreis" },
  { key: "colDiscount", label: "Rabatt" },
  { key: "colTax", label: "USt. %" },
  { key: "colTaxAmount", label: "USt. Betrag" },
  { key: "colNetAmount", label: "Nettobetrag" },
  { key: "colGrossAmount", label: "Bruttobetrag" },
];

const SECTION_TOGGLES: { key: keyof DocumentLayoutSettings; label: string }[] = [
  { key: "showTotals", label: "Summenblock" },
  { key: "showPaymentInfo", label: "Zahlungsinfo" },
];

function LayoutOverrideModal({
  docType,
  override,
  companyLayouts,
  onSave,
  onClose,
}: {
  docType: DocumentType;
  override: Partial<DocumentLayoutSettings> | null;
  companyLayouts: Record<string, Partial<DocumentLayoutSettings>> | null;
  onSave: (lo: Partial<DocumentLayoutSettings> | null) => void;
  onClose: () => void;
}) {
  const globalLayout = {
    ...DEFAULT_LAYOUTS[docType],
    ...(companyLayouts?.[docType] ?? {}),
  } as DocumentLayoutSettings;

  const [local, setLocal] = useState<Partial<DocumentLayoutSettings>>(override ?? {});

  const merged = { ...globalLayout, ...local };

  const toggle = (key: keyof DocumentLayoutSettings) => {
    const current = merged[key];
    setLocal((prev) => ({ ...prev, [key]: !current }));
  };

  const setTotalDisplay = (mode: "gross" | "net" | "both") => {
    setLocal((prev) => ({ ...prev, totalDisplay: mode }));
  };

  const setClosingText = (text: string) => {
    setLocal((prev) => ({ ...prev, closingText: text }));
  };

  const handleReset = () => {
    setLocal({});
  };

  const handleSave = () => {
    const cleaned = Object.fromEntries(
      Object.entries(local).filter(([k, v]) => {
        const gVal = (globalLayout as any)[k];
        return v !== gVal;
      })
    ) as Partial<DocumentLayoutSettings>;
    onSave(Object.keys(cleaned).length > 0 ? cleaned : null);
  };

  const hasOverrides = Object.keys(local).some((k) => {
    return (local as any)[k] !== (globalLayout as any)[k];
  });

  return (
    <Modal open onClose={onClose} title="PDF-Layout für diesen Beleg" size="lg">
      <div className="space-y-5">
        {hasOverrides && (
          <div className="bg-honey-50 border border-honey-200 rounded-lg px-3 py-2 text-xs text-honey-700">
            Dieses Dokument hat individuelle Layout-Einstellungen, die von den globalen abweichen.
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Spalten</h4>
          <div className="grid grid-cols-2 gap-2">
            {COLUMN_TOGGLES.map(({ key, label }) => {
              const isOverridden = key in local;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50 ${isOverridden ? "bg-honey-50 border border-honey-200" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={merged[key] as boolean}
                    onChange={() => toggle(key)}
                    className="accent-honey-600"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Abschnitte</h4>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_TOGGLES.map(({ key, label }) => {
              const isOverridden = key in local;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50 ${isOverridden ? "bg-honey-50 border border-honey-200" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={merged[key] as boolean}
                    onChange={() => toggle(key)}
                    className="accent-honey-600"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Summenanzeige</h4>
          <div className="flex gap-3">
            {(["gross", "net", "both"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="totalDisplay"
                  checked={merged.totalDisplay === mode}
                  onChange={() => setTotalDisplay(mode)}
                  className="accent-honey-600"
                />
                {mode === "gross" ? "Brutto" : mode === "net" ? "Netto" : "Beides"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Schlusstext</h4>
          <textarea
            className="input text-sm"
            rows={2}
            value={merged.closingText}
            onChange={(e) => setClosingText(e.target.value)}
          />
        </div>

        <div className="flex justify-between pt-2 border-t border-gray-100">
          <button onClick={handleReset} className="btn-secondary text-xs">
            Auf global zurücksetzen
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">Abbrechen</button>
            <button onClick={handleSave} className="btn-primary text-sm">Übernehmen</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Product Autocomplete (fixed-position, no clipping) ──────────────────────

function ProductAutocomplete({
  query,
  anchorRef,
  onSelect,
}: {
  query: string;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (p: Product) => void;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setStyle({ position: "fixed", top: r.bottom + 2, left: r.left, width: Math.max(r.width, 260), zIndex: 9999 });
    }
  }, []);

  const { data } = useQuery<PaginatedResponse<Product>>({
    queryKey: ["products-autocomplete", query],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(query)}&limit=5`),
  });

  const items = data?.data ?? [];
  if (!items.length) return null;

  return (
    <div style={style} className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
      {items.map((p) => (
        <button
          key={p.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
          className="w-full text-left px-3 py-2 hover:bg-honey-50 transition-colors border-b border-gray-50 last:border-0"
        >
          <div className="text-sm font-medium text-gray-900">{p.name}</div>
          <div className="text-xs text-gray-400 flex gap-3">
            <span>{p.sku}</span>
            <span>{formatEur(p.unitPrice)} / {p.unit}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Product Browser Modal (opened by magnifier) ─────────────────────────────

function ProductBrowserModal({
  onSelect,
  onClose,
}: {
  onSelect: (p: Product) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery<PaginatedResponse<Product>>({
    queryKey: ["products-browser", q],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(q)}&limit=50`),
  });

  return (
    <Modal open onClose={onClose} title="Produkt auswählen" size="lg">
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <input
            autoFocus
            className="input"
            placeholder="Produkt suchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {(data?.data ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left px-3 py-2.5 hover:bg-honey-50 rounded-lg transition-colors border border-transparent hover:border-honey-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.sku} · {p.unit}</div>
                </div>
                <div className="text-sm font-semibold text-honey-700 font-mono">
                  {formatEur(p.unitPrice)}
                </div>
              </div>
            </button>
          ))}
          {data?.data.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">Keine Produkte gefunden</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
