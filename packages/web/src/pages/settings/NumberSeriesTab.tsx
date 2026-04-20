import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { NumberSeries } from "@honeybill/shared";
import { useState } from "react";
import { CheckCircle, Hash } from "lucide-react";
import { useCan } from "@/api/hooks/usePermissions";

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Rechnung",
  QUOTE: "Angebot",
  DELIVERY_NOTE: "Lieferschein",
  CREDIT_NOTE: "Gutschrift",
};

const FORMAT_VARS = [
  { key: "{YYYY}", label: "Vierstelliges Jahr", example: "2026" },
  { key: "{YY}", label: "Zweistelliges Jahr", example: "26" },
  { key: "{MM}", label: "Monat", example: "04" },
  { key: "{NNNNN}", label: "Zähler (5 Stellen)", example: "00001" },
  { key: "{NNN}", label: "Zähler (3 Stellen)", example: "001" },
  { key: "{N}", label: "Zähler (keine Auffüllung)", example: "1" },
];

export function NumberSeriesTab() {
  const qc = useQueryClient();
  const { can } = useCan();
  const canEdit = can("settings.numbering", "edit");
  const { data: series = [], isLoading } = useQuery<NumberSeries[]>({
    queryKey: ["number-series"],
    queryFn: () => api.get("/number-series"),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Legen Sie das Format für Belegnummern fest. Verwenden Sie Variablen wie <code className="font-mono text-xs bg-gray-100 px-1 rounded">{"{YYYY}"}</code>, <code className="font-mono text-xs bg-gray-100 px-1 rounded">{"{MM}"}</code> und <code className="font-mono text-xs bg-gray-100 px-1 rounded">{"{NNNNN}"}</code> (Anzahl N = Stellen mit führenden Nullen).
      </p>
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Laden…</div>
      ) : (
        <div className="space-y-4">
          {series.map((s) => (
            <NumberSeriesCard key={s.documentType} series={s} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["number-series"] })} />
          ))}
        </div>
      )}
      {/* Variable reference */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Verfügbare Variablen</p>
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_VARS.map((v) => (
            <div key={v.key} className="flex items-center gap-3">
              <code className="font-mono text-xs text-honey-700 bg-honey-50 px-2 py-0.5 rounded min-w-[80px]">{v.key}</code>
              <span className="text-xs text-gray-500">{v.label} <span className="text-gray-400">({v.example})</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberSeriesCard({ series, canEdit, onSaved }: { series: NumberSeries; canEdit: boolean; onSaved: () => void }) {
  const defaultFormat = (() => {
    if (series.format) return series.format;
    const padStr = "N".repeat(series.padding || 5);
    let mid = "";
    if (series.yearSegment && series.monthSegment) mid = "{YYYY}-{MM}-";
    else if (series.yearSegment) mid = "{YYYY}-";
    else if (series.monthSegment) mid = "{MM}-";
    return `${series.prefix}${mid}{${padStr}}${series.suffix}`;
  })();

  const [format, setFormat] = useState(defaultFormat);
  const [nextCounter, setNextCounter] = useState(String(series.nextCounter));
  // "never" | "yearly" | "monthly" — monatlich hat Vorrang wenn beides in der DB steht.
  const [resetPeriod, setResetPeriod] = useState<"never" | "yearly" | "monthly">(
    series.resetMonthly ? "monthly" : series.resetYearly ? "yearly" : "never",
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const hasNPlaceholder = /\{N+\}/.test(format);

  const fetchPreview = async (fmt: string) => {
    try {
      const res = await api.post(`/number-series/${series.documentType}/preview`, { format: fmt });
      setPreview((res as any).preview);
    } catch {
      setPreview(null);
    }
  };

  const handleFormatChange = (val: string) => {
    setFormat(val);
    if (/\{N+\}/.test(val)) fetchPreview(val);
    else setPreview(null);
  };

  const handleSave = async () => {
    if (!hasNPlaceholder) { setError("Format muss mindestens einen Zähler-Platzhalter enthalten (z.B. {NNNNN})"); return; }
    setError("");
    setSaving(true);
    try {
      await api.put(`/number-series/${series.documentType}`, {
        format,
        nextCounter: Number(nextCounter),
        resetYearly: resetPeriod === "yearly",
        resetMonthly: resetPeriod === "monthly",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-honey-500" />
        <h3 className="font-semibold text-gray-900">{DOC_TYPE_LABELS[series.documentType] ?? series.documentType}</h3>
      </div>
      <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-4 disabled:opacity-60">
        <div className="col-span-2">
          <label className="label">Format</label>
          <input
            className={`input font-mono ${!hasNPlaceholder && format ? "border-red-300 bg-red-50" : ""}`}
            value={format}
            onChange={(e) => handleFormatChange(e.target.value)}
            placeholder="z.B. RE-{YYYY}-{NNNNN}"
          />
          {preview && (
            <p className="text-xs text-gray-500 mt-1">
              Vorschau: <span className="font-mono font-semibold text-honey-700">{preview}</span>
            </p>
          )}
          {!hasNPlaceholder && format && (
            <p className="text-xs text-red-500 mt-1">Kein Zähler-Platzhalter gefunden (z.B. {"{NNNNN}"})</p>
          )}
        </div>
        <div>
          <label className="label">Nächste Nummer</label>
          <input
            className="input"
            type="number"
            min={1}
            value={nextCounter}
            onChange={(e) => setNextCounter(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Zähler zurücksetzen</label>
          <select
            className="input"
            value={resetPeriod}
            onChange={(e) => setResetPeriod(e.target.value as "never" | "yearly" | "monthly")}
          >
            <option value="never">Nie</option>
            <option value="yearly">Jährlich (Jan. = 1)</option>
            <option value="monthly">Monatlich (1. des Monats = 1)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {resetPeriod === "monthly" && "Tipp: {MM} im Format verwenden, damit Nummern pro Monat eindeutig bleiben."}
            {resetPeriod === "yearly" && "Tipp: {YYYY} im Format verwenden, damit Nummern pro Jahr eindeutig bleiben."}
          </p>
        </div>
      </fieldset>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !hasNPlaceholder || !canEdit}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {saved && <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Gespeichert</span>}
      </div>
    </div>
  );
}
