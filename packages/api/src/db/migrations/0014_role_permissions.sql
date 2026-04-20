-- Rollen-Rechte-Matrix: pro (Rolle × Ressource) separate view/edit-Flags.
-- Admins umgehen die Pruefung im Service-Layer immer (nicht ueber DB steuerbar,
-- um Lockout zu verhindern).
CREATE TABLE IF NOT EXISTS role_permissions (
  role       TEXT NOT NULL,
  resource   TEXT NOT NULL,
  can_view   INTEGER NOT NULL DEFAULT 0,
  can_edit   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (role, resource)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Seed: sinnvolle Defaults fuer accountant + viewer.
-- Ressourcen: documents, customers, products, openItems, reports,
--             settings.company, settings.taxRates, settings.numbering,
--             settings.pdfLayout, settings.email

-- accountant: darf alles ausser Einstellungen editieren
INSERT OR IGNORE INTO role_permissions (role, resource, can_view, can_edit) VALUES
  ('accountant', 'documents',          1, 1),
  ('accountant', 'customers',          1, 1),
  ('accountant', 'products',           1, 1),
  ('accountant', 'openItems',          1, 1),
  ('accountant', 'reports',            1, 0),
  ('accountant', 'settings.company',   1, 0),
  ('accountant', 'settings.taxRates',  1, 0),
  ('accountant', 'settings.numbering', 1, 0),
  ('accountant', 'settings.pdfLayout', 1, 0),
  ('accountant', 'settings.email',     1, 0);

-- viewer: sieht operative Bereiche, editiert nichts, keine Einstellungen
INSERT OR IGNORE INTO role_permissions (role, resource, can_view, can_edit) VALUES
  ('viewer', 'documents',          1, 0),
  ('viewer', 'customers',          1, 0),
  ('viewer', 'products',           1, 0),
  ('viewer', 'openItems',          1, 0),
  ('viewer', 'reports',            1, 0),
  ('viewer', 'settings.company',   0, 0),
  ('viewer', 'settings.taxRates',  0, 0),
  ('viewer', 'settings.numbering', 0, 0),
  ('viewer', 'settings.pdfLayout', 0, 0),
  ('viewer', 'settings.email',     0, 0);
