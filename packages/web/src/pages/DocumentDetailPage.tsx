import { useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import {
  useDocument,
  useFinalizeDocument,
  useSendDocument,
  useCancelDocument,
  useDeleteDocument,
  useAddPayment,
  useConvertToInvoice,
  useCreateCreditNote,
  useCreateDeliveryNote,
  useRelatedDocuments,
} from "@/api/hooks/useDocuments";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { formatEur, DOCUMENT_TYPE_LABELS, DEFAULT_EMAIL_SETTINGS } from "@honeybill/shared";
import type { CompanySettings, Document, DocumentType } from "@honeybill/shared";
import { ArrowLeft, CheckCircle, CreditCard, Edit2, FileText, Send, Truck, Trash2, XCircle, Mail } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/InvoiceTemplate";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreatePaymentSchema, type CreatePaymentInput } from "@honeybill/shared";

export function DocumentDetailPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const { data: doc, isLoading } = useDocument(Number(id));
  const { data: relatedDocs = [] } = useRelatedDocuments(Number(id));
  const { data: company } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => api.get("/settings/company"),
  });

  const finalize = useFinalizeDocument();
  const send = useSendDocument();
  const cancel = useCancelDocument();
  const deleteDoc = useDeleteDocument();
  const convertToInvoice = useConvertToInvoice();
  const createCreditNote = useCreateCreditNote();
  const createDeliveryNote = useCreateDeliveryNote();
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading || !doc) {
    return <div className="p-6 text-gray-400">Laden…</div>;
  }

  const customer = parseCustomer(doc);
  const customerName =
    customer?.companyName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "—";

  const canFinalize = doc.status === "DRAFT";
  const canSend = doc.status === "FINAL";
  const canCancel = ["FINAL", "SENT", "PARTIAL"].includes(doc.status);
  const canDelete = doc.status === "DRAFT";
  const canPay = ["FINAL", "SENT", "PARTIAL"].includes(doc.status) && doc.documentType === "INVOICE";
  const canConvertToInvoice = ["FINAL", "SENT"].includes(doc.status) && doc.documentType === "QUOTE";
  const canCreateDeliveryNote = ["FINAL", "SENT"].includes(doc.status) && ["QUOTE", "INVOICE"].includes(doc.documentType);
  const canCreditNote = ["FINAL", "SENT", "PARTIAL"].includes(doc.status) && doc.documentType === "INVOICE";

  const totalPaid = (doc.payments ?? []).reduce(
    (acc, p) => acc + parseFloat(p.amount),
    0
  );
  const finalizedCreditNotes = relatedDocs.filter(
    (d) => d.documentType === "CREDIT_NOTE" && ["FINAL", "SENT", "PAID"].includes(d.status)
  );
  const totalCredited = finalizedCreditNotes.reduce((acc, cn) => acc + parseFloat(cn.totalGross), 0);
  const openAmount = parseFloat(doc.totalGross) - totalPaid - totalCredited;

  // Derive effective display status — credit notes can settle an invoice without changing DB status
  const effectiveStatus =
    doc.documentType === "INVOICE" && ["PARTIAL", "SENT", "FINAL"].includes(doc.status) && openAmount <= 0
      ? "PAID"
      : doc.status;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/documents" })} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                {doc.documentNumber ?? "(Entwurf)"}
              </h1>
              <TypeBadge type={doc.documentType as DocumentType} />
              <StatusBadge status={effectiveStatus as any} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{customerName}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          {actionError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 max-w-sm text-right">
              {actionError}
            </div>
          )}
          <div className="flex gap-2 flex-wrap justify-end">
            {canDelete && (
              <button
                onClick={() => navigate({ to: "/documents/$id/edit", params: { id: String(doc.id) } })}
                className="btn-secondary"
              >
                <Edit2 size={14} /> Bearbeiten
              </button>
            )}
            {canFinalize && (
              <button
                onClick={() => {
                  setActionError(null);
                  finalize.mutate(doc.id, {
                    onError: (e: any) => setActionError(e?.message ?? "Fehler beim Finalisieren"),
                  });
                }}
                disabled={finalize.isPending}
                className="btn-primary"
              >
                <CheckCircle size={14} /> {finalize.isPending ? "Finalisieren…" : "Finalisieren"}
              </button>
            )}
            {canSend && (
              <button onClick={() => send.mutate(doc.id)} className="btn-secondary">
                <Send size={14} /> Als versendet markieren
              </button>
            )}
            {canPay && (
              <button onClick={() => setShowPayment(true)} className="btn-secondary">
                <CreditCard size={14} /> Zahlung erfassen
              </button>
            )}
            {canConvertToInvoice && (
              <button
                onClick={() => convertToInvoice.mutate(doc.id, {
                  onSuccess: (inv) => navigate({ to: "/documents/$id", params: { id: String(inv.id) } }),
                  onError: (e: any) => setActionError(e?.message ?? "Fehler"),
                })}
                className="btn-secondary"
              >
                <FileText size={14} /> → Rechnung
              </button>
            )}
            {canCreateDeliveryNote && (
              <button
                onClick={() => createDeliveryNote.mutate(doc.id, {
                  onSuccess: (dn) => navigate({ to: "/documents/$id", params: { id: String(dn.id) } }),
                  onError: (e: any) => setActionError(e?.message ?? "Fehler"),
                })}
                className="btn-secondary"
              >
                <Truck size={14} /> → Lieferschein
              </button>
            )}
            {canCreditNote && (
              <button
                onClick={() => createCreditNote.mutate(doc.id, {
                  onSuccess: (cn) => navigate({ to: "/documents/$id", params: { id: String(cn.id) } }),
                  onError: (e: any) => setActionError(e?.message ?? "Fehler"),
                })}
                className="btn-secondary"
              >
                <XCircle size={14} /> Gutschrift erstellen
              </button>
            )}
            <button onClick={() => setShowPdf(true)} className="btn-secondary">
              <FileText size={14} /> {doc.status === "DRAFT" ? "Vorschau" : "PDF / E-Rechnung"}
            </button>
            {doc.status !== "DRAFT" && (
              <button onClick={() => setShowEmail(true)} className="btn-secondary">
                <Mail size={14} /> E-Mail senden
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  if (!confirm("Entwurf wirklich löschen?")) return;
                  deleteDoc.mutate(doc.id, { onSuccess: () => navigate({ to: "/documents" }) });
                }}
                className="btn-danger"
              >
                <Trash2 size={14} /> Löschen
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => {
                  if (!confirm("Beleg wirklich stornieren?")) return;
                  cancel.mutate(doc.id, {
                    onError: (e: any) => setActionError(e?.message ?? "Fehler beim Stornieren"),
                  });
                }}
                className="btn-secondary text-red-600"
              >
                <XCircle size={14} /> Stornieren
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column – doc details */}
        <div className="col-span-2 space-y-4">
          {/* Meta */}
          <div className="card p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs mb-1">Ausstellungsdatum</div>
                <div>{doc.issueDate ?? "—"}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Fälligkeitsdatum</div>
                <div>{doc.dueDate ?? "—"}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Lieferdatum</div>
                <div>{doc.deliveryDate ?? "—"}</div>
              </div>
              {doc.cancelsDocumentId && (
                <div>
                  <div className="text-gray-500 text-xs mb-1">Storniert Beleg</div>
                  <Link to="/documents/$id" params={{ id: String(doc.cancelsDocumentId) }} className="text-honey-600 hover:underline">
                    #{doc.cancelsDocumentId}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-sm text-gray-900">Positionen</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-honey-50">
                  <th className="table-header">#</th>
                  <th className="table-header">Beschreibung</th>
                  <th className="table-header text-right">Menge</th>
                  <th className="table-header text-right">Einzelpr.</th>
                  <th className="table-header text-right">Rabatt</th>
                  <th className="table-header text-right">MwSt.</th>
                  <th className="table-header text-right">Netto</th>
                </tr>
              </thead>
              <tbody>
                {(doc.lineItems ?? []).map((li, idx) => (
                  <tr key={li.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50" : ""}`}>
                    <td className="table-cell text-gray-400 text-xs">{li.position + 1}</td>
                    <td className="table-cell">{li.description || <span className="text-gray-400 italic">—</span>}</td>
                    <td className="table-cell text-right">{li.quantity} {li.unit}</td>
                    <td className="table-cell text-right">{formatEur(li.unitPrice)}</td>
                    <td className="table-cell text-right">
                      {li.discountPct !== "0.00" ? `${li.discountPct}%` : "—"}
                    </td>
                    <td className="table-cell text-right">{li.taxRatePct}%</td>
                    <td className="table-cell text-right font-medium">{formatEur(li.lineNet)}</td>
                  </tr>
                ))}
                {!(doc.lineItems ?? []).length && (
                  <tr>
                    <td colSpan={7} className="table-cell text-center text-gray-400 py-6">
                      Keine Positionen
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payments */}
          {doc.documentType === "INVOICE" && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-sm text-gray-900">Zahlungen</h2>
                {canPay && (
                  <button onClick={() => setShowPayment(true)} className="btn-secondary text-xs py-1">
                    <CreditCard size={12} /> Zahlung erfassen
                  </button>
                )}
              </div>
              {(doc.payments ?? []).length === 0 ? (
                <div className="p-4 text-sm text-gray-400">Noch keine Zahlungen</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="table-header">Datum</th>
                      <th className="table-header">Methode</th>
                      <th className="table-header">Referenz</th>
                      <th className="table-header text-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(doc.payments ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td className="table-cell">{p.paymentDate}</td>
                        <td className="table-cell text-gray-500">{p.paymentMethod ?? "—"}</td>
                        <td className="table-cell text-gray-500 text-xs">{p.reference ?? "—"}</td>
                        <td className="table-cell text-right font-medium text-green-600">
                          {formatEur(p.amount)}
                        </td>
                      </tr>
                    ))}
                  {finalizedCreditNotes.map((cn) => (
                    <tr key={`cn-${cn.id}`} className="border-b border-gray-50 bg-red-50/40">
                      <td className="table-cell">{cn.issueDate ?? cn.createdAt?.slice(0, 10) ?? "—"}</td>
                      <td className="table-cell text-gray-500">
                        <Link to="/documents/$id" params={{ id: String(cn.id) }} className="text-honey-600 hover:underline text-xs">
                          Gutschrift {cn.documentNumber ?? `#${cn.id}`}
                        </Link>
                      </td>
                      <td className="table-cell text-gray-400 text-xs">Gutschrift</td>
                      <td className="table-cell text-right font-medium text-red-600">
                        −{formatEur(cn.totalGross)}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {/* Related documents */}
          {relatedDocs.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-sm text-gray-900">Verknüpfte Belege</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Nummer</th>
                    <th className="table-header">Typ</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedDocs.map((rel) => {
                    const isCreditNote = rel.documentType === "CREDIT_NOTE";
                    return (
                      <tr key={rel.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-cell">
                          <Link
                            to="/documents/$id"
                            params={{ id: String(rel.id) }}
                            className="text-honey-600 hover:underline font-mono text-xs"
                          >
                            {rel.documentNumber ?? "(Entwurf)"}
                          </Link>
                        </td>
                        <td className="table-cell">
                          <TypeBadge type={rel.documentType as DocumentType} />
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={rel.status as any} />
                        </td>
                        <td className={`table-cell text-right font-medium ${isCreditNote ? "text-red-600" : ""}`}>
                          {isCreditNote ? "−" : ""}{formatEur(rel.totalGross)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column – totals */}
        <div className="space-y-4">
          <div className="card p-4 space-y-2">
            <h2 className="font-semibold text-sm text-gray-900 mb-3">Summen</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Netto</span>
              <span>{formatEur(doc.subtotalNet)}</span>
            </div>
            {(doc.taxLines ?? []).map((tl) => (
              <div key={tl.id} className="flex justify-between text-sm">
                <span className="text-gray-500">MwSt. {tl.taxRatePct}%</span>
                <span>{formatEur(tl.taxAmount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold border-t border-honey-200 pt-2 mt-2">
              <span>Gesamt</span>
              <span className="text-honey-700">{formatEur(doc.totalGross)}</span>
            </div>
            {doc.documentType === "INVOICE" && (
              <>
                <div className="flex justify-between text-sm text-green-600 border-t border-gray-100 pt-2">
                  <span>Bezahlt</span>
                  <span>{formatEur(totalPaid.toFixed(2))}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Offen</span>
                  <span className={openAmount > 0 ? "text-red-600" : "text-green-600"}>
                    {formatEur(openAmount.toFixed(2))}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Customer */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm text-gray-900 mb-3">Kunde</h2>
            <div className="text-sm space-y-1 text-gray-600">
              <p className="font-medium text-gray-900">{customerName}</p>
              {customer?.billStreet && <p>{customer.billStreet}</p>}
              {(customer?.billZip || customer?.billCity) && (
                <p>{[customer?.billZip, customer?.billCity].filter(Boolean).join(" ")}</p>
              )}
              {customer?.vatId && <p className="text-xs text-gray-400">USt-IdNr.: {customer.vatId}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <AddPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        docId={doc.id}
        openAmount={openAmount}
      />

      {/* PDF Modal */}
      {showPdf && company && (
        <Modal open={showPdf} onClose={() => setShowPdf(false)} title="PDF / E-Rechnung" size="full">
          <div className="h-full">
            <PdfPreview doc={doc} company={company} />
          </div>
        </Modal>
      )}

      {/* E-Mail Modal */}
      {showEmail && company && (
        <SendEmailModal
          open={showEmail}
          onClose={() => setShowEmail(false)}
          doc={doc}
          company={company}
        />
      )}
    </div>
  );
}

// ─── Placeholder resolution ───────────────────────────────────────────────────

function parseCustomer(doc: Document): any {
  const raw = doc.customerSnapshot ?? (doc as any).customer;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
  return raw ?? null;
}

function resolvePlaceholders(template: string, doc: Document, company: CompanySettings): string {
  const customer = parseCustomer(doc);
  const customerName =
    customer?.companyName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "—";
  const anrede = (() => {
    const lastName = (customer?.lastName ?? "").trim();
    if (!lastName) return "Sehr geehrte Damen und Herren,";
    const sal = (customer?.salutation ?? "").toLowerCase();
    const form = sal === "frau" ? "geehrte Frau" : sal === "herr" ? "geehrter Herr" : "geehrte/r";
    return `Sehr ${form} ${lastName},`;
  })();
  const typeLabel =
    DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.documentType;
  const dueDate = doc.dueDate
    ? new Date(doc.dueDate).toLocaleDateString("de-DE")
    : "";
  const zahlungshinweis =
    doc.documentType === "INVOICE" && doc.dueDate
      ? `Bitte überweisen Sie den Betrag bis zum ${dueDate} auf unser Konto${
          company.bankIban ? ` (IBAN: ${company.bankIban})` : ""
        }.`
      : "";
  return template
    .replace(/\{\{anrede\}\}/g, anrede)
    .replace(/\{\{dokumentNummer\}\}/g, doc.documentNumber ?? "")
    .replace(/\{\{dokumentTyp\}\}/g, typeLabel)
    .replace(/\{\{kundenName\}\}/g, customerName)
    .replace(/\{\{betrag\}\}/g, formatEur(doc.totalGross))
    .replace(/\{\{faelligkeitsDatum\}\}/g, dueDate)
    .replace(/\{\{firmenName\}\}/g, company.name)
    .replace(/\{\{zahlungshinweis\}\}/g, zahlungshinweis);
}

// ─── Send E-Mail Modal ────────────────────────────────────────────────────────

function SendEmailModal({
  open, onClose, doc, company,
}: { open: boolean; onClose: () => void; doc: Document; company: CompanySettings }) {
  const emailSettings = company.emailSettings ?? DEFAULT_EMAIL_SETTINGS;
  const customer = parseCustomer(doc);
  const customerDisplayName =
    customer?.companyName ||
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
    null;

  const [to, setTo] = useState(customer?.email ?? "");
  const [subject, setSubject] = useState(() =>
    resolvePlaceholders(emailSettings.defaultSubject, doc, company)
  );
  const [body, setBody] = useState(() =>
    resolvePlaceholders(emailSettings.defaultBody, doc, company)
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      if (emailSettings.provider === "outlook") {
        const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoUrl, "_blank");
        setResult({ ok: true });
        return;
      }
      // SMTP: generate PDF blob and post as multipart
      const pdfBlob = await pdf(<InvoicePDF doc={doc} company={company} />).toBlob();
      const form = new FormData();
      form.append("to", to);
      form.append("subject", subject);
      form.append("body", body);
      form.append("attachPdf", "true");
      form.append("file", pdfBlob, `${doc.documentNumber ?? "dokument"}.pdf`);
      const token = JSON.parse(localStorage.getItem("honeybill-auth") ?? "{}").state?.token ?? "";
      const res = await fetch("/api/v1/settings/company/email/send-document", {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Fehler beim Senden");
      }
      setResult({ ok: true });
    } catch (e: any) {
      setResult({ ok: false, message: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="E-Mail senden" size="xl">
      <div className="space-y-4">
          {emailSettings.provider === "outlook" && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Outlook-Modus: Es wird ein mailto-Link geöffnet. Das PDF bitte manuell anhängen.
            </p>
          )}
          <div>
            <label className="label">Empfänger</label>
            {customerDisplayName && (
              <p className="text-xs text-gray-500 mb-1">{customerDisplayName}</p>
            )}
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Betreff</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Text</label>
            <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="input w-full resize-y font-mono text-xs" />
          </div>
          {emailSettings.provider === "smtp" && (
            <p className="text-xs text-gray-500">
              Das PDF wird automatisch als Anhang beigefügt ({doc.documentNumber ?? "Entwurf"}.pdf).
            </p>
          )}
          {result && (
            <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
              {result.ok
                ? emailSettings.provider === "outlook"
                  ? "E-Mail-Client geöffnet."
                  : "E-Mail erfolgreich gesendet."
                : `Fehler: ${result.message}`}
            </p>
          )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="button" onClick={handleSend} disabled={sending || !to} className="btn-primary">
            <Send size={14} />
            {sending ? "Wird gesendet…" : emailSettings.provider === "outlook" ? "Öffnen" : "Senden"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddPaymentModal({
  open,
  onClose,
  docId,
  openAmount,
}: {
  open: boolean;
  onClose: () => void;
  docId: number;
  openAmount: number;
}) {
  const addPayment = useAddPayment(docId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePaymentInput>({
    resolver: zodResolver(CreatePaymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: openAmount > 0 ? openAmount.toFixed(2) : "0.00",
      paymentMethod: "BANK_TRANSFER",
    },
  });

  const onSubmit = (data: CreatePaymentInput) => {
    addPayment.mutate(data, { onSuccess: () => { reset(); onClose(); } });
  };

  return (
    <Modal open={open} onClose={onClose} title="Zahlung erfassen">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Datum</label>
            <input {...register("paymentDate")} type="date" className="input" />
          </div>
          <div>
            <label className="label">Betrag (€)</label>
            <input {...register("amount")} type="number" step="0.01" min="0.01" className="input" />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="label">Zahlungsart</label>
            <select {...register("paymentMethod")} className="input">
              <option value="BANK_TRANSFER">Überweisung</option>
              <option value="CASH">Bar</option>
              <option value="DIRECT_DEBIT">Lastschrift</option>
              <option value="PAYPAL">PayPal</option>
              <option value="OTHER">Sonstige</option>
            </select>
          </div>
          <div>
            <label className="label">Referenz</label>
            <input {...register("reference")} className="input" placeholder="Verwendungszweck" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button type="submit" disabled={addPayment.isPending} className="btn-primary">
            {addPayment.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
