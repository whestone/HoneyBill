import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Rechts neben dem Titel, typischerweise ein Primaer-Button ("Neuer Kunde"). */
  action?: ReactNode;
};

/**
 * Einheitlicher Seiten-Header: Titel, optional Untertitel + Icon + Aktions-Slot.
 * Ersetzt diverse handgebaute `<div class="flex justify-between"><h1/>...</div>`-Varianten.
 */
export function PageHeader({ title, subtitle, icon: Icon, action }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={22} className="text-gray-400 shrink-0" />}
          <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
