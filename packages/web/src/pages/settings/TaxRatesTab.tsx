import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { TaxRate } from "@honeybill/shared";
import { useState } from "react";
import { Plus, Trash2, FileText, History } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { useCan } from "@/api/hooks/usePermissions";
import { Label } from "@/components/ui/Label";

const TAX_CATEGORIES = [
  { value: "S", label: "S – Normalsatz" },
  { value: "R", label: "R – Ermäßigt" },
  { value: "Z", label: "Z – Nullsatz" },
  { value: "E", label: "E – Steuerbefreit" },
  { value: "O", label: "O – Außerhalb Steuerbereich" },
];

export function TaxRatesTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { can } = useCan();
  const canEdit = can("settings.taxRates", "edit");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);

  const [showExpired, setShowExpired] = useState(false);
  const { data: allTaxRates, isLoading } = useQuery<TaxRate[]>({
    queryKey: ["tax-rates", "all"],
    queryFn: () => api.get("/tax-rates"),
  });
  const today = new Date().toISOString().slice(0, 10);
  const taxRates = (allTaxRates ?? []).filter((tr) => {
    if (showExpired) return true;
    return !tr.validTo || tr.validTo >= today;
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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
            />
            Abgelaufene anzeigen
          </label>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!canEdit}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Neuer Steuersatz
          </button>
        </div>
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
              {taxRates.map((tr) => {
                const inUse = (tr.usageProducts ?? 0) + (tr.usageLineItems ?? 0);
                const deleteBlockedReason = inUse > 0
                  ? `Kann nicht gelöscht werden – verwendet in ${tr.usageProducts ?? 0} Produkt(en) und ${tr.usageLineItems ?? 0} Rechnungsposition(en). GoBD-konform bleibt dieser Satz referenzierbar.`
                  : null;
                return (
                <tr key={tr.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-medium">{tr.name}</td>
                  <td className="table-cell text-right font-mono">{parseFloat(tr.ratePercent).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %</td>
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditing(tr)}
                        disabled={!canEdit}
                        className="text-gray-300 hover:text-honey-600 transition-colors p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={canEdit ? "Bearbeiten" : "Keine Schreibrechte"}
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={async () => { if (await confirm(`Steuersatz "${tr.name}" löschen?`, { title: "Steuersatz löschen", confirmLabel: "Löschen" })) deleteTaxRate.mutate(tr.id); }}
                        disabled={!!deleteBlockedReason || !canEdit}
                        className={
                          deleteBlockedReason || !canEdit
                            ? "text-gray-200 cursor-not-allowed p-1"
                            : "text-gray-300 hover:text-red-500 transition-colors p-1"
                        }
                        title={!canEdit ? "Keine Schreibrechte" : (deleteBlockedReason ?? "Löschen")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {!taxRates.length && (
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
      {editing && <CreateTaxRateModal open onClose={() => setEditing(null)} existing={editing} />}
    </div>
  );
}

// ─── Create Tax Rate Modal ────────────────────────────────────────────────────

function CreateTaxRateModal({ open, onClose, existing }: {
  open: boolean; onClose: () => void; existing?: TaxRate;
}) {
  const qc = useQueryClient();
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    taxCategory: existing?.taxCategory ?? "S",
    ratePercent: existing?.ratePercent ?? "19.00",
    validFrom: existing?.validFrom ?? today,
    validTo: existing?.validTo ?? "",
    isDefault: existing?.isDefault ?? false,
  });
  const [error, setError] = useState("");
  const [newPeriod, setNewPeriod] = useState({ ratePercent: "", validFrom: today });
  const [periodError, setPeriodError] = useState("");

  const { data: history, refetch: refetchHistory } = useQuery<TaxRate[]>({
    queryKey: ["tax-rates-history", existing?.name],
    queryFn: () => api.get(`/tax-rates?name=${encodeURIComponent(existing!.name)}`),
    enabled: isEdit,
  });

  const save = useMutation({
    mutationFn: () => {
      if (isEdit) {
        // PUT: nur Metadaten (name, taxCategory, isDefault) — nie ratePercent/validFrom/validTo
        return api.put(`/tax-rates/${existing!.id}`, {
          name: form.name,
          taxCategory: form.taxCategory,
          isDefault: form.isDefault,
        });
      }
      return api.post("/tax-rates", {
        name: form.name,
        ratePercent: form.ratePercent,
        taxCategory: form.taxCategory,
        validFrom: form.validFrom,
        validTo: form.validTo || null,
        isDefault: form.isDefault,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-rates"] });
      qc.invalidateQueries({ queryKey: ["tax-rates-history"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const addPeriod = useMutation({
    mutationFn: (data: { ratePercent: string; validFrom: string }) =>
      api.post(`/tax-rates/${existing!.id}/successor`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-rates"] });
      refetchHistory();
      setPeriodError("");
      setNewPeriod({ ratePercent: "", validFrom: today });
    },
    onError: (e: Error) => setPeriodError(e.message),
  });

  const deleteHistory = useMutation({
    mutationFn: (id: number) => api.delete(`/tax-rates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-rates"] });
      refetchHistory();
    },
  });

  const field = (key: keyof typeof form) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Steuersatz bearbeiten" : "Neuer Steuersatz"} size="xl">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label required>Bezeichnung</Label>
            <input {...field("name")} required className="input" placeholder="z. B. Normalsatz 19%" />
          </div>
          {/* Im Bearbeiten-Modus: Satz und Gültig-ab als Nur-Lesen anzeigen */}
          {isEdit ? (
            <>
              <div>
                <label className="label">Aktueller Satz</label>
                <p className="input bg-gray-50 text-gray-500 font-mono">
                  {parseFloat(existing!.ratePercent).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %
                  <span className="text-xs ml-2 text-gray-400">(per Neue Periode ändern)</span>
                </p>
              </div>
              <div>
                <Label required>Kategorie (EN 16931)</Label>
                <select {...field("taxCategory")} className="input">
                  {TAX_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label required>Steuersatz (%)</Label>
                <DecimalInput
                  value={String(form.ratePercent)}
                  onChange={(v) => setForm((f) => ({ ...f, ratePercent: v }))}
                  required
                  className="input font-mono"
                />
              </div>
              <div>
                <Label required>Kategorie (EN 16931)</Label>
                <select {...field("taxCategory")} className="input">
                  {TAX_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label required>Gültig ab</Label>
                <input {...field("validFrom")} required type="date" className="input" />
              </div>
              <div>
                <label className="label">Gültig bis (leer = unbegrenzt)</label>
                <input {...field("validTo")} type="date" className="input" />
              </div>
            </>
          )}
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
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>

      {/* Historie + Neue Periode – nur im Bearbeitungsmodus */}
      {isEdit && (
        <div className="mt-6 pt-5 border-t border-gray-100 space-y-4">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <History size={14} /> Gültigkeitshistorie
          </h4>

          <div className="overflow-hidden rounded border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="table-header">Satz</th>
                  <th className="table-header">Gültig ab</th>
                  <th className="table-header">Gültig bis</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).slice().reverse().map((h) => {
                  const isFuture = h.validFrom > today;
                  const isCurrent = h.id === existing?.id;
                  return (
                    <tr key={h.id} className={`border-b border-gray-50 ${isCurrent ? "bg-honey-50" : ""}`}>
                      <td className="table-cell font-mono font-medium">
                        {parseFloat(h.ratePercent).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %
                      </td>
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
                          onClick={() => deleteHistory.mutate(h.id)}
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

          {/* Neue Periode hinzufügen */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Neue Periode ab Datum</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Neuer Satz (%)</label>
                <DecimalInput
                  value={newPeriod.ratePercent}
                  onChange={(v) => setNewPeriod((p) => ({ ...p, ratePercent: v }))}
                  className="input font-mono"
                  placeholder="7,70"
                />
              </div>
              <div>
                <Label required>Gültig ab</Label>
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
              Der aktuelle Satz wird automatisch zum Vortag abgeschlossen.
            </div>
            <button
              type="button"
              disabled={!newPeriod.ratePercent || !newPeriod.validFrom || addPeriod.isPending}
              onClick={() => addPeriod.mutate(newPeriod)}
              className="btn-secondary text-sm"
            >
              <Plus size={13} />
              {addPeriod.isPending ? "Wird gespeichert…" : "Periode hinzufügen"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
