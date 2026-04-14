import { useState } from "react";
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useTaxRates } from "@/api/hooks/useProducts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { formatEur } from "@honeybill/shared";

interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  unitPrice: string;
  taxRateId?: number | null;
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
                    {(p as any).taxRate ? `${(p as any).taxRate.ratePercent}%` : "—"}
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
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
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
          <input {...field("unitPrice")} type="number" step="0.01" min="0" required className="input" />
        </div>
        <div>
          <label className="label">Steuersatz *</label>
          <select {...field("taxRateId")} required className="input">
            <option value="">Wählen…</option>
            {(taxRates ?? []).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name} ({tr.ratePercent}%)
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
        initialValues={{ sku: "", name: "", description: "", unit: "Stk", unitPrice: "0.00", taxRateId: defaultTaxRateId }}
        onSubmit={(form) => create.mutate({ ...form, taxRateId: Number(form.taxRateId) }, { onSuccess: onClose })}
        isPending={create.isPending}
        onClose={onClose}
      />
    </Modal>
  );
}

function EditProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const update = useUpdateProduct(product.id);
  return (
    <Modal open onClose={onClose} title="Produkt bearbeiten">
      <ProductForm
        initialValues={{
          sku: product.sku,
          name: product.name,
          description: product.description ?? "",
          unit: product.unit,
          unitPrice: product.unitPrice,
          taxRateId: product.taxRateId ? String(product.taxRateId) : "",
        }}
        onSubmit={(form) => update.mutate({ ...form, taxRateId: Number(form.taxRateId) }, { onSuccess: onClose })}
        isPending={update.isPending}
        onClose={onClose}
      />
    </Modal>
  );
}
