import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  message: string;
  resolve: (value: boolean) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<(message: string, options?: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false)
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, resolve, ...options });
    });
  }, []);

  const handle = (value: boolean) => {
    resolveRef.current?.(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          open
          onClose={() => handle(false)}
          title={state.title ?? "Bestätigung"}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {state.danger !== false && (
                <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
              )}
              <p className="text-sm text-gray-700">{state.message}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handle(false)}
                className="btn-secondary"
              >
                {state.cancelLabel ?? "Abbrechen"}
              </button>
              <button
                type="button"
                onClick={() => handle(true)}
                className={state.danger !== false ? "btn-danger" : "btn-primary"}
                autoFocus
              >
                {state.confirmLabel ?? "Bestätigen"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConfirm() {
  return useContext(ConfirmContext);
}
