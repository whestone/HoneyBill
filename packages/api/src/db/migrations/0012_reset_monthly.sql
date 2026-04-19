-- Monatlicher Reset fuer Nummernkreise
--
-- Zusaetzlich zum bestehenden reset_yearly laesst sich der Zaehler nun auch
-- monatlich zuruecksetzen. Beide Flags sind unabhaengig; wenn beide aktiv sind,
-- greift der striktere (monatlich) zuerst.
ALTER TABLE number_series ADD COLUMN reset_monthly INTEGER NOT NULL DEFAULT 0;
