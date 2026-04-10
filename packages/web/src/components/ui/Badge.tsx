import type { DocumentStatus, DocumentType } from "@honeybill/shared";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@honeybill/shared";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  DRAFT:     "bg-gray-100 text-gray-700",
  FINAL:     "bg-blue-100 text-blue-700",
  SENT:      "bg-indigo-100 text-indigo-700",
  PAID:      "bg-green-100 text-green-700",
  PARTIAL:   "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const TYPE_COLORS: Record<DocumentType, string> = {
  QUOTE:         "bg-purple-100 text-purple-700",
  DELIVERY_NOTE: "bg-teal-100 text-teal-700",
  INVOICE:       "bg-honey-100 text-honey-700",
  CREDIT_NOTE:   "bg-pink-100 text-pink-700",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function TypeBadge({ type }: { type: DocumentType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}>
      {DOCUMENT_TYPE_LABELS[type]}
    </span>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger:  "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}
