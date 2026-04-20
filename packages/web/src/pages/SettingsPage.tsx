import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState } from "react";
import type { User } from "@honeybill/shared";
import { CompanyTab } from "./settings/CompanyTab";
import { TaxRatesTab } from "./settings/TaxRatesTab";
import { NumberSeriesTab } from "./settings/NumberSeriesTab";
import { PdfLayoutTab } from "./settings/PdfLayoutTab";
import { EmailTab } from "./settings/EmailTab";
import { UsersTab } from "./settings/UsersTab";

const TAB_LABELS = { company: "Firmendaten", taxrates: "Steuersätze", numbering: "Nummernkreise", pdflayout: "PDF-Layout", email: "E-Mail", users: "Benutzer" } as const;
type Tab = keyof typeof TAB_LABELS;

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");

  const { data: me } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me"),
  });
  const isAdmin = me?.role === "admin";

  return (
    <div className={`p-6 space-y-4 ${tab === "pdflayout" ? "max-w-6xl" : "max-w-3xl"}`} style={{ minWidth: 0 }}>
      <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          if (t === "users" && !isAdmin) return null;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-honey-500 text-honey-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {tab === "company" && <CompanyTab />}
      {tab === "taxrates" && <TaxRatesTab />}
      {tab === "numbering" && <NumberSeriesTab />}
      {tab === "pdflayout" && <PdfLayoutTab />}
      {tab === "email" && <EmailTab />}
      {tab === "users" && isAdmin && <UsersTab currentUserId={me?.id ?? 0} />}
    </div>
  );
}
