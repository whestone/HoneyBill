-- GoBD-konformer, unveränderbarer Audit-Trail
--
-- Jeder Audit-Eintrag enthält `prev_hash` (hash des Vorgänger-Eintrags) und `hash`
-- (SHA-256 über prev_hash || canonical-JSON der Inhaltsfelder). Damit ist die
-- Kette fälschungssicher: jede nachträgliche Änderung bricht den Hash-Chain.
--
-- Trigger blockieren UPDATE und DELETE auf der Tabelle, damit selbst mit direktem
-- DB-Zugriff keine Einträge verändert oder gelöscht werden können. Für legitime
-- Wartungsaufgaben müssten die Trigger erst per Migration entfernt werden - was
-- selbst wieder in der Versionsgeschichte sichtbar ist.

ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_log ADD COLUMN hash TEXT;

-- Index für Kettenprüfung
CREATE INDEX IF NOT EXISTS idx_audit_hash ON audit_log(hash);

-- UPDATE blockieren
CREATE TRIGGER IF NOT EXISTS audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log ist unveraenderbar (GoBD)');
END;

-- DELETE blockieren
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log-Eintraege duerfen nicht geloescht werden (GoBD)');
END;
