-- Composite-Indexes fuer haeufige Filter-Kombinationen in Listen-Views
-- documents: Filter nach customer + type + status kommt in GET /documents vor.
-- Single-column Indexes existieren bereits (idx_documents_customer/type/status),
-- aber ein Composite reduziert Index-Scans bei Mehrfach-Filtern signifikant.
CREATE INDEX IF NOT EXISTS idx_documents_customer_type_status
  ON documents(customer_id, document_type, status);

-- Fuer Dashboard-Widgets (offene Rechnungen nach Datum)
CREATE INDEX IF NOT EXISTS idx_documents_status_due
  ON documents(status, due_date)
  WHERE status IN ('SENT', 'PARTIALLY_PAID', 'OVERDUE');
