import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { rolePermissions } from "../db/schema.js";
import {
  PERMISSION_RESOURCES,
  CONFIGURABLE_ROLES,
  type PermissionResource,
  type PermissionMatrix,
  type PermissionEntry,
} from "@honeybill/shared";

/** In-Memory-Cache der Rechte-Matrix. Lazy-Load beim ersten Zugriff; Invalidierung
 * nur ueber `reloadPermissions()` nach Admin-Update. Vermeidet DB-Hit pro Request. */
let cache: Map<string, Map<string, { canView: boolean; canEdit: boolean }>> | null = null;

async function loadCache(): Promise<void> {
  const rows = await db.select().from(rolePermissions);
  const map = new Map<string, Map<string, { canView: boolean; canEdit: boolean }>>();
  for (const row of rows) {
    if (!map.has(row.role)) map.set(row.role, new Map());
    map.get(row.role)!.set(row.resource, {
      canView: !!row.canView,
      canEdit: !!row.canEdit,
    });
  }
  cache = map;
}

export async function reloadPermissions(): Promise<void> {
  await loadCache();
}

async function ensureCache(): Promise<void> {
  if (!cache) await loadCache();
}

/**
 * Zentrale Rechte-Pruefung. Admin darf immer alles. Fuer andere Rollen entscheidet
 * die DB-Matrix; fehlt ein Eintrag, gilt "verboten".
 */
export async function hasPermission(
  role: string,
  resource: PermissionResource,
  action: "view" | "edit",
): Promise<boolean> {
  if (role === "admin") return true;
  await ensureCache();
  const entry = cache!.get(role)?.get(resource);
  if (!entry) return false;
  return action === "view" ? entry.canView : entry.canEdit;
}

/** Kompletten Rechte-Stand einer Rolle als Matrix-Zeile abrufen (fuer /auth/me). */
export async function getPermissionsForRole(
  role: string,
): Promise<Record<PermissionResource, { canView: boolean; canEdit: boolean }>> {
  const result = {} as Record<PermissionResource, { canView: boolean; canEdit: boolean }>;
  if (role === "admin") {
    for (const r of PERMISSION_RESOURCES) {
      result[r] = { canView: true, canEdit: true };
    }
    return result;
  }
  await ensureCache();
  const roleMap = cache!.get(role);
  for (const r of PERMISSION_RESOURCES) {
    const entry = roleMap?.get(r);
    result[r] = entry ?? { canView: false, canEdit: false };
  }
  return result;
}

/** Gesamte Matrix (nur konfigurierbare Rollen) fuer Admin-UI. */
export async function getFullMatrix(): Promise<PermissionMatrix> {
  await ensureCache();
  const matrix: PermissionMatrix = {};
  for (const role of CONFIGURABLE_ROLES) {
    matrix[role] = await getPermissionsForRole(role);
  }
  return matrix;
}

/** Matrix atomar updaten, Cache invalidieren. */
export async function updateMatrix(entries: PermissionEntry[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const e of entries) {
      // Schema laesst "admin" nicht zu — der Service haette es ohnehin ignoriert,
      // weil hasPermission() fuer Admins hart-codiert true liefert.
      await tx
        .insert(rolePermissions)
        .values({
          role: e.role,
          resource: e.resource,
          canView: e.canView,
          canEdit: e.canEdit,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [rolePermissions.role, rolePermissions.resource],
          set: {
            canView: e.canView,
            canEdit: e.canEdit,
            updatedAt: new Date().toISOString(),
          },
        });
    }
  });
  await reloadPermissions();
}
