import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle } from "lucide-react";
import {
  PERMISSION_RESOURCES,
  PERMISSION_RESOURCE_LABELS,
  CONFIGURABLE_ROLES,
  type PermissionResource,
  type ConfigurableRole,
  type PermissionMatrix,
} from "@honeybill/shared";
import { usePermissionMatrix, useUpdatePermissions } from "@/api/hooks/usePermissions";

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  accountant: "Buchhalter",
  viewer: "Ansicht",
};

export function RolesPermissionsTab() {
  const { data, isLoading } = usePermissionMatrix();
  const update = useUpdatePermissions();
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [saved, setSaved] = useState(false);

  // Server-Matrix in lokalen State laden, damit Toggles ohne Round-Trip reagieren.
  useEffect(() => {
    if (data?.matrix) setMatrix(data.matrix);
  }, [data]);

  if (isLoading || !matrix) {
    return <div className="p-8 text-center text-gray-400">Laden…</div>;
  }

  const toggle = (role: ConfigurableRole, resource: PermissionResource, field: "canView" | "canEdit") => {
    setMatrix((prev) => {
      if (!prev) return prev;
      const roleRow = prev[role] ?? ({} as PermissionMatrix[string]);
      const current = roleRow[resource] ?? { canView: false, canEdit: false };
      const next = { ...current, [field]: !current[field] };
      // Edit impliziert View — sonst koennte jemand bearbeiten, ohne den Tab zu sehen.
      if (field === "canEdit" && next.canEdit) next.canView = true;
      // Entzug von View entzieht auch Edit.
      if (field === "canView" && !next.canView) next.canEdit = false;
      return {
        ...prev,
        [role]: { ...roleRow, [resource]: next },
      };
    });
    setSaved(false);
  };

  const handleSave = () => {
    if (!matrix) return;
    const entries = CONFIGURABLE_ROLES.flatMap((role) =>
      PERMISSION_RESOURCES.map((resource) => ({
        role,
        resource,
        canView: matrix[role]?.[resource]?.canView ?? false,
        canEdit: matrix[role]?.[resource]?.canEdit ?? false,
      })),
    );
    update.mutate(
      { entries },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      },
    );
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-honey-600 mt-0.5" size={22} />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rollen &amp; Rechte</h2>
          <p className="text-sm text-gray-500 mt-1">
            Lege pro Rolle fest, welche Bereiche sichtbar sind (View) und wo
            Aenderungen erlaubt sind (Edit). Administratoren haben immer alle
            Rechte und werden nicht angezeigt. Benutzerverwaltung bleibt aus
            Sicherheitsgruenden admin-exklusiv.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-700">Bereich</th>
              {CONFIGURABLE_ROLES.map((role) => (
                <th key={role} className="text-center py-2 px-2 font-medium text-gray-700" colSpan={2}>
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-100 text-xs text-gray-500">
              <th></th>
              {CONFIGURABLE_ROLES.map((role) => (
                <>
                  <th key={`${role}-v`} className="text-center py-1 font-normal">View</th>
                  <th key={`${role}-e`} className="text-center py-1 font-normal">Edit</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_RESOURCES.map((resource) => (
              <tr key={resource} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pr-4 text-gray-800">{PERMISSION_RESOURCE_LABELS[resource]}</td>
                {CONFIGURABLE_ROLES.map((role) => {
                  const entry = matrix[role]?.[resource] ?? { canView: false, canEdit: false };
                  return (
                    <>
                      <td key={`${role}-${resource}-v`} className="text-center py-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-honey-600 focus:ring-honey-500"
                          checked={entry.canView}
                          onChange={() => toggle(role, resource, "canView")}
                        />
                      </td>
                      <td key={`${role}-${resource}-e`} className="text-center py-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-honey-600 focus:ring-honey-500"
                          checked={entry.canEdit}
                          disabled={!entry.canView}
                          onChange={() => toggle(role, resource, "canEdit")}
                        />
                      </td>
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <CheckCircle size={14} /> Gespeichert
          </span>
        )}
        <button
          className="btn-primary"
          disabled={update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
