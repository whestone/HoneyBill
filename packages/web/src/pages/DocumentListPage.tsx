import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useDocuments, useCreateDocument } from "@/api/hooks/useDocuments";
import { useCustomers } from "@/api/hooks/useCustomers";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { formatEur, DOCUMENT_TYPE_LABELS } from "@honeybill/shared";
import type { DocumentType } from "@honeybill/shared";
import { useCan } from "@/api/hooks/usePermissions";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";
import { useColumnVisibility, type ColumnDef } from "@/components/ui/ColumnToggle";

const TYPES: DocumentType[] = ["INVOICE", "QUOTE", "CREDIT_NOTE", "DELIVERY_NOTE"];

const DOCUMENT_COLUMNS: ColumnDef[] = [
  { key: "number", label: "Nummer", alwaysVisible: true },
  { key: "type", label: "Typ" },
  { key: "status", label: "Status" },
  { key: "customer", label: "Kunde" },
  { key: "date", label: "Datum" },
  { key: "total", label: "Betrag" },
];

export function DocumentListPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (typeFilter) params["type"] = typeFilter;
  if (statusFilter) params["status"] = statusFilter;
  if (searchQuery) params["q"] = searchQuery;

  const { data, isLoading } = useDocuments(params);
  const { can } = useCan();
  const canEdit = can("documents", "edit");
  const { isVisible, columnToggle } = useColumnVisibility("documents", DOCUMENT_COLUMNS);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Belege"
        icon={FileText}
        action={
          <button
            onClick={() => setShowCreate(true)}
            disabled={!canEdit}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title={canEdit ? undefined : "Keine Schreibrechte"}
          >
            <Plus size={16} /> Neuer Beleg
          </button>
        }
      />

      <SearchToolbar
        value={searchQuery}
        onChange={(v) => { setSearchQuery(v); setPage(1); }}
        placeholder="Belegnummer suchen…"
        trailing={columnToggle}
      >
        <select
          className="input w-auto text-sm"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Alle Typen</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          className="input w-auto text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Alle Status</option>
          <option value="DRAFT">Entwurf</option>
          <option value="FINAL">Final</option>
          <option value="SENT">Versendet</option>
          <option value="PAID">Bezahlt</option>
          <option value="PARTIAL">Teilbezahlt</option>
          <option value="CANCELLED">Storniert</option>
        </select>
      </SearchToolbar>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={FileText}
            title="Keine Belege gefunden"
            description="Erstelle deinen ersten Beleg."
            action={
              <button
                onClick={() => setShowCreate(true)}
                disabled={!canEdit}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Neuer Beleg
              </button>
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {isVisible("number") && <th className="table-header">Nummer</th>}
                {isVisible("type") && <th className="table-header">Typ</th>}
                {isVisible("status") && <th className="table-header">Status</th>}
                {isVisible("customer") && <th className="table-header">Kunde</th>}
                {isVisible("date") && <th className="table-header">Datum</th>}
                {isVisible("total") && <th className="table-header text-right">Betrag</th>}
              </tr>
            </thead>
            <tbody>
              {data.data.map((doc) => {
                const customer = doc.customer as any;
                const customerName =
                  customer?.companyName ||
                  `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
                  "—";
                return (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {isVisible("number") && (
                      <td className="table-cell">
                        <Link
                          to={doc.status === "DRAFT" ? "/documents/$id/edit" : "/documents/$id"}
                          params={{ id: String(doc.id) }}
                          className="font-medium text-honey-600 hover:underline font-mono text-xs"
                        >
                          {doc.documentNumber ?? "(Entwurf)"}
                        </Link>
                      </td>
                    )}
                    {isVisible("type") && (
                      <td className="table-cell">
                        <TypeBadge type={doc.documentType as DocumentType} />
                      </td>
                    )}
                    {isVisible("status") && (
                      <td className="table-cell">
                        <StatusBadge status={doc.status as any} />
                      </td>
                    )}
                    {isVisible("customer") && (
                      <td className="table-cell text-gray-600">{customerName}</td>
                    )}
                    {isVisible("date") && (
                      <td className="table-cell text-gray-500 text-xs">
                        {doc.issueDate ?? doc.createdAt.slice(0, 10)}
                      </td>
                    )}
                    {isVisible("total") && (
                      <td className="table-cell text-right font-medium">
                        {formatEur(doc.totalGross)}
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

      <CreateDocumentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => navigate({ to: "/documents/$id/edit", params: { id: String(id) } })}
      />
    </div>
  );
}

function CreateDocumentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const create = useCreateDocument();
  const { data: customersData } = useCustomers({ limit: "100" });
  const [docType, setDocType] = useState<DocumentType>("INVOICE");
  const [customerId, setCustomerId] = useState("");

  const handleCreate = () => {
    if (!customerId) return;
    create.mutate(
      { documentType: docType, customerId: Number(customerId), lineItems: [], currency: "EUR" },
      { onSuccess: (doc) => { onClose(); onCreated(doc.id); } }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Neuer Beleg">
      <div className="space-y-4">
        <div>
          <label className="label">Belegtyp</label>
          <select
            className="input"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <Label required>Kunde</Label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Kunde auswählen…</option>
            {(customersData?.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()} ({c.customerNumber})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button
            type="button"
            disabled={!customerId || create.isPending}
            onClick={handleCreate}
            className="btn-primary"
          >
            {create.isPending ? "Erstellen…" : "Erstellen"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
