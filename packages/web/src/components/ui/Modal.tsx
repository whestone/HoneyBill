import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[95vw]",
};

const HEIGHTS = {
  sm: "max-h-[90vh]",
  md: "max-h-[90vh]",
  lg: "max-h-[90vh]",
  xl: "max-h-[90vh]",
  full: "h-[92vh]",
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full mx-4 ${SIZES[size]} ${HEIGHTS[size]} flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-1">
            <X size={18} />
          </button>
        </div>
        <div className={`flex-1 min-h-0 ${size === "full" ? "overflow-hidden" : "overflow-y-auto p-6"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
