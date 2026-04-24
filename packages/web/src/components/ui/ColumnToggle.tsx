import { useCallback, useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { useCan } from "@/api/hooks/usePermissions";

export type ColumnDef = {
  /** Eindeutiger Key innerhalb der Tabelle. Wird zum Persistieren verwendet. */
  key: string;
  /** Angezeigtes Label im Popover. */
  label: string;
  /** Kann nicht ausgeblendet werden (z. B. Primaer-Spalte). */
  alwaysVisible?: boolean;
  /** Standardmaessig ausgeblendet; Nutzer kann einblenden. */
  hiddenByDefault?: boolean;
};

function storageKey(userId: number | string, tableId: string) {
  return `honeybill:cols:${userId}:${tableId}`;
}

function defaultVisible(columns: ColumnDef[]): Set<string> {
  const s = new Set<string>();
  for (const c of columns) {
    if (!c.hiddenByDefault) s.add(c.key);
  }
  return s;
}

/**
 * Hook, der Spalten-Sichtbarkeit pro Nutzer + Tabelle in localStorage persistiert.
 * Gibt `isVisible(key)` und ein fertiges `<ColumnToggle />` zurueck.
 */
export function useColumnVisibility(tableId: string, columns: ColumnDef[]) {
  const { me } = useCan();
  const userId = me?.id ?? "anon";

  // Initial aus localStorage lesen (oder Defaults).
  const [visible, setVisible] = useState<Set<string>>(() => defaultVisible(columns));

  // Bei Nutzer-/Tabellenwechsel neu laden.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId, tableId));
      if (!raw) {
        setVisible(defaultVisible(columns));
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      const allowed = new Set(columns.map((c) => c.key));
      const s = new Set<string>(parsed.filter((k) => allowed.has(k)));
      // alwaysVisible-Spalten immer sichtbar halten.
      for (const c of columns) if (c.alwaysVisible) s.add(c.key);
      setVisible(s);
    } catch {
      setVisible(defaultVisible(columns));
    }
    // columns-Referenz ist bei jedem Render neu; wir serialisieren sie,
    // damit der Effect nicht permanent feuert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tableId, JSON.stringify(columns.map((c) => c.key))]);

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(
          storageKey(userId, tableId),
          JSON.stringify([...next]),
        );
      } catch {
        /* quota / disabled storage — still keep in-memory state */
      }
    },
    [userId, tableId],
  );

  const toggle = useCallback(
    (key: string) => {
      setVisible((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const def = defaultVisible(columns);
    persist(def);
    setVisible(def);
  }, [columns, persist]);

  const isVisible = useCallback((key: string) => visible.has(key), [visible]);

  // WICHTIG: wir geben ein fertig gerendertes JSX-Element zurueck, keine Component-Factory.
  // Eine in useMemo neu erzeugte Component-Funktion haette einen anderen Component-Typ
  // pro Render → React wuerde die Popover-Komponente bei jedem visible-Update demounten
  // und der open-State ginge verloren.
  const columnToggle = (
    <ColumnTogglePopover columns={columns} visible={visible} onToggle={toggle} onReset={reset} />
  );

  return { isVisible, visible, toggle, reset, columnToggle };
}

function ColumnTogglePopover({
  columns,
  visible,
  onToggle,
  onReset,
}: {
  columns: ColumnDef[];
  visible: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
        title="Spalten ein-/ausblenden"
        aria-label="Spalten ein-/ausblenden"
      >
        <Columns3 size={14} />
        Spalten
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-gray-200 rounded-md shadow-lg p-2">
          <div className="text-xs font-semibold text-gray-500 px-2 py-1">Spalten anzeigen</div>
          <div className="max-h-64 overflow-auto">
            {columns.map((c) => {
              const checked = visible.has(c.key);
              const locked = c.alwaysVisible;
              return (
                <label
                  key={c.key}
                  className={`flex items-center gap-2 px-2 py-1 text-sm rounded cursor-pointer ${
                    locked ? "text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"
                  }`}
                  title={locked ? "Diese Spalte ist immer sichtbar" : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => !locked && onToggle(c.key)}
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              type="button"
              onClick={onReset}
              className="w-full text-left text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
