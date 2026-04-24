import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArchiveRestore, Plus, Search, Users } from "lucide-react";
import { useCustomers, useCreateCustomer, useUpdateCustomer } from "@/api/hooks/useCustomers";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateCustomerSchema, type CreateCustomerInput } from "@honeybill/shared";
import { useCan } from "@/api/hooks/usePermissions";
import { Label } from "@/components/ui/Label";
import { EmailInput, PhoneInput } from "@/components/ui/InputWithAction";

const EUR_FMT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatEur(n: number): string {
  return EUR_FMT.format(n);
}

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { can } = useCan();
  const canEdit = can("customers", "edit");

  const { data, isLoading } = useCustomers({
    q: search,
    page: String(page),
    ...(showArchived ? { archived: "true" } : {}),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!canEdit}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          title={canEdit ? undefined : "Keine Schreibrechte"}
        >
          <Plus size={16} /> Neuer Kunde
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Suche nach Name, Nummer, E-Mail…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
          />
          Archivierte anzeigen
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={Users}
            title="Keine Kunden gefunden"
            description="Erstelle deinen ersten Kunden, um loszulegen."
            action={
              <button
                onClick={() => setShowCreate(true)}
                disabled={!canEdit}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Neuer Kunde
              </button>
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Kundennr.</th>
                <th className="table-header">Name</th>
                <th className="table-header">E-Mail</th>
                <th className="table-header">Ort</th>
                <th className="table-header text-right">Offen</th>
                <th className="table-header text-right">Umsatz 365 T.</th>
                <th className="table-header">USt-IdNr.</th>
                {showArchived && <th className="table-header"></th>}
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => {
                const open = Number(c.openAmount ?? "0");
                const rev = Number(c.revenue365 ?? "0");
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell font-mono text-xs">{c.customerNumber}</td>
                    <td className="table-cell">
                      <Link
                        to="/customers/$id"
                        params={{ id: String(c.id) }}
                        className="font-medium text-honey-600 hover:underline"
                      >
                        {c.companyName ||
                          `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() ||
                          "—"}
                      </Link>
                    </td>
                    <td className="table-cell text-gray-500">{c.email ?? "—"}</td>
                    <td className="table-cell text-gray-500">{c.billCity ?? "—"}</td>
                    <td className={`table-cell text-right tabular-nums ${open > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
                      {open > 0 ? formatEur(open) : "—"}
                    </td>
                    <td className="table-cell text-right tabular-nums text-gray-700">
                      {rev > 0 ? formatEur(rev) : "—"}
                    </td>
                    <td className="table-cell text-gray-500 font-mono text-xs">{c.vatId ?? "—"}</td>
                    {showArchived && (
                      <td className="table-cell text-right">
                        <RestoreButton id={c.id} disabled={!canEdit} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
      )}

      {/* Create modal */}
      <CreateCustomerModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function RestoreButton({ id, disabled }: { id: number; disabled: boolean }) {
  const update = useUpdateCustomer(id);
  return (
    <button
      type="button"
      disabled={disabled || update.isPending}
      onClick={() => update.mutate({ isArchived: false })}
      className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      title={disabled ? "Keine Schreibrechte" : "Archivierung aufheben"}
    >
      <ArchiveRestore size={12} /> Reaktivieren
    </button>
  );
}

function CreateCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCustomer();
  const { register, handleSubmit, reset } = useForm<CreateCustomerInput>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: { billCountry: "DE", paymentDays: 14, taxExempt: false, reverseCharge: false },
  });

  const onSubmit = (data: CreateCustomerInput) => {
    create.mutate(data, { onSuccess: () => { reset(); onClose(); } });
  };

  return (
    <Modal open={open} onClose={onClose} title="Neuer Kunde" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <div className="col-span-2">
            <Label>Straße (Rechnung)</Label>
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
            <Label>USt-IdNr.</Label>
            <input {...register("vatId")} className="input" placeholder="DE123456789" />
          </div>
          <div>
            <Label>Zahlungsziel (Tage)</Label>
            <input {...register("paymentDays", { valueAsNumber: true })} type="number" className="input" min={0} />
          </div>
          <div>
            <Label>Leitweg-ID (XRechnung)</Label>
            <input {...register("leitwegId")} className="input" placeholder="04011000-1234567890-06" />
          </div>
        </div>
        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <input {...register("reverseCharge")} type="checkbox" className="rounded" />
            Reverse Charge
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input {...register("taxExempt")} type="checkbox" className="rounded" />
            Steuerbefreit
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={create.isPending} className="btn-primary">
            {create.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
