-- Trennt Benutzername (users.email, wird zum Login verwendet und darf freier
-- Text sein) von einer optionalen Kontakt-E-Mail, die in E-Mail-Vorlagen als
-- {{mitarbeiterEmail}} eingesetzt werden kann.
ALTER TABLE users ADD COLUMN email_address TEXT;
