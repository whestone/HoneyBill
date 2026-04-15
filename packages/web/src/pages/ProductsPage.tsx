import { useState } from "react";
import { Plus, Package, Pencil, Trash2, History } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useProducts, useCreateProduct, useDeleteProduct, useTaxRates } from "@/api/hooks/useProducts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { formatEur, formatDecimalGerman, germanToApiDecimal } from "@honeybill/shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  unitPrice: string;
  taxRateId?: number | null;
  taxRate?: { id: number; name: string; ratePercent: string } | null;
}

interface PriceHistoryEntry {
  id: number;
  productId: number;
  unitPrice: string;
  validFrom: string;
  validTo: string | null;
}

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const { data, isLoading } = useProducts({ page: String(page) });
  const deleteProduct = useDeleteProduct();
  const confirm = useConfirm();

  const handleDelete = async (p: Product) => {
    if (!await confirm(`Produkt "${p.name}" wirklich löschen?`, { title: "Produkt löschen" })) return;
    deleteProduct.mutate(p.id);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produkte</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Neues Produkt
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={Package}
            title="Keine Produkte vorhanden"
            description="Erstelle dein erstes Produkt oder importiere aus CSV."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">SKU</th>
                <th className="table-header">Name</th>
                <th className="table-header">Einheit</th>
                <th className="table-header text-right">Preis (netto)</th>
                <th className="table-header text-right">MwSt.</th>
                <th className="table-header w-20"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs">{p.sku}</td>
                  <td className="table-cell font-medium">{p.name}</td>
                  <td className="table-cell text-gray-500">{p.unit}</td>
                  <td className="table-cell text-right">{formatEur(p.unitPrice)}</td>
                  <td className="table-cell text-right text-gray-500">
                    {(p as any).taxRate
                      ? `${parseFloat((p as any).taxRate.ratePercent).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`
                      : "—"}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditProduct(p as Product)}
                        className="p-1 text-gray-400 hover:text-honey-600 rounded"
                        title="Bearbeiten"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(p as Product)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />}

      <CreateProductModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
        />
      )}
    </div>
  );
}

// ─── Product Form (Neu) ───────────────────────────────────────────────────────

