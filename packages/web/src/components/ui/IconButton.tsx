import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type Variant = "default" | "danger" | "ghost" | "primary";
type Size = "sm" | "md";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Icon-Komponente aus lucide-react */
  icon: LucideIcon;
  /** Pflicht: wird als title + aria-label verwendet (Accessibility). */
  label: string;
  /** Optional: sichtbarer Text neben dem Icon (fuer "Bearbeiten" etc.) */
  text?: string;
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
  danger: "text-gray-400 hover:text-red-600 hover:bg-red-50",
  ghost: "text-gray-400 hover:text-gray-700",
  primary: "text-honey-600 hover:text-honey-700 hover:bg-honey-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "p-1 text-xs",
  md: "p-1.5 text-sm",
};

const ICON_SIZE: Record<Size, number> = {
  sm: 14,
  md: 16,
};

/**
 * Wiederverwendbarer Icon-Button fuer Tabellenzellen & Toolbars.
 * Einheitliches Look & Feel: Varianten (default/danger/ghost/primary),
 * zwei Groessen, aria-label + title automatisch gesetzt.
 */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon: Icon, label, text, variant = "default", size = "sm", className, ...rest },
  ref,
) {
  const classes = [
    "inline-flex items-center justify-center gap-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className ?? "",
  ].join(" ");

  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className={classes}
      {...rest}
    >
      <Icon size={ICON_SIZE[size]} />
      {text && <span>{text}</span>}
    </button>
  );
});
