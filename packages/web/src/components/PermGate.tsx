import type { ReactNode } from "react";
import type { PermissionResource } from "@honeybill/shared";
import { useCan } from "@/api/hooks/usePermissions";

type Props = {
  resource: PermissionResource;
  action: "view" | "edit";
  children: ReactNode;
  /** Wird gerendert statt `children`, wenn die Pruefung fehlschlaegt. */
  fallback?: ReactNode;
};

/**
 * Rendert `children` nur, wenn der eingeloggte User die Aktion darf.
 * Sonst wird `fallback` (oder nichts) angezeigt.
 */
export function PermGate({ resource, action, children, fallback = null }: Props) {
  const { can } = useCan();
  if (!can(resource, action)) return <>{fallback}</>;
  return <>{children}</>;
}
