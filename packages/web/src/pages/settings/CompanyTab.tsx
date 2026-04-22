import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CompanySettings } from "@honeybill/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateCompanySettingsSchema, type UpdateCompanySettingsInput } from "@honeybill/shared";
import { useEffect, useRef, useState } from "react";
import { Building2, CheckCircle } from "lucide-react";
import { useCan } from "@/api/hooks/usePermissions";
import { Label } from "@/components/ui/Label";

export function CompanyTab() {
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();
  const { can } = useCan();
  const canEdit = can("settings.company", "edit");

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
            <button
              onClick={() => logoRef.current?.click()}
              disabled={!canEdit}
              className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
        <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label required>Firmenname</Label>
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
        </fieldset>
      </form>
    </div>
  );
}
