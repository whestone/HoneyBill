import type { ReactNode } from "react";
import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /**
   * Filter, die direkt nach der Suche erscheinen (z. B. "Archivierte anzeigen").
   */
  children?: ReactNode;
  /**
   * Slot ganz rechts (z. B. Spalten-Umschalter). Wird mit `ml-auto` nach
   * rechts gedrueckt, sodass Filter links an der Suche kleben.
   */
  trailing?: ReactNode;
};

/**
 * Einheitliche Such-Toolbar fuer Listenansichten.
 * Layout: [Suche] [Filter...] <spacer> [Trailing]
 */
export function SearchToolbar({
  value,
  onChange,
  placeholder = "Suche…",
  children,
  trailing,
}: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative max-w-sm flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          className="input pl-9 w-full"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {children}
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}

/**
 * Helferkomponente fuer den haeufigsten Filter-Fall: "Archivierte anzeigen"
 * als Checkbox. In SearchToolbar-Children verwenden.
 */
export function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
