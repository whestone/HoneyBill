-- Bereinigung: nur den neuesten aktiven Standardsatz behalten
UPDATE tax_rates SET is_default = 0
WHERE is_default = 1
  AND id IS NOT (
    SELECT id FROM tax_rates
    WHERE is_default = 1
      AND (valid_to IS NULL OR valid_to = '')
    ORDER BY valid_from DESC
    LIMIT 1
  );
