import { usePDF, pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "./InvoiceTemplate";
import type { Document as HBDocument, CompanySettings } from "@honeybill/shared";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { useState } from "react";

interface PdfPreviewProps {
  doc: HBDocument;
  company: CompanySettings;
}

export function PdfPreview({ doc, company }: PdfPreviewProps) {
  const [loadingZugferd, setLoadingZugferd] = useState(false);
  const [instance] = usePDF({ document: <InvoicePDF doc={doc} company={company} /> });

  const handleDownloadPdf = async () => {
    const blob = await pdf(<InvoicePDF doc={doc} company={company} />).toBlob();
    downloadBlob(blob, `${doc.documentNumber ?? "entwurf"}.pdf`);
  };

  const handlePrint = async () => {
    const blob = await pdf(<InvoicePDF doc={doc} company={company} />).toBlob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => {
        win.focus();
        win.print();
      };
    }
    // Revoke after a delay to allow printing
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleDownloadZugferd = async () => {
    setLoadingZugferd(true);
    try {
      const blob = await pdf(<InvoicePDF doc={doc} company={company} />).toBlob();
      const form = new FormData();
      form.append("file", blob, "invoice.pdf");
      const token = JSON.parse(localStorage.getItem("honeybill-auth") ?? "{}").state?.token ?? "";
      const res = await fetch(`/api/v1/documents/${doc.id}/zugferd-pdf`, {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("ZUGFeRD packaging failed");
      const pdfBlob = await res.blob();
      downloadBlob(pdfBlob, `zugferd-${doc.documentNumber}.pdf`);
    } finally {
      setLoadingZugferd(false);
    }
  };

  const handleDownloadXrechnung = () => {
    const token = JSON.parse(localStorage.getItem("honeybill-auth") ?? "{}").state?.token ?? "";
    fetch(`/api/v1/documents/${doc.id}/xrechnung-xml`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => downloadBlob(blob, `xrechnung-${doc.documentNumber}.xml`));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Actions */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-white flex-wrap">
        <button onClick={handlePrint} className="btn-primary text-xs">
          <Printer size={14} /> Drucken
        </button>
        <button onClick={handleDownloadPdf} className="btn-secondary text-xs">
          <Download size={14} /> PDF speichern
        </button>
        {doc.status !== "DRAFT" && (
          <>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <button
              onClick={handleDownloadZugferd}
              disabled={loadingZugferd}
              className="btn-secondary text-xs"
            >
              <FileText size={14} />
              {loadingZugferd ? "…" : "ZUGFeRD PDF"}
            </button>
            <button onClick={handleDownloadXrechnung} className="btn-secondary text-xs">
              <FileText size={14} /> XRechnung XML
            </button>
          </>
        )}
        {doc.status === "DRAFT" && (
          <span className="text-xs text-amber-600 ml-2">
            Entwurf — Dokument vor dem Finalisieren in der Vorschau prüfen
          </span>
        )}
      </div>
      {/* Preview */}
      <div className="flex-1 min-h-0">
        {instance.loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> PDF wird generiert…
          </div>
        ) : instance.error ? (
          <div className="flex items-center justify-center h-full text-red-500 text-sm px-6 text-center">
            Fehler beim Generieren: {String(instance.error)}
          </div>
        ) : (
          <object
            data={instance.url ?? undefined}
            type="application/pdf"
            style={{ width: "100%", height: "100%" }}
          >
            <embed
              src={instance.url ?? undefined}
              type="application/pdf"
              style={{ width: "100%", height: "100%" }}
            />
          </object>
        )}
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
