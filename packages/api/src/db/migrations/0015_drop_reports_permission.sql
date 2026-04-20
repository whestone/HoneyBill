-- "reports" wurde aus der Rechte-Matrix entfernt — es gab nie ein Modul,
-- das dieses Recht geprueft hat. Bestehende Seed-Zeilen aufraeumen.
DELETE FROM role_permissions WHERE resource = 'reports';
