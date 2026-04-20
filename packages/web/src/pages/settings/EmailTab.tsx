import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CompanySettings } from "@honeybill/shared";
import {
  DEFAULT_EMAIL_SETTINGS, type UpdateEmailSettingsInput,
  EMAIL_PLACEHOLDERS,
} from "@honeybill/shared";
import { useEffect, useState } from "react";
import { CheckCircle, Mail, Send, Eye, EyeOff } from "lucide-react";
import { useCan } from "@/api/hooks/usePermissions";

export function EmailTab() {
  const qc = useQueryClient();
  const { can } = useCan();
  const canEdit = can("settings.email", "edit");
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: company, isLoading } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => api.get("/settings/company"),
  });

  const [settings, setSettings] = useState<UpdateEmailSettingsInput>(() => ({
    ...DEFAULT_EMAIL_SETTINGS,
    smtp: DEFAULT_EMAIL_SETTINGS.smtp ?? null,
  }));

  useEffect(() => {
    if (company?.emailSettings) {
      setSettings({ ...DEFAULT_EMAIL_SETTINGS, ...company.emailSettings });
    } else if (company?.email) {
      setSettings((s) => ({
        ...s,
        smtp: s.smtp ? s.smtp : { host: "", port: 587, secure: false, user: "", password: "", fromName: company.name ?? "", fromAddress: company.email ?? "" },
      }));
    }
  }, [company]);

  const saveEmail = useMutation({
    mutationFn: (data: UpdateEmailSettingsInput) => api.put("/settings/company/email", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleTest = async () => {
    if (!testEmail) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      await api.post("/settings/company/email/test", { to: testEmail });
      setTestResult({ ok: true });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  const setSmtp = <K extends keyof NonNullable<UpdateEmailSettingsInput["smtp"]>>(
    key: K,
    val: NonNullable<UpdateEmailSettingsInput["smtp"]>[K]
  ) => setSettings((s) => ({ ...s, smtp: { ...(s.smtp ?? { host: "", port: 587, secure: false, user: "", password: "", fromName: "", fromAddress: "" }), [key]: val } }));



  if (isLoading) return <div className="py-8 text-center text-gray-400">Laden…</div>;

  return (
    <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-60">
      {/* Provider selection */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Mail size={16} /> Versandmethode
        </h2>
        <div className="flex gap-4">
          {(["smtp", "outlook"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value={p}
                checked={settings.provider === p}
                onChange={() => setSettings((s) => ({ ...s, provider: p }))}
              />
              <span className="text-sm font-medium">
                {p === "smtp" ? "SMTP (eigener Mailserver)" : "Outlook / Standard-E-Mail-Client"}
              </span>
            </label>
          ))}
        </div>
        {settings.provider === "outlook" && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Im Outlook-Modus wird beim Versand ein <code>mailto:</code>-Link geöffnet.
            Das PDF muss manuell als Anhang hinzugefügt werden.
          </p>
        )}
      </div>

      {/* SMTP config */}
      {settings.provider === "smtp" && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">SMTP-Konfiguration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-[1fr_120px_auto] gap-3 items-end">
              <div>
                <label className="label">Postausgangsserver (Host)</label>
                <input value={settings.smtp?.host ?? ""} onChange={(e) => setSmtp("host", e.target.value)} className="input" placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="label">Port</label>
                <input type="number" value={settings.smtp?.port ?? 587} onChange={(e) => setSmtp("port", Number(e.target.value))} className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                <input type="checkbox" checked={settings.smtp?.secure ?? false} onChange={(e) => setSmtp("secure", e.target.checked)} />
                SSL/TLS
              </label>
            </div>
            <div>
              <label className="label">Benutzername / E-Mail</label>
              <input value={settings.smtp?.user ?? ""} onChange={(e) => setSmtp("user", e.target.value)} className="input" autoComplete="username" />
            </div>
            <div>
              <label className="label">Passwort</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={settings.smtp?.password ?? ""}
                  onChange={(e) => setSmtp("password", e.target.value)}
                  className="input pr-9"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Absendername</label>
              <input value={settings.smtp?.fromName ?? ""} onChange={(e) => setSmtp("fromName", e.target.value)} className="input" placeholder="Meine Firma GmbH" />
            </div>
            <div>
              <label className="label">Absender-E-Mail</label>
              <input type="email" value={settings.smtp?.fromAddress ?? ""} onChange={(e) => setSmtp("fromAddress", e.target.value)} className="input" />
            </div>
          </div>

          {/* Test */}
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Testempfänger eingeben…"
              className="input max-w-xs"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testLoading || !testEmail}
              className="btn-secondary text-sm"
            >
              <Send size={14} /> {testLoading ? "Sende…" : "Test-E-Mail"}
            </button>
            {testResult && (
              <span className={`text-sm flex items-center gap-1 ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                {testResult.ok ? <><CheckCircle size={14} /> Erfolgreich gesendet</> : <>Fehler: {testResult.message}</>}
              </span>
            )}
          </div>
        </div>
      )}

      {/* E-Mail-Vorlagen */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Vorlagen</h2>
        <div className="flex gap-6">
          {/* Fields */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="label">Standard-Betreff</label>
              <input
                value={settings.defaultSubject}
                onChange={(e) => setSettings((s) => ({ ...s, defaultSubject: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Standard-E-Mail-Text</label>
              <textarea
                rows={10}
                value={settings.defaultBody}
                onChange={(e) => setSettings((s) => ({ ...s, defaultBody: e.target.value }))}
                className="input font-mono text-xs w-full resize-y"
              />
            </div>
          </div>
          {/* Placeholder sidebar */}
          <div className="w-64 shrink-0 border-l border-gray-100 pl-4 space-y-4 overflow-y-auto max-h-[600px]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Platzhalter</p>
            {(["Dokument", "Kunde", "Firma", "Mitarbeiter"] as const).map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-700 mb-1">{group}</p>
                <div className="space-y-1">
                  {EMAIL_PLACEHOLDERS.filter((p) => p.group === group).map((p) => (
                    <div key={p.key}>
                      <span className="font-mono text-xs text-honey-700 block leading-tight">{p.key}</span>
                      <span className="text-xs text-gray-400">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => saveEmail.mutate({ ...settings, smtp: settings.provider === "outlook" ? null : settings.smtp })} disabled={saveEmail.isPending} className="btn-primary">
          {saveEmail.isPending ? "Speichern…" : "Speichern"}
        </button>
        {saved && <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Gespeichert</span>}
        {saveEmail.isError && <span className="text-red-600 text-sm">{(saveEmail.error as Error)?.message}</span>}
      </div>
    </fieldset>
  );
}
