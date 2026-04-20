import { z } from "zod";

/**
 * Konfigurierbare Ressourcen im Rechte-System.
 * `settings.users` fehlt absichtlich — Benutzerverwaltung bleibt immer nur fuer Admins,
 * um Lockout-Situationen zu vermeiden.
 */
export const PERMISSION_RESOURCES = [
  "documents",
  "customers",
  "products",
  "openItems",
  "settings.company",
  "settings.taxRates",
  "settings.numbering",
  "settings.pdfLayout",
  "settings.email",
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

/** Deutsche Labels fuer die Matrix-UI. */
export const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
  documents: "Belege",
  customers: "Kunden",
  products: "Produkte",
  openItems: "Offene Posten",
  "settings.company": "Einstellungen — Firmendaten",
  "settings.taxRates": "Einstellungen — Steuersätze",
  "settings.numbering": "Einstellungen — Nummernkreise",
  "settings.pdfLayout": "Einstellungen — PDF-Layout",
  "settings.email": "Einstellungen — E-Mail",
};

/** Rollen, fuer die Rechte konfiguriert werden koennen. Admin hat immer alles. */
export const CONFIGURABLE_ROLES = ["accountant", "viewer"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export const PermissionEntrySchema = z.object({
  role: z.enum(CONFIGURABLE_ROLES),
  resource: z.enum(PERMISSION_RESOURCES),
  canView: z.boolean(),
  canEdit: z.boolean(),
});

export const UpdatePermissionsSchema = z.object({
  entries: z.array(PermissionEntrySchema),
});

export type PermissionEntry = z.infer<typeof PermissionEntrySchema>;
export type UpdatePermissionsInput = z.infer<typeof UpdatePermissionsSchema>;

/**
 * Matrix-Form fuer Frontend: matrix[role][resource] = { canView, canEdit }.
 * Fuer Admins ist sie im /auth/me-Endpoint virtuell "alles true".
 */
export type PermissionMatrix = Record<
  string,
  Record<PermissionResource, { canView: boolean; canEdit: boolean }>
>;
