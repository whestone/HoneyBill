import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import type { PermissionResource } from "@honeybill/shared";
import { useCan } from "@/api/hooks/usePermissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompanyTab } from "./settings/CompanyTab";
import { TaxRatesTab } from "./settings/TaxRatesTab";
import { NumberSeriesTab } from "./settings/NumberSeriesTab";
import { PdfLayoutTab } from "./settings/PdfLayoutTab";
import { EmailTab } from "./settings/EmailTab";
import { UsersTab } from "./settings/UsersTab";
import { RolesPermissionsTab } from "./settings/RolesPermissionsTab";

const TAB_LABELS = {
  company: "Firmendaten",
  taxrates: "Steuersätze",
  numbering: "Nummernkreise",
  pdflayout: "PDF-Layout",
  email: "E-Mail",
  users: "Benutzer",
  roles: "Rollen & Rechte",
} as const;
type Tab = keyof typeof TAB_LABELS;

// Pro Tab die dafuer benoetigte Resource; admin-only Tabs bekommen null
// und werden ueber den isAdmin-Check geschuetzt.
const TAB_RESOURCE: Record<Tab, PermissionResource | null> = {
  company: "settings.company",
  taxrates: "settings.taxRates",
  numbering: "settings.numbering",
  pdflayout: "settings.pdfLayout",
  email: "settings.email",
  users: null,
  roles: null,
};

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");
  const { me, can, isAdmin } = useCan();

  const visibleTabs = (Object.keys(TAB_LABELS) as Tab[]).filter((t) => {
    if (t === "users" || t === "roles") return isAdmin;
    const res = TAB_RESOURCE[t];
    return res ? can(res, "view") : true;
  });

  // Falls der aktive Tab nicht mehr sichtbar ist (z.B. weil Rechte entzogen),
  // fallback auf den ersten sichtbaren.
  if (visibleTabs.length > 0 && !visibleTabs.includes(tab)) {
    setTab(visibleTabs[0]!);
    return null;
  }

  return (
    <div className={`p-6 space-y-4 ${tab === "pdflayout" ? "max-w-6xl" : "max-w-3xl"}`} style={{ minWidth: 0 }}>
      <PageHeader title="Einstellungen" icon={SettingsIcon} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 flex-wrap">
        {visibleTabs.map((t) => (
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
        ))}
      </div>

      {tab === "company" && <CompanyTab />}
      {tab === "taxrates" && <TaxRatesTab />}
      {tab === "numbering" && <NumberSeriesTab />}
      {tab === "pdflayout" && <PdfLayoutTab />}
      {tab === "email" && <EmailTab />}
      {tab === "users" && isAdmin && <UsersTab currentUserId={me?.id ?? 0} />}
      {tab === "roles" && isAdmin && <RolesPermissionsTab />}
    </div>
  );
}
