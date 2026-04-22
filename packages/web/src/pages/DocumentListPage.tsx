import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus, Search } from "lucide-react";
import { useDocuments, useCreateDocument, useDeleteDocument } from "@/api/hooks/useDocuments";
import { useCustomers } from "@/api/hooks/useCustomers";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { formatEur, DOCUMENT_TYPE_LABELS } from "@honeybill/shared";
import type { DocumentType } from "@honeybill/shared";
import { useCan } from "@/api/hooks/usePermissions";
import { Label } from "@/components/ui/Label";

const TYPES: DocumentType[] = ["INVOICE", "QUOTE", "CREDIT_NOTE", "DELIVERY_NOTE"];

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
  const deleteDoc = useDeleteDocument();
  const { can } = useCan();
  const canEdit = can("documents", "edit");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Belege</h1>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!canEdit}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          title={canEdit ? undefined : "Keine Schreibrechte"}
        >
          <Plus size={16} /> Neuer Beleg
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-48"
            placeholder="Belegnummer suchen…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Alle Typen</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          className="input w-auto"
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
      </div>

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
                <th className="table-header">Nummer</th>
                <th className="table-header">Typ</th>
                <th className="table-header">Status</th>
                <th className="table-header">Kunde</th>
                <th className="table-header">Datum</th>
                <th className="table-header text-right">Betrag</th>
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
                    <td className="table-cell text-gray-600">{customerName}</td>
                    <td className="table-cell text-gray-500 text-xs">
                      {doc.issueDate ?? doc.createdAt.slice(0, 10)}
                    </td>
                    <td className="table-cell text-right font-medium">
                      {formatEur(doc.totalGross)}
                    </td>
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
