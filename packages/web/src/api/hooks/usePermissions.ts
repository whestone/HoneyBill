import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type {
  PermissionMatrix,
  PermissionResource,
  UpdatePermissionsInput,
  User,
} from "@honeybill/shared";

/** Hook fuer Gate-Komponenten: prueft, ob der eingeloggte User die Aktion darf. */
export function useCan() {
  const { data: me } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me"),
  });

  const check = (resource: PermissionResource, action: "view" | "edit"): boolean => {
    if (!me) return false;
    // Admin hat immer alle Rechte (Server liefert die Matrix bereits gefuellt,
    // der Check hier ist belt-and-suspenders).
    if (me.role === "admin") return true;
    const entry = me.permissions?.[resource];
    if (!entry) return false;
    return action === "view" ? entry.canView : entry.canEdit;
  };

  return { me, can: check, isAdmin: me?.role === "admin" };
}

/** Admin-Hook: laedt komplette konfigurierbare Matrix. */
export function usePermissionMatrix() {
  return useQuery<{ matrix: PermissionMatrix }>({
    queryKey: ["permissions"],
    queryFn: () => api.get("/permissions"),
  });
}

export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePermissionsInput) => api.put("/permissions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissions"] });
      // /me enthaelt die Rechte des eingeloggten Users — sicherheitshalber neu laden.
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
