# 🍯 HoneyBill

Einfache, selbst gehostete Rechnungssoftware für Deutschland – mit ZUGFeRD- und XRechnung-Unterstützung.

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Installation](#installation)
3. [Starten](#starten)
4. [Konfiguration](#konfiguration)
5. [Handbuch](#handbuch)
   - [Erster Start](#erster-start)
   - [Dashboard](#dashboard)
   - [Kunden](#kunden)
   - [Produkte](#produkte)
   - [Belege](#belege)
   - [Offene Posten](#offene-posten)
   - [Einstellungen](#einstellungen)
6. [Belegworkflow](#belegworkflow)
7. [E-Rechnung (ZUGFeRD / XRechnung)](#e-rechnung-zugferd--xrechnung)
8. [Technologie-Stack](#technologie-stack)
9. [Verfügbare Skripte](#verfügbare-skripte)

---

## Voraussetzungen

| Software | Mindestversion |
|----------|---------------|
| Node.js  | 20.0.0        |
| pnpm     | 9.0.0         |

```bash
# Node.js Version prüfen
node --version

# pnpm installieren (falls nicht vorhanden)
npm install -g pnpm
```

---

## Installation

```bash
# 1. Repository klonen
git clone https://github.com/whestone/HoneyBill.git
cd HoneyBill

# 2. Abhängigkeiten installieren, Datenbank migrieren und Demo-Daten laden
pnpm setup
```

`pnpm setup` führt automatisch aus:
- `pnpm install` — alle Pakete installieren
- `pnpm migrate` — Datenbankschema anlegen
- `pnpm seed` — Standarddaten einspielen (Steuersätze, Nummernkreise, Admin-Account)

---

## Starten

```bash
# Entwicklungsmodus (API + Web gleichzeitig)
pnpm dev
```

| Dienst | URL |
|--------|-----|
| Web-Oberfläche | http://localhost:5173 |
| API | http://localhost:3001 |

### Standard-Zugangsdaten

| Feld | Wert |
|------|------|
| Benutzername | `admin` |
| Passwort | `admin` |

> **Hinweis:** Passwort nach dem ersten Login unter **Einstellungen → Benutzer** ändern.

---

## Konfiguration

Die API liest Umgebungsvariablen aus dem Prozess. Diese können in einer `.env`-Datei im Stammverzeichnis oder direkt in der Shell gesetzt werden:

| Variable | Standard | Beschreibung |
|----------|----------|-------------|
| `PORT` | `3001` | API-Port |
| `HOST` | `127.0.0.1` | API-Host |
| `JWT_SECRET` | `REDACTED-SECRET` | JWT-Signaturschlüssel |
| `DATA_DIR` | `./data` | Verzeichnis für Datenbank, Uploads und Exports |
| `NODE_ENV` | `development` | `development` oder `production` |

> **Produktivbetrieb:** `JWT_SECRET` unbedingt durch einen langen, zufälligen Wert ersetzen.

### Datenbankmigrationen

Neue Migrationen werden mit folgendem Befehl eingespielt:

```bash
pnpm migrate
```

---

## Handbuch

### Erster Start

1. Browser öffnen: http://localhost:5173
2. Mit `admin` / `admin` anmelden
3. Unter **Einstellungen → Firmendaten** die eigenen Stammdaten eintragen
4. Logo hochladen (PNG, JPG oder SVG, max. 2 MB)
5. IBAN und BIC hinterlegen – diese erscheinen automatisch auf Rechnungen
6. Steuersätze prüfen und ggf. anpassen
7. E-Mail-Versand konfigurieren (optional)

---

### Dashboard

Das Dashboard zeigt auf einen Blick:

- **Gesamtumsatz** — Summe aller bezahlten und offenen Rechnungen
- **Offene Posten** — Summe unbezahlter Rechnungen
- **Überfällige Rechnungen** — Rechnungen deren Fälligkeit überschritten ist
- **Letzte Belege** — Schnellzugriff auf die zuletzt bearbeiteten Dokumente

---

### Kunden

Unter **Kunden** werden alle Geschäftspartner verwaltet.

#### Kundendaten

| Feld | Beschreibung |
|------|-------------|
| Kundennummer | Wird automatisch vergeben (KD-00001) |
| Firmenname / Name | Juristische oder natürliche Person |
| Rechnungsadresse | Straße, PLZ, Ort, Land (ISO-Code, z. B. DE) |
| Lieferadresse | Optional, abweichende Lieferadresse |
| USt-IdNr. | Für Reverse-Charge und EU-Geschäfte |
| Steuerfrei | Schaltet Steuerberechnung aus |
| Reverse Charge | Umsatzsteuerumkehr (§ 13b UStG) |
| Zahlungsziel | Kundenseitig abweichendes Zahlungsziel in Tagen |
| Leitweg-ID | Pflichtfeld für XRechnung an öffentliche Auftraggeber |

#### Zahlungsziel-Hierarchie

Das Zahlungsziel wird in folgender Reihenfolge aufgelöst:

1. Manuell am Beleg eingetragen
2. Kundenseitig hinterlegt
3. Globaler Standard aus Einstellungen (Standard: 14 Tage)

---

### Produkte

Produkte und Leistungen können als Stammdaten hinterlegt und beim Erstellen von Belegen per Autocomplete eingefügt werden.

| Feld | Beschreibung |
|------|-------------|
| Artikelnummer (SKU) | Eindeutige Kennung |
| Bezeichnung | Name des Produkts / der Leistung |
| Einheit | z. B. Stk, Std, km, Pauschal |
| Einzelpreis | Netto-Verkaufspreis (aktuell gültiger Preis) |
| Steuersatz | Verknüpfung mit einem definierten Steuersatz |
| Kategorie | Optionale Gruppierung |

#### Preishistorie

Jedes Produkt führt eine lückenlose Preishistorie. Preisanpassungen werden als neue Periode angelegt, ohne die bisherigen Werte zu überschreiben:

1. Produkt öffnen → **Neuer Preis ab...**
2. Neuen Preis und Gültigkeitsdatum eintragen
3. Der bisherige Preis wird automatisch abgeschlossen

Belege übernehmen immer den Preis, der **zum Zeitpunkt der Finalisierung** gültig war.

---

### Belege

Unter **Belege** werden alle Dokumente (Angebote, Rechnungen, Lieferscheine, Gutschriften) verwaltet.

#### Belegtypen

| Typ | Kürzel | Beschreibung |
|-----|--------|-------------|
| Angebot | ANG | Unverbindliches Angebot an den Kunden |
| Rechnung | RE | Zahlungspflichtige Rechnung |
| Lieferschein | LS | Lieferdokumentation ohne Zahlungsaufforderung |
| Gutschrift | GS | Neutralisiert eine bestehende Rechnung (negative Beträge) |

#### Belegstatus

| Status | Beschreibung |
|--------|-------------|
| Entwurf | Beleg noch nicht finalisiert, kann bearbeitet werden |
| Finalisiert | Belegnummer vergeben, unveränderlich |
| Versendet | Als versendet markiert |
| Teilbezahlt | Mindestens eine Zahlung, aber noch offener Betrag |
| Bezahlt | Vollständig beglichen |
| Storniert | Beleg wurde storniert, Gegendokument vorhanden |

#### Beleg erstellen

1. **Belege → Neu** oder über den Button in der Listenansicht
2. Kunden auswählen
3. Positionen hinzufügen:
   - Produkt aus dem Katalog wählen (Autocomplete beim Tippen oder Klick auf Lupe)
   - Oder freie Texteingabe
   - Menge, Einheit, Einzelpreis, Rabatt und Steuersatz anpassen
4. Zahlungsziel und Lieferdatum optional eintragen
5. **Speichern** — Beleg bleibt als Entwurf
6. **Finalisieren** — Belegnummer wird vergeben, Beleg ist danach nicht mehr editierbar

#### Rabatte

Rabatte können auf zwei Ebenen angegeben werden:

**Pro Position:**

| Rabatttyp | Eingabe | Beispiel |
|-----------|---------|---------|
| Prozentual | `%` | `10` → 10 % Abzug vom Positionsbetrag |
| Absolut | `€` | `5,00` → 5,00 € Abzug |

**Globaler Rabatt (gilt für den gesamten Beleg):**

Unter dem Positionsteil des Beleg-Editors kann ein globaler Rabatt als Prozentsatz oder Festbetrag eingetragen werden. Er wird proportional auf alle Steuerbereiche verteilt und auf dem PDF ausgewiesen.

#### Zahlungen erfassen

Auf finalisierten Rechnungen können Zahlungseingänge erfasst werden:

1. Beleg öffnen → Abschnitt **Zahlungen**
2. Datum, Betrag, Zahlungsart und Referenz eintragen
3. Nach vollständiger Bezahlung wechselt der Status automatisch auf **Bezahlt**

Gutschriften reduzieren ebenfalls den offenen Betrag einer verknüpften Rechnung.

#### Verknüpfte Belege

Jeder Beleg zeigt im Abschnitt **Verknüpfte Belege** die gesamte Dokumentenkette — unabhängig davon wie tief die Kette ist (z. B. mehrfach stornierte Belege). Angezeigt werden:

- Aus einem Angebot erstellte Rechnungen und Lieferscheine
- Einer Rechnung zugeordnete Gutschriften
- Stornobelege und deren Gegendokumente

#### PDF herunterladen

Über den **PDF**-Button auf der Belegdetailseite wird ein PDF generiert. Das Layout kann unter **Einstellungen → PDF-Layout** global oder pro Belegtyp angepasst werden.

#### E-Mail versenden

Über den **E-Mail**-Button kann der Beleg direkt aus der Anwendung versendet werden:

- **SMTP:** E-Mail wird serverseitig über den konfigurierten SMTP-Server gesendet
- **Outlook:** Öffnet einen vorausgefüllten `mailto:`-Link im Standard-E-Mail-Client

Betreff und Nachrichtentext können mit Platzhaltern individuell vorbelegt werden (siehe [E-Mail-Einstellungen](#e-mail)).

---

### Offene Posten

Die **Offene-Posten-Liste** zeigt alle Rechnungen mit noch ausstehendem Betrag.

- **Offener Betrag** = Rechnungsbetrag − Zahlungen − Gutschriften
- Rechnungen mit offenem Betrag = 0 werden automatisch ausgeblendet
- Filter **Nur überfällige** zeigt Rechnungen nach Fälligkeitsdatum

---

### Einstellungen

#### Firmendaten

Alle Stammdaten die auf Belegen und in der Fußzeile erscheinen:
- Firmenname, Rechtsform, Adresse
- Kontaktdaten (E-Mail, Telefon, Website)
- Bankverbindung (IBAN, BIC, Bankname)
- USt-IdNr. und Steuernummer
- Firmenlogo
- Standard-Zahlungsziel (gilt für alle neuen Belege)

#### Steuersätze

Steuersätze werden mit Gültigkeitszeiträumen verwaltet, damit historisch erstellte Belege immer den damals gültigen Satz verwenden.

| Kategorie | Bedeutung |
|-----------|----------|
| S | Normalsatz (z. B. 19 %) |
| R | Ermäßigter Satz (z. B. 7 %) |
| Z | Nullsatz |
| E | Steuerbefreit |
| O | Außerhalb des Steuerbereichs |

Neue Steuerperioden werden über **Nachfolger anlegen** erstellt. Der bisherige Satz wird automatisch zum Vortag abgeschlossen. Ein Steuersatz kann nur gelöscht werden, wenn er weder in Produkten noch in Belegpositionen verwendet wird.

#### Nummernkreise

Für jeden Belegtyp kann das Nummernformat individuell definiert werden:

| Variable | Bedeutung |
|----------|-----------|
| `{YYYY}` | Vierstelliges Jahr |
| `{YY}` | Zweistelliges Jahr |
| `{MM}` | Monat (zweistellig) |
| `{SEQ}` | Laufende Nummer (Länge durch Anzahl der `N` bestimmt, z. B. `{NNNNN}`) |

Beispiel: `RE-{YYYY}-{NNNNN}` → `RE-2026-00001`

Eine **Vorschau** zeigt die nächste Nummer auf Basis der aktuellen Einstellungen.

#### PDF-Layout

Im Tab **PDF-Layout** kann das Erscheinungsbild aller generierten PDFs angepasst werden:

| Einstellung | Beschreibung |
|-------------|-------------|
| Akzentfarbe | Farbe für Titel und Summen-Rahmen |
| Tabellenkopf | Hintergrundfarbe der Tabellenüberschrift |
| Zebrastreifen | Hintergrundfarbe jeder zweiten Tabellenzeile |
| Schriftgröße Body | Grundschriftgröße in pt (Standard: 9) |
| Schriftgröße Titel | Schriftgröße des Dokumententitels (Standard: 18) |
| Rand seitlich / oben / unten | Seitenabstände in px |
| Logo-Breite / -Höhe | Abmessungen des Logos im PDF |
| Spalten | Sichtbarkeit der Tabellenspalten (Menge, Einheit, Preis, Rabatt, Steuer …) |
| Betragsanzeige | Netto, Brutto oder beides |
| Schlusstext | Individueller Text unter der Summentabelle |

Auf der rechten Seite wird eine **Live-Vorschau** mit einer Musterrechnung angezeigt, die sich sofort bei jeder Änderung aktualisiert.

Pro Belegtyp können abweichende Layouts hinterlegt werden.

#### E-Mail

Unter **Einstellungen → E-Mail** wird der Versandkanal konfiguriert:

**SMTP:**

| Feld | Beschreibung |
|------|-------------|
| Host | SMTP-Serveradresse |
| Port | Typischerweise 587 (STARTTLS) oder 465 (SSL) |
| Sicher (SSL) | Direktes SSL statt STARTTLS |
| Benutzername / Passwort | SMTP-Zugangsdaten |
| Absendername / -adresse | Erscheint als „Von" beim Empfänger |

Über **Verbindung testen** wird eine Test-E-Mail an eine beliebige Adresse gesendet.

**Outlook-Modus:** Öffnet beim Versenden einen `mailto:`-Link im lokalen E-Mail-Client. PDF wird vorab zum Download angeboten.

**E-Mail-Vorlagen:** Betreff und Nachrichtentext können mit Platzhaltern vorbelegt werden:

| Platzhalter | Inhalt |
|-------------|--------|
| `{{documentNumber}}` | Belegnummer |
| `{{documentType}}` | Belegtyp (z. B. Rechnung) |
| `{{customerName}}` | Kundenname |
| `{{totalGross}}` | Bruttobetrag |
| `{{dueDate}}` | Fälligkeitsdatum |
| `{{salutation}}` | Anrede (Sehr geehrte/r …) |

#### Benutzerverwaltung

Unter **Einstellungen → Benutzer** können weitere Benutzer angelegt und verwaltet werden:

| Rolle | Berechtigungen |
|-------|---------------|
| Admin | Vollzugriff inkl. Benutzerverwaltung und Einstellungen |
| User | Belege, Kunden, Produkte — keine Benutzerverwaltung |

---

## Belegworkflow

```
Angebot (ANG)
    │
    ├──► "In Rechnung umwandeln"
    │         │
    │         ▼
    │    Rechnung (RE) ──► "Gutschrift erstellen" ──► Gutschrift (GS)
    │         │                                            │
    │         │                                     "Stornieren"
    │         │                                            │
    │         │                                            ▼
    │         │                                       Rechnung (RE) [Storno-GS]
    │         │
    │         ├──► "Stornieren" ──► Gutschrift (GS) [Stornobeleg]
    │         │
    │         └──► "Lieferschein erstellen"
    │                    │
    ▼                    ▼
    └──────────────► Lieferschein (LS)
```

### Workflow-Schaltflächen

| Schaltfläche | Verfügbar bei | Ergebnis |
|--------------|--------------|---------|
| In Rechnung umwandeln | Angebot (finalisiert) | Neue Rechnung mit gleichen Positionen |
| Lieferschein erstellen | Angebot oder Rechnung (finalisiert) | Neuer Lieferschein-Entwurf |
| Gutschrift erstellen | Rechnung (finalisiert) | Neue Gutschrift, verknüpft mit Original |
| Stornieren | Finalisierter Beleg | Erstellt automatisch einen Storno-Gegenbelegs und setzt Status auf Storniert |
| Löschen | Nur Entwürfe | Beleg wird unwiderruflich gelöscht |

### Storno-Logik

| Stornierter Beleg | Erzeugter Stornobeleg | Wirkung |
|-------------------|-----------------------|---------|
| Rechnung (RE) | Gutschrift (GS) mit negierten Preisen | Hebt Rechnung buchhaltungstechnisch auf |
| Gutschrift (GS) | Rechnung (RE) mit negierten Preisen | Hebt Gutschrift buchhaltungstechnisch auf |

---

## E-Rechnung (ZUGFeRD / XRechnung)

HoneyBill unterstützt die in Deutschland vorgeschriebenen elektronischen Rechnungsformate:

### XRechnung

Reines XML-Format für öffentliche Auftraggeber. Download über den **XRechnung XML**-Button auf der Rechnungsdetailseite.

**Voraussetzung:** Leitweg-ID beim Kunden hinterlegt.

### ZUGFeRD

PDF mit eingebettetem XML (EN 16931 / EXTENDED). Das generierte PDF enthält maschinenlesbare Rechnungsdaten, die von Buchhaltungssoftware automatisch verarbeitet werden können.

Profil am Beleg wählen: **ZUGFeRD Extended** oder **XRechnung**.

---

## Technologie-Stack

| Bereich | Technologie |
|---------|------------|
| API | Fastify 5, TypeScript, Drizzle ORM |
| Datenbank | SQLite (better-sqlite3, WAL-Modus) |
| Web | React 19, Vite, TanStack Query |
| Styling | Tailwind CSS |
| PDF-Generierung | @react-pdf/renderer |
| E-Rechnung | pdf-lib, Mustache |
| E-Mail-Versand | Nodemailer (SMTP), mailto (Outlook) |
| Authentifizierung | JWT (Fastify JWT), argon2 |
| Validierung | Zod |
| Monorepo | pnpm Workspaces |

---

## Verfügbare Skripte

```bash
pnpm setup      # Einmalige Ersteinrichtung (install + migrate + seed)
pnpm dev        # Entwicklungsserver starten (API + Web)
pnpm build      # Produktions-Build erstellen
pnpm migrate    # Datenbankmigrationen ausführen
pnpm seed       # Standarddaten einspielen
pnpm lint       # Code-Qualität prüfen (Biome)
pnpm format     # Code formatieren (Biome)
```
