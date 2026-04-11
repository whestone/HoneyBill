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
| E-Mail / Benutzername | `admin` |
| Passwort | `admin` |

> **Hinweis:** Passwort nach dem ersten Login in den Einstellungen ändern.

---

## Konfiguration

Die API liest Umgebungsvariablen aus dem Prozess. Diese können in einer `.env`-Datei im Stammverzeichnis oder direkt in der Shell gesetzt werden:

| Variable | Standard | Beschreibung |
|----------|----------|-------------|
| `PORT` | `3001` | API-Port |
| `HOST` | `127.0.0.1` | API-Host |
| `JWT_SECRET` | `honeybill-dev-secret-change-in-production` | JWT-Signaturschlüssel |
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

Produkte/Leistungen können als Stammdaten hinterlegt und beim Erstellen von Belegen per Autocomplete eingefügt werden.

| Feld | Beschreibung |
|------|-------------|
| Artikelnummer (SKU) | Eindeutige Kennung |
| Bezeichnung | Name des Produkts / der Leistung |
| Einheit | z. B. Stk, Std, km, Pauschal |
| Einzelpreis | Netto-Verkaufspreis |
| Steuersatz | Verknüpfung mit einem definierten Steuersatz |
| Kategorie | Optionale Gruppierung |

---

### Belege

Unter **Belege** werden alle Dokumente (Angebote, Rechnungen, Lieferscheine, Gutschriften) verwaltet.

#### Belegtypen

| Typ | Kürzel | Beschreibung |
|-----|--------|-------------|
| Angebot | ANG | Unverbindliches Angebot an den Kunden |
| Rechnung | RE | Zahlungspflichtige Rechnung |
| Lieferschein | LS | Lieferdokumentation ohne Zahlungsaufforderung |
| Gutschrift | GS | Storniert oder reduziert eine bestehende Rechnung |

#### Belegstatus

| Status | Beschreibung |
|--------|-------------|
| Entwurf | Beleg noch nicht finalisiert, kann bearbeitet werden |
| Finalisiert | Belegnummer vergeben, unveränderlich |
| Versendet | Als versendet markiert |
| Teilbezahlt | Mindestens eine Zahlung, aber noch offener Betrag |
| Bezahlt | Vollständig beglichen |
| Storniert | Beleg wurde storniert |

#### Beleg erstellen

1. **Belege → Neu** oder über den Button in der Listenansicht
2. Kunden auswählen
3. Positionen hinzufügen:
   - Produkt aus dem Katalog wählen (Autocomplete beim Tippen oder Klick auf Lupe für vollständige Produktliste)
   - Oder freie Texteingabe
   - Menge, Einheit, Einzelpreis, Rabatt und Steuersatz anpassen
4. Zahlungsziel und Lieferdatum optional eintragen
5. **Speichern** — Beleg bleibt als Entwurf
6. **Finalisieren** — Belegnummer wird vergeben, Beleg ist danach nicht mehr editierbar

#### Zahlungen erfassen

Auf finalisierten Rechnungen können Zahlungseingänge erfasst werden:

1. Beleg öffnen → Abschnitt **Zahlungen**
2. Datum, Betrag, Zahlungsart und Referenz eintragen
3. Nach vollständiger Bezahlung wechselt der Status automatisch auf **Bezahlt**

#### Verknüpfte Belege

Jeder Beleg zeigt im Abschnitt **Verknüpfte Belege** alle zusammenhängenden Dokumente der gleichen Kette:
- Aus einem Angebot erstellte Rechnung
- Aus einer Rechnung erstellter Lieferschein
- Einer Rechnung zugeordnete Gutschriften

#### PDF herunterladen

Über den **PDF**-Button auf der Belegdetailseite wird ein PDF generiert. Das Layout kann unter **Einstellungen → PDF-Layout** angepasst werden.

---

### Offene Posten

Die **Offene-Posten-Liste** zeigt alle Rechnungen mit noch ausstehendem Betrag.

- **Offener Betrag** = Rechnungsbetrag − Zahlungen − Gutschriften
- Rechnungen mit offenem Betrag = 0 werden automatisch ausgeblendet
- Filter: **Nur überfällige** zeigt Rechnungen nach Fälligkeitsdatum

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

Steuersätze mit Gültigkeitszeiträumen für historisch korrekte Rückrechnung:

| Kategorie | Bedeutung |
|-----------|----------|
| S | Normalsatz (z. B. 19 %) |
| R | Ermäßigter Satz (z. B. 7 %) |
| Z | Nullsatz |
| E | Steuerbefreit |
| O | Außerhalb des Steuerbereichs |

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

Auf der rechten Seite wird eine **Live-Vorschau** mit einer Musterrechnung angezeigt, die sich sofort bei jeder Änderung aktualisiert.

---

## Belegworkflow

```
Angebot (ANG)
    │
    ▼ "In Rechnung umwandeln"
Rechnung (RE) ──────────────────────► Gutschrift (GS)
    │                                  (reduziert offenen Betrag)
    ▼ "Lieferschein erstellen"
Lieferschein (LS)
```

### Workflow-Schaltflächen

| Schaltfläche | Verfügbar bei | Ergebnis |
|--------------|--------------|---------|
| In Rechnung umwandeln | Angebot (finalisiert) | Neue Rechnung mit gleichen Positionen |
| Lieferschein erstellen | Angebot oder Rechnung (finalisiert) | Neuer Lieferschein-Entwurf |
| Gutschrift erstellen | Rechnung (finalisiert) | Neue Gutschrift, verknüpft mit Original |
| Stornieren | Finalisierter Beleg | Status → Storniert |
| Löschen | Nur Entwürfe | Beleg wird gelöscht |

---

## E-Rechnung (ZUGFeRD / XRechnung)

HoneyBill unterstützt die in Deutschland vorgeschriebenen elektronischen Rechnungsformate:

### XRechnung

Reines XML-Format für öffentliche Auftraggeber. Download über den **XRechnung XML**-Button auf der Rechnungsdetailseite.

**Voraussetzung:** Leitweg-ID beim Kunden hinterlegt.

### ZUGFeRD

PDF mit eingebettetem XML (EN 16931). Das generierte PDF enthält maschinenlesbare Rechnungsdaten, die von Buchhaltungssoftware automatisch verarbeitet werden können.

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