function ProductForm({
  initialValues,
  onSubmit,
  isPending,
  onClose,
}: {
  initialValues: { sku: string; name: string; description: string; unit: string; unitPrice: string; taxRateId: string };
  onSubmit: (form: typeof initialValues) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const { data: taxRates } = useTaxRates();
  const [form, setForm] = useState(initialValues);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, unitPrice: germanToApiDecimal(form.unitPrice) }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">SKU *</label>
          <input {...field("sku")} required className="input" placeholder="DIENSTL-001" />
        </div>
        <div>
          <label className="label">Name *</label>
          <input {...field("name")} required className="input" />
        </div>
        <div>
          <label className="label">Einheit</label>
          <input {...field("unit")} className="input" placeholder="Stk, Std, kg…" />
        </div>
        <div>
          <label className="label">Preis (netto, €) *</label>
          <input
            {...field("unitPrice")}
            type="text"
            inputMode="decimal"
            required
            className="input font-mono"
            placeholder="0,00"
            onBlur={(e) => setForm((f) => ({ ...f, unitPrice: formatDecimalGerman(e.target.value) }))}
          />
        </div>
        <div>
          <label className="label">Steuersatz *</label>
          <select {...field("taxRateId")} required className="input">
            <option value="">Wählen…</option>
            {(taxRates ?? []).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name} ({parseFloat(tr.ratePercent).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %)
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Beschreibung</label>
        <textarea {...field("description")} className="input" rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

function CreateProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateProduct();
  const { data: taxRates } = useTaxRates();
  const defaultTaxRateId = String(taxRates?.find((t) => t.isDefault)?.id ?? "");
  return (
    <Modal open={open} onClose={onClose} title="Neues Produkt">
      <ProductForm
        initialValues={{ sku: "", name: "", description: "", unit: "Stk", unitPrice: "0,00", taxRateId: defaultTaxRateId }}
        onSubmit={(form) => create.mutate({ ...form, taxRateId: Number(form.taxRateId) }, { onSuccess: onClose })}
        isPending={create.isPending}
        onClose={onClose}
      />
    </Modal>
  );
}

// ─── Edit Modal mit Preishistorie ─────────────────────────────────────────────

function EditProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: taxRates } = useTaxRates();
  const [form, setForm] = useState({
    sku: product.sku,
    name: product.name,
    description: product.description ?? "",
    unit: product.unit,
    taxRateId: product.taxRateId ? String(product.taxRateId) : "",
  });
  const [currentPrice, setCurrentPrice] = useState(product.unitPrice);
  const [newPeriod, setNewPeriod] = useState({ unitPrice: "", validFrom: today });
  const [periodError, setPeriodError] = useState("");

  const { data: history, refetch: refetchHistory } = useQuery<PriceHistoryEntry[]>({
    queryKey: ["product-price-history", product.id],
    queryFn: () => api.get(`/products/${product.id}/price-history`),
  });

  const save = useMutation({
    mutationFn: () => api.put(`/products/${product.id}`, {
      sku: form.sku,
      name: form.name,
      description: form.description,
      unit: form.unit,
      taxRateId: Number(form.taxRateId),
      unitPrice: currentPrice, // Preis nicht über diesen Pfad ändern
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  const addPeriod = useMutation({
    mutationFn: (data: { unitPrice: string; validFrom: string }) =>
      api.post(`/products/${product.id}/price-history/successor`, data),
    onSuccess: (_result, vars) => {
      if (vars.validFrom <= today) setCurrentPrice(vars.unitPrice);
      qc.invalidateQueries({ queryKey: ["products"] });
      refetchHistory();
      setPeriodError("");
      setNewPeriod({ unitPrice: "", validFrom: today });
    },
    onError: (e: Error) => setPeriodError(e.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (hid: number) => api.delete(`/products/price-history/${hid}`),
    onSuccess: () => refetchHistory(),
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Modal open onClose={onClose} title="Produkt bearbeiten" size="xl">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SKU *</label>
            <input {...field("sku")} required className="input" />
          </div>
          <div>
            <label className="label">Name *</label>
            <input {...field("name")} required className="input" />
          </div>
          <div>
            <label className="label">Einheit</label>
            <input {...field("unit")} className="input" />
          </div>
          <div>
            <label className="label">Aktueller Preis (netto)</label>
            <p className="input bg-gray-50 text-gray-500">
              {formatEur(currentPrice)}
              <span className="text-xs ml-2 text-gray-400">(per Neue Periode ändern)</span>
            </p>
          </div>
          <div>
            <label className="label">Steuersatz *</label>
            <select {...field("taxRateId")} required className="input">
              <option value="">Wählen…</option>
              {(taxRates ?? []).map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} ({parseFloat(tr.ratePercent).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Beschreibung</label>
          <textarea {...field("description")} className="input" rows={2} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>

      {/* Preishistorie */}
      <div className="mt-6 pt-5 border-t border-gray-100 space-y-4">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <History size={14} /> Preishistorie
        </h4>

        <div className="overflow-hidden rounded border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="table-header">Preis (netto)</th>
                <th className="table-header">Gültig ab</th>
                <th className="table-header">Gültig bis</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).slice().reverse().map((h) => {
                const isFuture = h.validFrom > today;
                const isActive = !h.validTo && !isFuture;
                return (
                  <tr key={h.id} className={`border-b border-gray-50 ${isActive ? "bg-honey-50" : ""}`}>
                    <td className="table-cell font-mono font-medium">{formatEur(h.unitPrice)}</td>
                    <td className="table-cell text-gray-500">{h.validFrom}</td>
                    <td className="table-cell text-gray-500">
                      {h.validTo
                        ? h.validTo
                        : isFuture
                          ? <span className="text-blue-500 font-medium">geplant</span>
                          : <span className="text-green-600 font-medium">aktiv</span>
                      }
                    </td>
                    <td className="table-cell">
                      <button
                        type="button"
                        onClick={() => deleteEntry.mutate(h.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Eintrag löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!history?.length && (
                <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-4">Keine Einträge</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Neue Preisperiode ab Datum</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Neuer Preis (netto, €)</label>
              <input
                type="text"
                inputMode="decimal"
                value={newPeriod.unitPrice}
                onChange={(e) => setNewPeriod((p) => ({ ...p, unitPrice: e.target.value }))}
                onBlur={(e) => setNewPeriod((p) => ({ ...p, unitPrice: formatDecimalGerman(e.target.value) }))}
                className="input font-mono"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="label">Gültig ab *</label>
              <input
                type="date"
                value={newPeriod.validFrom}
                onChange={(e) => setNewPeriod((p) => ({ ...p, validFrom: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          {periodError && <p className="text-red-500 text-xs">{periodError}</p>}
          <div className="text-xs text-gray-400">
            Der aktuelle Preis wird automatisch zum Vortag abgeschlossen.
          </div>
          <button
            type="button"
            disabled={!newPeriod.unitPrice || !newPeriod.validFrom || addPeriod.isPending}
            onClick={() => addPeriod.mutate({ ...newPeriod, unitPrice: germanToApiDecimal(newPeriod.unitPrice) })}
            className="btn-secondary text-sm"
          >
            <Plus size={13} />
            {addPeriod.isPending ? "Wird gespeichert…" : "Periode hinzufügen"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
