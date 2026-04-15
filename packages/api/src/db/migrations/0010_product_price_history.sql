CREATE TABLE product_price_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_price TEXT    NOT NULL,
  valid_from TEXT    NOT NULL,
  valid_to   TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Bestehende Preise als ersten Historieneintrag (gültig ab Erstellungsdatum)
INSERT INTO product_price_history (product_id, unit_price, valid_from)
SELECT id, unit_price, DATE(created_at)
FROM products;
