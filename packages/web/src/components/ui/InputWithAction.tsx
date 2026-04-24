import { forwardRef, useImperativeHandle, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Mail, Phone } from "lucide-react";

type ActionType = "mail" | "phone";

type InputWithActionProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  actionType: ActionType;
};

/**
 * Input mit einem kleinen Action-Button auf der rechten Seite.
 * - `actionType="mail"` → öffnet `mailto:<wert>` beim Klick
 * - `actionType="phone"` → öffnet `tel:<wert>` beim Klick (Gerät wählt Telefon-App)
 *
 * Funktioniert mit react-hook-form via `{...register("feld")}` — der ref
 * wird per forwardRef an das innere <input> durchgereicht.
 */
const InputWithAction = forwardRef<HTMLInputElement, InputWithActionProps>(
  function InputWithAction({ actionType, className, ...rest }, ref) {
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const Icon = actionType === "mail" ? Mail : Phone;
    const prefix = actionType === "mail" ? "mailto:" : "tel:";
    const title = actionType === "mail" ? "E-Mail senden" : "Anrufen";
    const type = actionType === "mail" ? "email" : "tel";

    const open = () => {
      const raw = innerRef.current?.value?.trim();
      if (!raw) return;
      // Bei tel: Leerzeichen entfernen, damit alle Clients das Format mögen.
      const val = actionType === "phone" ? raw.replace(/\s+/g, "") : raw;
      window.location.href = `${prefix}${val}`;
    };

    return (
      <div className="flex gap-1">
        <input
          ref={innerRef}
          type={type}
          className={className ?? "input flex-1"}
          {...rest}
        />
        <button
          type="button"
          onClick={open}
          className="btn-secondary px-2 shrink-0"
          title={title}
          aria-label={title}
        >
          <Icon size={14} />
        </button>
      </div>
    );
  },
);

export const EmailInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function EmailInput(props, ref) {
  return <InputWithAction ref={ref} actionType="mail" {...props} />;
});

export const PhoneInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function PhoneInput(props, ref) {
  return <InputWithAction ref={ref} actionType="phone" {...props} />;
});
