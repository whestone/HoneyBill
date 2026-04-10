import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatEur } from "@honeybill/shared";
import { AlertTriangle, Clock, FileText, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import type { DocumentType } from "@honeybill/shared";

interface OpenItemsSummary {
  totalOpen: string;
  totalOverdue: string;
  count: number;
  overdueCount: number;
}

interface DocStats {
  revenueThisMonth: string;
  revenueLastMonth: string;
  draftCount: number;
  invoiceCount: number;
}

interface RecentDoc {
  id: number;
  documentType: string;
  documentNumber: string | null;
  status: string;
  totalGross: string;
  customer?: { companyName?: string; firstName?: string; lastName?: string } | null;
  createdAt: string;
  issueDate?: string | null;
}

export function DashboardPage() {
  const summary = useQuery<OpenItemsSummary>({
    queryKey: ["open-items-summary"],
    queryFn: () => api.get("/open-items/summary"),
  });

  const docStats = useQuery<DocStats>({
    queryKey: ["documents-stats"],
    queryFn: () => api.get("/documents/stats"),
  });

  const recent = useQuery<{ data: RecentDoc[] }>({
    queryKey: ["documents-recent"],
    queryFn: () => api.get("/documents?limit=8"),
  });

  const stats = [
    {
      label: "Umsatz diesen Monat",
      value: formatEur(docStats.data?.revenueThisMonth ?? "0"),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Umsatz letzten Monat",
      value: formatEur(docStats.data?.revenueLastMonth ?? "0"),
      icon: TrendingUp,
      color: "text-honey-600",
      bg: "bg-honey-50",
    },
    {
      label: "Offene Forderungen",
      value: formatEur(summary.data?.totalOpen ?? "0"),
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Überfällig",
      value: formatEur(summary.data?.totalOverdue ?? "0"),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Rechnungen gesamt",
      value: String(docStats.data?.invoiceCount ?? 0),
      icon: FileText,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Entwürfe",
      value: String(docStats.data?.draftCount ?? 0),
      icon: FileText,
      color: "text-gray-500",
      bg: "bg-gray-100",
    },
    {
      label: "Offene Rechnungen",
      value: String(summary.data?.count ?? 0),
      icon: FileText,
      color: "text-honey-600",
      bg: "bg-honey-50",
    },
    {
      label: "Überfällige Rechnungen",
      value: String(summary.data?.overdueCount ?? 0),
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Überblick über Umsatz und offene Forderungen</p>
        </div>
        <Link to="/documents" className="btn-primary">
          <FileText size={14} /> Neuer Beleg
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`inline-flex rounded-lg p-2 ${s.bg} mb-3`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent docs */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Zuletzt erstellt</h2>
          <Link to="/documents" className="text-xs text-honey-600 hover:underline">
            Alle anzeigen
          </Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-header">Nummer</th>
              <th className="table-header">Typ</th>
              <th className="table-header">Kunde</th>
              <th className="table-header">Status</th>
              <th className="table-header">Datum</th>
              <th className="table-header text-right">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {(recent.data?.data ?? []).map((doc) => (
              <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="table-cell">
                  <Link
                    to={doc.status === "DRAFT" ? "/documents/$id/edit" : "/documents/$id"}
                    params={{ id: String(doc.id) }}
                    className="text-honey-600 hover:underline font-medium font-mono text-xs"
                  >
                    {doc.documentNumber ?? "(Entwurf)"}
                  </Link>
                </td>
                <td className="table-cell">
                  <TypeBadge type={doc.documentType as DocumentType} />
                </td>
                <td className="table-cell text-gray-500">
                  {doc.customer?.companyName ||
                    `${doc.customer?.firstName ?? ""} ${doc.customer?.lastName ?? ""}`.trim() ||
                    "—"}
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
            {!recent.data?.data.length && (
              <tr>
                <td colSpan={6} className="table-cell text-center text-gray-400 py-8">
                  Noch keine Belege vorhanden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
