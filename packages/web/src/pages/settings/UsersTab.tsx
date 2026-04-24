import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState } from "react";
import { Plus, Eye, EyeOff, Users, ShieldCheck, UserCog, BadgeCheck } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Label } from "@/components/ui/Label";
import { EmailInput, PhoneInput } from "@/components/ui/InputWithAction";
import type { User, UserRole } from "@honeybill/shared";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  accountant: "Buchhalter",
  viewer: "Betrachter",
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <ShieldCheck size={13} className="text-red-500" />,
  accountant: <UserCog size={13} className="text-honey-600" />,
  viewer: <BadgeCheck size={13} className="text-gray-400" />,
};

export function UsersTab({ currentUserId }: { currentUserId: number }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data: userList = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const reactivate = useMutation({
    mutationFn: (id: number) => api.put(`/users/${id}`, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Benutzer</h2>
          <p className="text-xs text-gray-400 mt-0.5">Zugänge verwalten und Rollen vergeben</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus size={14} /> Benutzer hinzufügen
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name / Benutzer</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rolle</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Letzter Login</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {userList.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {u.firstName || u.lastName
                      ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                      : u.fullName}
                  </div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {ROLE_ICONS[u.role as UserRole]}
                    {ROLE_LABELS[u.role as UserRole]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {u.isActive ? "Aktiv" : "Deaktiviert"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("de-DE") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing(u)}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      Bearbeiten
                    </button>
                    {u.id !== currentUserId && (
                      u.isActive ? (
                        <button
                          onClick={async () => { const name = u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : u.fullName; if (await confirm(`${name} deaktivieren?`, { title: "Benutzer deaktivieren", confirmLabel: "Deaktivieren" })) deactivate.mutate(u.id); }}
                          className="btn-danger text-xs py-1 px-2"
                        >
                          Deaktivieren
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivate.mutate(u.id)}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          Reaktivieren
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <UserFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); }}
        />
      )}
      {editing && (
        <UserFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["users"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user?: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email ?? "",
    emailAddress: user?.emailAddress ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    mobile: user?.mobile ?? "",
    role: (user?.role ?? "viewer") as UserRole,
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEdit || form.password) {
      if (form.password !== form.passwordConfirm) {
        setError("Passwörter stimmen nicht überein");
        return;
      }
      if (form.password.length < 8) {
        setError("Passwort muss mindestens 8 Zeichen haben");
        return;
      }
    }

    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim() || form.firstName || form.lastName || form.email;
      if (isEdit) {
        const patch: Record<string, unknown> = {
          email: form.email,
          emailAddress: form.emailAddress || null,
          fullName,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          phone: form.phone || null,
          mobile: form.mobile || null,
          role: form.role,
        };
        if (form.password) patch.password = form.password;
        await api.put(`/users/${user!.id}`, patch);
      } else {
        await api.post("/users", {
          email: form.email,
          emailAddress: form.emailAddress || null,
          fullName,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          phone: form.phone || null,
          mobile: form.mobile || null,
          role: form.role,
          password: form.password,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Benutzer bearbeiten" : "Benutzer hinzufügen"} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label required>Benutzername</Label>
          <input
            className="input"
            type="text"
            required
            autoComplete="username"
            placeholder="z. B. max oder max@firma.de"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">E-Mail-Adresse</label>
          <EmailInput
            autoComplete="email"
            placeholder="max@firma.de"
            value={form.emailAddress}
            onChange={(e) => setForm((f) => ({ ...f, emailAddress: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Vorname</label>
            <input
              className="input"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Nachname</label>
            <input
              className="input"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Telefon (Festnetz)</label>
            <PhoneInput
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Mobilnummer</label>
            <PhoneInput
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label">Rolle</label>
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
            <option value="viewer">Betrachter</option>
            <option value="accountant">Buchhalter</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div>
          <Label required={!isEdit}>{isEdit ? "Neues Passwort (leer = unverändert)" : "Passwort"}</Label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPw ? "text" : "password"}
              required={!isEdit}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? "Leer lassen für keine Änderung" : ""}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {(!isEdit || form.password) && (
          <div>
            <Label required={!isEdit}>Passwort bestätigen</Label>
            <input
              className="input"
              type={showPw ? "text" : "password"}
              required={!isEdit}
              value={form.passwordConfirm}
              onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
            />
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn-primary">
            <Users size={14} />
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
