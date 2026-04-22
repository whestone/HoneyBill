import type { ReactNode, LabelHTMLAttributes } from "react";

type Props = LabelHTMLAttributes<HTMLLabelElement> & {
  /** Markiert das Feld als Pflichtfeld (roter Stern rechts vom Label). */
  required?: boolean;
  children: ReactNode;
};

/**
 * Einheitliches Label fuer alle Formulare. Nutze `required`, um ein
 * Pflichtfeld-Sternchen anzuzeigen — damit bleibt die Markierung
 * projektweit konsistent.
 */
export function Label({ required, children, className = "label", ...rest }: Props) {
  return (
    <label className={className} {...rest}>
      {children}
      {required && (
        <span aria-hidden="true" className="text-red-500 ml-0.5">
          *
        </span>
      )}
    </label>
  );
}
