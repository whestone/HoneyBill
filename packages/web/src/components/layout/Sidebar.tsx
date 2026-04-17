import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { useLogout } from "@/api/hooks/useAuth";
import { useAuthStore } from "@/stores/auth.store";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface OpenItemsSummary {
  overdueCount: number;
}

const NAV = [
  { to: "/",             label: "Dashboard",     icon: LayoutDashboard },
  { to: "/documents",    label: "Belege",         icon: FileText },
  { to: "/customers",    label: "Kunden",         icon: Users },
  { to: "/products",     label: "Produkte",       icon: Package },
  { to: "/open-items",   label: "Offene Posten",  icon: BarChart3 },
  { to: "/settings",     label: "Einstellungen",  icon: Settings },
];

export function Sidebar() {
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const location = useRouterState({ select: (s) => s.location });
  const { data: openItemsSummary } = useQuery<OpenItemsSummary>({
    queryKey: ["open-items-summary"],
    queryFn: () => api.get("/open-items/summary"),
    staleTime: 60_000,
  });

  return (
    <aside className="flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <span className="text-xl font-bold text-honey-600">🍯 HoneyBill</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active =
            to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          const overdueCount = to === "/open-items" ? (openItemsSummary?.overdueCount ?? 0) : 0;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-honey-50 text-honey-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {overdueCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                  {overdueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="mb-2">
          <div className="text-sm font-medium text-gray-700 truncate">{user?.fullName}</div>
          <div className="text-xs text-gray-400 truncate">{user?.email}</div>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <LogOut size={14} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
