import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CompanySettings, TaxRate } from "@honeybill/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateCompanySettingsSchema, type UpdateCompanySettingsInput } from "@honeybill/shared";
import { useEffect, useRef, useState } from "react";
import { Building2, CheckCircle, Percent, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [tab, setTab] = useState<"company" | "taxrates">("company");

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["company", "taxrates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-honey-500 text-honey-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "company" ? "Firmendaten" : "Steuersätze"}
          </button>
        ))}
      </div>

      {tab === "company" && <CompanyTab />}
      {tab === "taxrates" && <TaxRatesTab />}
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
