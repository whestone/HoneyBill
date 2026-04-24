import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useCustomer, useUpdateCustomer, useDeleteCustomer } from "@/api/hooks/useCustomers";
import { useDocuments } from "@/api/hooks/useDocuments";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateCustomerSchema, type CreateCustomerInput, formatEur, DOCUMENT_TYPE_LABELS } from "@honeybill/shared";
import { Archive, ArchiveRestore, ArrowLeft, Building2, CheckCircle, FileText, User } from "lucide-react";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import type { DocumentType } from "@honeybill/shared";
import { useCan } from "@/api/hooks/usePermissions";
import { Label } from "@/components/ui/Label";
import { EmailInput, PhoneInput } from "@/components/ui/InputWithAction";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export function CustomerDetailPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const customerId = Number(id);
  const { can } = useCan();
  const canEdit = can("customers", "edit");

  const { data: customer, isLoading } = useCustomer(customerId);
  const update = useUpdateCustomer(customerId);
  const del = useDeleteCustomer();
  const confirm = useConfirm();

  const { data: docsData } = useDocuments({ customer: String(customerId), limit: "50" });

  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"details" | "documents">("details");

  const { register, handleSubmit, reset } = useForm<CreateCustomerInput>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: { billCountry: "DE", paymentDays: 14, taxExempt: false, reverseCharge: false },
  });

  useEffect(() => {
    if (customer) {
      reset({
        companyName: customer.companyName ?? undefined,
        salutation: customer.salutation ?? undefined,
        firstName: customer.firstName ?? undefined,
        lastName: customer.lastName ?? undefined,
        email: customer.email ?? undefined,
        phone: customer.phone ?? undefined,
        billStreet: customer.billStreet ?? undefined,
        billZip: customer.billZip ?? undefined,
        billCity: customer.billCity ?? undefined,
        billCountry: customer.billCountry,
        shipStreet: customer.shipStreet ?? undefined,
        shipZip: customer.shipZip ?? undefined,
        shipCity: customer.shipCity ?? undefined,
        shipCountry: customer.shipCountry ?? undefined,
        vatId: customer.vatId ?? undefined,
        taxExempt: customer.taxExempt,
        reverseCharge: customer.reverseCharge,
        paymentDays: customer.paymentDays,
        leitwegId: customer.leitwegId ?? undefined,
        notes: customer.notes ?? undefined,
      } as CreateCustomerInput);
    }
  }, [customer?.id, reset]);

  const onSubmit = (data: CreateCustomerInput) => {
    update.mutate(data, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  };

  if (isLoading || !customer) {
    return <div className="p-6 text-gray-400">Laden…</div>;
  }

  const displayName =
    customer.companyName ||
    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
    "—";

  const docs = docsData?.data ?? [];

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/customers" })}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-400 font-mono">{customer.customerNumber}</p>
        </div>
        {customer.isArchived && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-500">
            Archiviert
          </span>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <FileText size={20} className="text-honey-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{docs.length}</div>
            <div className="text-xs text-gray-500">Belege gesamt</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <Building2 size={20} className="text-honey-500" />
          <div>
            <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
              {customer.billCity ?? "—"}
            </div>
            <div className="text-xs text-gray-500">Stadt</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <User size={20} className="text-honey-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{customer.paymentDays} Tage</div>
            <div className="text-xs text-gray-500">Zahlungsziel</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["details", "documents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-honey-500 text-honey-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "details" ? "Kundendaten" : `Belege (${docs.length})`}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === "details" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-60">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Allgemein</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Firmenname</Label>
                <input {...register("companyName")} className="input" placeholder="Muster GmbH" />
              </div>
              <div>
                <Label>Anrede</Label>
                <select {...register("salutation")} className="input">
                  <option value="">—</option>
                  <option>Herr</option>
                  <option>Frau</option>
                  <option>Divers</option>
                </select>
              </div>
              <div>
                <Label>Vorname</Label>
                <input {...register("firstName")} className="input" />
              </div>
              <div>
                <Label>Nachname</Label>
                <input {...register("lastName")} className="input" />
              </div>
              <div>
                <Label>E-Mail</Label>
                <EmailInput {...register("email")} />
              </div>
              <div>
                <Label>Telefon</Label>
                <PhoneInput {...register("phone")} />
              </div>
              <div>
                <Label>USt-IdNr.</Label>
                <input {...register("vatId")} className="input" placeholder="DE123456789" />
              </div>
              <div>
                <Label>Zahlungsziel (Tage)</Label>
                <input
                  {...register("paymentDays", { valueAsNumber: true })}
                  type="number"
                  className="input"
                  min={0}
                />
              </div>
              <div>
                <Label>Leitweg-ID (XRechnung)</Label>
                <input {...register("leitwegId")} className="input" placeholder="04011000-…" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input {...register("reverseCharge")} type="checkbox" className="rounded" />
                Reverse Charge
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input {...register("taxExempt")} type="checkbox" className="rounded" />
                Steuerbefreit
              </label>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Rechnungsadresse</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Straße</Label>
                <input {...register("billStreet")} className="input" />
              </div>
              <div>
                <Label>PLZ</Label>
                <input {...register("billZip")} className="input" />
              </div>
              <div>
                <Label>Ort</Label>
                <input {...register("billCity")} className="input" />
              </div>
              <div>
                <Label required>Land (ISO)</Label>
                <input {...register("billCountry")} className="input" maxLength={2} placeholder="DE" />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Lieferadresse (optional)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Straße</Label>
                <input {...register("shipStreet")} className="input" />
              </div>
              <div>
                <Label>PLZ</Label>
                <input {...register("shipZip")} className="input" />
              </div>
              <div>
                <Label>Ort</Label>
                <input {...register("shipCity")} className="input" />
              </div>
              <div>
                <Label>Land (ISO)</Label>
                <input {...register("shipCountry")} className="input" maxLength={2} />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Notizen</h2>
            <textarea
              {...register("notes")}
              className="input h-24 resize-none"
              placeholder="Interne Notizen zum Kunden…"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="submit" disabled={update.isPending} className="btn-primary">
                {update.isPending ? "Speichern…" : "Speichern"}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle size={14} /> Gespeichert
                </span>
              )}
            </div>
            {customer.isArchived ? (
              <button
                type="button"
                disabled={!canEdit || update.isPending}
                onClick={() => update.mutate({ isArchived: false })}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={canEdit ? "Archivierung aufheben" : "Keine Schreibrechte"}
              >
                <ArchiveRestore size={14} /> Reaktivieren
              </button>
            ) : (
              <button
                type="button"
                disabled={!canEdit || del.isPending}
                onClick={async () => {
                  if (
                    await confirm(`Kunde „${displayName}" wirklich archivieren?`, {
                      title: "Kunde archivieren",
                      confirmLabel: "Archivieren",
                    })
                  ) {
                    del.mutate(customerId, {
                      onSuccess: () => navigate({ to: "/customers" }),
                    });
                  }
                }}
                className="btn-danger text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={canEdit ? "Kunde archivieren (bleibt referenziert fuer GoBD)" : "Keine Schreibrechte"}
              >
                <Archive size={14} /> Archivieren
              </button>
            )}
          </div>
          </fieldset>
        </form>
      )}

      {/* Documents tab */}
      {tab === "documents" && (
        <div className="card overflow-hidden">
          {docs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Keine Belege vorhanden</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Nummer</th>
                  <th className="table-header">Typ</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Datum</th>
                  <th className="table-header text-right">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell">
                      <Link
                        to={doc.status === "DRAFT" ? "/documents/$id/edit" : "/documents/$id"}
                        params={{ id: String(doc.id) }}
                        className="font-medium text-honey-600 hover:underline font-mono text-xs"
                      >
                        {doc.documentNumber ?? "(Entwurf)"}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <TypeBadge type={doc.documentType as DocumentType} />
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={doc.status as any} />
                    </td>
                    <td className="table-cell text-gray-500 text-xs">
                      {doc.issueDate ?? doc.createdAt.slice(0, 10)}
                    </td>
                    <td className="table-cell text-right font-medium">
                      {formatEur(doc.totalGross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
