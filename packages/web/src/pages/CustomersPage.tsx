import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar, FilterCheckbox } from "@/components/ui/SearchToolbar";
import { RestoreButton as SharedRestoreButton } from "@/components/ui/ArchiveButton";
import { useColumnVisibility, type ColumnDef } from "@/components/ui/ColumnToggle";

const CUSTOMER_COLUMNS: ColumnDef[] = [
  { key: "customerNumber", label: "Kundennr." },
  { key: "name", label: "Name", alwaysVisible: true },
  { key: "email", label: "E-Mail" },
  { key: "city", label: "Ort" },
  { key: "openAmount", label: "Offen" },
  { key: "revenue365", label: "Umsatz 365 T." },
  { key: "vatId", label: "USt-IdNr." },
];

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
  const { isVisible, columnToggle } = useColumnVisibility("customers", CUSTOMER_COLUMNS);

  const { data, isLoading } = useCustomers({
    q: search,
    page: String(page),
    ...(showArchived ? { archived: "true" } : {}),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Kunden"
        icon={Users}
        action={
          <button
            onClick={() => setShowCreate(true)}
            disabled={!canEdit}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title={canEdit ? undefined : "Keine Schreibrechte"}
          >
            <Plus size={16} /> Neuer Kunde
          </button>
        }
      />

      <SearchToolbar
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Suche nach Name, Nummer, E-Mail…"
        trailing={columnToggle}
      >
        <FilterCheckbox
          label="Archivierte anzeigen"
          checked={showArchived}
          onChange={(v) => { setShowArchived(v); setPage(1); }}
        />
      </SearchToolbar>

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
                {isVisible("customerNumber") && <th className="table-header">Kundennr.</th>}
                {isVisible("name") && <th className="table-header">Name</th>}
                {isVisible("email") && <th className="table-header">E-Mail</th>}
                {isVisible("city") && <th className="table-header">Ort</th>}
                {isVisible("openAmount") && <th className="table-header text-right">Offen</th>}
                {isVisible("revenue365") && <th className="table-header text-right">Umsatz 365 T.</th>}
                {isVisible("vatId") && <th className="table-header">USt-IdNr.</th>}
                {showArchived && <th className="table-header"></th>}
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => {
                const open = Number(c.openAmount ?? "0");
                const rev = Number(c.revenue365 ?? "0");
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {isVisible("customerNumber") && (
                      <td className="table-cell font-mono text-xs">{c.customerNumber}</td>
                    )}
                    {isVisible("name") && (
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
                    )}
                    {isVisible("email") && (
                      <td className="table-cell text-gray-500">{c.email ?? "—"}</td>
                    )}
                    {isVisible("city") && (
                      <td className="table-cell text-gray-500">{c.billCity ?? "—"}</td>
                    )}
                    {isVisible("openAmount") && (
                      <td className={`table-cell text-right tabular-nums ${open > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
                        {open > 0 ? formatEur(open) : "—"}
                      </td>
                    )}
                    {isVisible("revenue365") && (
                      <td className="table-cell text-right tabular-nums text-gray-700">
                        {rev > 0 ? formatEur(rev) : "—"}
                      </td>
                    )}
                    {isVisible("vatId") && (
                      <td className="table-cell text-gray-500 font-mono text-xs">{c.vatId ?? "—"}</td>
                    )}
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
    <SharedRestoreButton
      disabled={disabled}
      loading={update.isPending}
      onConfirm={() => update.mutateAsync({ isArchived: false })}
    />
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
