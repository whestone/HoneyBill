import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatEur } from "@honeybill/shared";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface OpenItem {
  id: number;
  documentNumber: string | null;
  status: string;
  totalGross: string;
  dueDate: string | null;
  paidAmount: string;
  openAmount: string;
  isOverdue: boolean;
  daysOverdue: number;
  customer?: { companyName?: string; firstName?: string; lastName?: string } | null;
}

interface Summary {
  totalOpen: string;
  totalOverdue: string;
  count: number;
  overdueCount: number;
}

export function OpenItemsPage() {
  const { data: items } = useQuery<{ data: OpenItem[] }>({
    queryKey: ["open-items"],
    queryFn: () => api.get("/open-items?limit=50"),
  });
  const { data: summary } = useQuery<Summary>({
    queryKey: ["open-items-summary"],
    queryFn: () => api.get("/open-items/summary"),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Offene Posten</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Gesamt offen", value: formatEur(summary?.totalOpen ?? "0"), color: "text-gray-900" },
          { label: "Davon überfällig", value: formatEur(summary?.totalOverdue ?? "0"), color: "text-red-600" },
          { label: "Offene Rechnungen", value: String(summary?.count ?? 0), color: "text-gray-900" },
          { label: "Überfällige Rechnungen", value: String(summary?.overdueCount ?? 0), color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {!items?.data.length ? (
          <EmptyState
            icon={BarChart3}
            title="Keine offenen Posten"
            description="Alle Rechnungen sind bezahlt."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Rechnung</th>
                <th className="table-header">Kunde</th>
                <th className="table-header">Fällig</th>
                <th className="table-header text-right">Rechnungsbetrag</th>
                <th className="table-header text-right">Bezahlt</th>
                <th className="table-header text-right">Offen</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {(items.data ?? []).map((item) => {
                const customerName =
                  item.customer?.companyName ||
                  `${item.customer?.firstName ?? ""} ${item.customer?.lastName ?? ""}`.trim() ||
                  "—";
                return (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 ${item.isOverdue ? "bg-red-50/30" : ""}`}>
                    <td className="table-cell">
                      <Link
                        to="/documents/$id"
                        params={{ id: String(item.id) }}
                        className="text-honey-600 hover:underline font-mono text-xs font-medium"
                      >
                        {item.documentNumber ?? "—"}
                      </Link>
                    </td>
                    <td className="table-cell text-gray-600">{customerName}</td>
                    <td className="table-cell text-xs">
                      <span className={item.isOverdue ? "text-red-600 font-medium" : "text-gray-500"}>
                        {item.dueDate ?? "—"}
                        {item.isOverdue && ` (${item.daysOverdue} Tage)`}
                      </span>
                    </td>
                    <td className="table-cell text-right">{formatEur(item.totalGross)}</td>
                    <td className="table-cell text-right text-green-600">{formatEur(item.paidAmount)}</td>
                    <td className="table-cell text-right font-semibold text-red-600">{formatEur(item.openAmount)}</td>
                    <td className="table-cell">
                      {item.isOverdue ? (
                        <Badge variant="danger">Überfällig</Badge>
                      ) : (
                        <Badge variant="warning">Offen</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
