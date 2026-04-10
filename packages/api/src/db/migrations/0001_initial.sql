-- HoneyBill Initial Schema Migration
-- Run once on first setup

CREATE TABLE IF NOT EXISTS company_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  name                 TEXT NOT NULL DEFAULT 'Meine Firma',
  legal_form           TEXT,
  street               TEXT,
  zip                  TEXT,
  city                 TEXT,
  country              TEXT NOT NULL DEFAULT 'DE',
  vat_id               TEXT,
  tax_number           TEXT,
  bank_iban            TEXT,
  bank_bic             TEXT,
  bank_name            TEXT,
  email                TEXT,
  phone                TEXT,
  website              TEXT,
  logo_path            TEXT,
  default_currency     TEXT NOT NULL DEFAULT 'EUR',
  default_payment_days INTEGER NOT NULL DEFAULT 14,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER,
  old_data     TEXT,
  new_data     TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS tax_rates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  rate_percent TEXT NOT NULL,
  tax_category TEXT NOT NULL DEFAULT 'S',
  valid_from   TEXT NOT NULL,
  valid_to     TEXT,
  is_default   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_validity ON tax_rates(valid_from, valid_to);

CREATE TABLE IF NOT EXISTS customers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_number  TEXT NOT NULL UNIQUE,
  company_name     TEXT,
  salutation       TEXT,
  first_name       TEXT,
  last_name        TEXT,
  email            TEXT,
  phone            TEXT,
  bill_street      TEXT,
  bill_zip         TEXT,
  bill_city        TEXT,
  bill_country     TEXT NOT NULL DEFAULT 'DE',
  ship_street      TEXT,
  ship_zip         TEXT,
  ship_city        TEXT,
  ship_country     TEXT,
  vat_id           TEXT,
  tax_exempt       INTEGER NOT NULL DEFAULT 0,
  reverse_charge   INTEGER NOT NULL DEFAULT 0,
  payment_days     INTEGER NOT NULL DEFAULT 14,
  leitweg_id       TEXT,
  notes            TEXT,
  is_archived      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_number   ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_archived ON customers(is_archived);

CREATE TABLE IF NOT EXISTS product_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  unit        TEXT NOT NULL DEFAULT 'Stk',
  unit_price  TEXT NOT NULL DEFAULT '0.00',
  tax_rate_id INTEGER NOT NULL REFERENCES tax_rates(id),
  category_id INTEGER REFERENCES product_categories(id),
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);

CREATE TABLE IF NOT EXISTS number_series (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type  TEXT NOT NULL UNIQUE,
  prefix         TEXT NOT NULL DEFAULT '',
  suffix         TEXT NOT NULL DEFAULT '',
  year_segment   INTEGER NOT NULL DEFAULT 1,
  month_segment  INTEGER NOT NULL DEFAULT 0,
  padding        INTEGER NOT NULL DEFAULT 5,
  next_counter   INTEGER NOT NULL DEFAULT 1,
  last_reset_at  TEXT,
  reset_yearly   INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  document_type TEXT,
  html_content  TEXT NOT NULL,
  css_content   TEXT NOT NULL DEFAULT '',
  is_default    INTEGER NOT NULL DEFAULT 0,
  version       INTEGER NOT NULL DEFAULT 1,
  parent_id     INTEGER REFERENCES document_templates(id),
  created_by    INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_templates_type    ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_templates_default ON document_templates(is_default);

CREATE TABLE IF NOT EXISTS documents (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type        TEXT NOT NULL,
  document_number      TEXT UNIQUE,
  status               TEXT NOT NULL DEFAULT 'DRAFT',
  customer_id          INTEGER NOT NULL REFERENCES customers(id),
  customer_snapshot    TEXT,
  issue_date           TEXT,
  delivery_date        TEXT,
  delivery_date_end    TEXT,
  due_date             TEXT,
  quote_valid_until    TEXT,
  source_document_id   INTEGER REFERENCES documents(id),
  cancels_document_id  INTEGER REFERENCES documents(id),
  subtotal_net         TEXT NOT NULL DEFAULT '0.00',
  total_tax            TEXT NOT NULL DEFAULT '0.00',
  total_gross          TEXT NOT NULL DEFAULT '0.00',
  currency             TEXT NOT NULL DEFAULT 'EUR',
  payment_days         INTEGER,
  payment_terms_text   TEXT,
  template_id          INTEGER REFERENCES document_templates(id),
  einvoice_profile     TEXT,
  leitweg_id           TEXT,
  internal_notes       TEXT,
  created_by           INTEGER REFERENCES users(id),
  finalized_by         INTEGER REFERENCES users(id),
  finalized_at         TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_type     ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status   ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_number   ON documents(document_number);
CREATE INDEX IF NOT EXISTS idx_documents_source   ON documents(source_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_created  ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_due      ON documents(due_date);

CREATE TABLE IF NOT EXISTS document_line_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  line_type        TEXT NOT NULL DEFAULT 'ITEM',
  product_id       INTEGER REFERENCES products(id),
  product_snapshot TEXT,
  description      TEXT NOT NULL DEFAULT '',
  quantity         TEXT NOT NULL DEFAULT '1',
  unit             TEXT NOT NULL DEFAULT 'Stk',
  unit_price       TEXT NOT NULL DEFAULT '0.00',
  discount_pct     TEXT NOT NULL DEFAULT '0.00',
  tax_rate_id      INTEGER REFERENCES tax_rates(id),
  tax_rate_pct     TEXT NOT NULL DEFAULT '0.00',
  line_net         TEXT NOT NULL DEFAULT '0.00',
  line_tax         TEXT NOT NULL DEFAULT '0.00',
  line_gross       TEXT NOT NULL DEFAULT '0.00',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_line_items_document ON document_line_items(document_id, position);

CREATE TABLE IF NOT EXISTS document_tax_lines (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id    INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tax_rate_id    INTEGER REFERENCES tax_rates(id),
  tax_rate_pct   TEXT NOT NULL,
  tax_category   TEXT NOT NULL DEFAULT 'S',
  taxable_amount TEXT NOT NULL DEFAULT '0.00',
  tax_amount     TEXT NOT NULL DEFAULT '0.00'
);

CREATE INDEX IF NOT EXISTS idx_tax_lines_document ON document_tax_lines(document_id);

CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id    INTEGER NOT NULL REFERENCES documents(id),
  payment_date   TEXT NOT NULL,
  amount         TEXT NOT NULL,
  payment_method TEXT,
  reference      TEXT,
  notes          TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_document ON payments(document_id);
CREATE INDEX IF NOT EXISTS idx_payments_date     ON payments(payment_date);

CREATE TABLE IF NOT EXISTS document_files (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_type        TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  file_size        INTEGER,
  mime_type        TEXT NOT NULL DEFAULT 'application/pdf',
  checksum_sha256  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_files_document ON document_files(document_id);
