import { Archive, ArchiveRestore } from "lucide-react";
import { IconButton } from "./IconButton";
import { useConfirm } from "./ConfirmDialog";

type ArchiveProps = {
  /** Callback, wenn bestaetigt wurde. Soll die Mutation ausloesen. */
  onConfirm: () => Promise<unknown> | void;
  /** Bezeichner fuer Confirm-Meldung, z. B. "Kunde Max Mustermann" */
  itemLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Nur Icon anzeigen (fuer Aktionsspalten in Tabellen). */
  compact?: boolean;
};

/**
 * Einheitlicher Archivieren-Button (weicher Delete). Zeigt Confirm-Dialog
 * vorher an, nutzt danger-Icon-Button-Variante.
 */
export function ArchiveButton({
  onConfirm,
  itemLabel,
  disabled,
  loading,
  compact,
}: ArchiveProps) {
  const confirm = useConfirm();
  const target = itemLabel ? `„${itemLabel}"` : "diesen Eintrag";

  return (
    <IconButton
      icon={Archive}
      label="Archivieren"
      text={compact ? undefined : "Archivieren"}
      variant="danger"
      disabled={disabled || loading}
      onClick={async () => {
        const ok = await confirm(
          `${target.charAt(0).toUpperCase() + target.slice(1)} wirklich archivieren?`,
          {
            title: "Archivieren?",
            confirmLabel: "Archivieren",
            danger: true,
          },
        );
        if (!ok) return;
        await onConfirm();
      }}
    />
  );
}

type RestoreProps = {
  onConfirm: () => Promise<unknown> | void;
  disabled?: boolean;
  loading?: boolean;
  /** Nur Icon anzeigen (fuer Aktionsspalten in Tabellen). */
  compact?: boolean;
};

/**
 * Einheitlicher Reaktivieren-Button fuer archivierte Eintraege.
 * Kein Confirm noetig: die Aktion ist nicht zerstoererisch.
 */
export function RestoreButton({ onConfirm, disabled, loading, compact }: RestoreProps) {
  return (
    <IconButton
      icon={ArchiveRestore}
      label="Reaktivieren"
      text={compact ? undefined : "Reaktivieren"}
      variant="primary"
      disabled={disabled || loading}
      onClick={async () => {
        await onConfirm();
      }}
    />
  );
}
