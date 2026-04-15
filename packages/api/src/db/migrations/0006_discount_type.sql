ALTER TABLE document_line_items ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'pct';
ALTER TABLE documents ADD COLUMN global_discount_type TEXT NOT NULL DEFAULT 'pct';
