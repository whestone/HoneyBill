import { useEffect, useRef, useState } from "react";
import { formatDecimalGerman, germanToApiDecimal } from "@honeybill/shared";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  /** API-format decimal string (e.g. "6.66"). */
  value: string;
  /** Called with the API-format string on every change. */
  onChange: (apiValue: string) => void;
};

/**
 * Decimal input that accepts and displays German format (comma as decimal separator)
 * while exposing API-format ("6.66") to the parent via `onChange`.
 *
 * - While focused: displays whatever the user types (free editing).
 * - On blur: reformats to canonical "X,XX".
 * - On every keystroke: emits the converted API value to parent (for live totals).
 */
export function DecimalInput({ value, onChange, onFocus, onBlur, ...rest }: Props) {
  const [local, setLocal] = useState(() => formatDecimalGerman(value));
  const focusedRef = useRef(false);

  // Sync from parent when not actively editing
  useEffect(() => {
    if (!focusedRef.current) {
      setLocal(formatDecimalGerman(value));
    }
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={local}
      onFocus={(e) => {
        focusedRef.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        onChange(germanToApiDecimal(raw));
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        const formatted = formatDecimalGerman(local);
        setLocal(formatted);
        onChange(germanToApiDecimal(formatted));
        onBlur?.(e);
      }}
    />
  );
}
