# Grenzen und Tradeoffs

## Provider-spezifische Limitierungen

### Gmail

| Aspekt | Limit | Auswirkung |
|--------|-------|------------|
| API Quota | 250 Units/Sekunde (Projekt) | Bei sehr vielen Usern Rate Limiting noetig |
| Messages.list | 500 Ergebnisse max | Pagination fuer aeltere E-Mails |
| Labels | 10.000 pro Mailbox | Ausreichend fuer Kategorisierung |
| Label Name | 225 Zeichen | Ausreichend |
| Batch Requests | 100 Requests pro Batch | Optimierung moeglich |

**Label-Handling:**
- Gmail Labels sind "echte" Labels (wie Tags)
- Eine E-Mail kann mehrere Labels haben
- Labels koennen verschachtelt sein (via "/" im Namen)
- Farben werden automatisch von Gmail vergeben

### Outlook / Microsoft Graph

| Aspekt | Limit | Auswirkung |
|--------|-------|------------|
| API Throttling | 10.000 Requests/10 Min | Ausreichend fuer Single-User |
| Categories | 25 Master Categories | Weniger als unsere 10 Kategorien |
| Category Names | 255 Zeichen | Ausreichend |
| Folders | Unbegrenzt | Alternative zu Categories |

**Category vs Folder Tradeoff:**
- **Categories:** Wie Tags, E-Mail bleibt in Inbox, max 25 Kategorien
- **Folders:** E-Mail wird verschoben, verliert Inbox-Sichtbarkeit

Standard: Categories (konfigurierbar via `useFolders` Setting)

### IMAP (Strato etc.)

| Aspekt | Limit | Auswirkung |
|--------|-------|------------|
| Flags/Keywords | Server-abhaengig (oft 32) | Moeglicherweise nicht genuegend |
| Ordner | Unbegrenzt | Empfohlen statt Flags |
| IDLE | Oft limitiert | Polling statt Push |
| Connections | Oft 10 gleichzeitig | Verbindung nach Nutzung schliessen |

**Flag vs Folder Tradeoff:**
- **Flags (Keywords):** E-Mail bleibt in INBOX, aber Server-Support variiert
- **Folders:** Zuverlaessiger, aber E-Mail wird kopiert/verschoben

Standard: Folders mit Prefix `EmailCat/` (konfigurierbar)

**Strato-spezifisch:**
- Keine IMAP IDLE Unterstuetzung (nur Polling)
- App-Passwoerter bei 2FA erforderlich
- Ordner mit Umlauten problematisch (UTF-7 Encoding)

## Vercel Free Tier Limits

| Ressource | Limit | Auswirkung |
|-----------|-------|------------|
| Serverless Functions | 100 GB-Hours | Fuer Single-User ausreichend |
| Function Duration | 10s (Hobby) / 60s (Pro) | Lange Verarbeitungen problematisch |
| Cron Jobs | 1 Job, 1x taeglich (Hobby) | GitHub Actions als Alternative |
| Bandwidth | 100 GB/Monat | Fuer normale Nutzung OK |
| Builds | 100/Tag | OK fuer Development |

**Workarounds:**
- Cron: GitHub Actions als Fallback (kostenlos, 5-Min Intervall)
- Duration: Batch-Groesse begrenzen (`MAX_EMAILS_PER_RUN: 50`)
- Bei Upgrade auf Pro: Function Duration 300s

## Neon Free Tier Limits

| Ressource | Limit | Auswirkung |
|-----------|-------|------------|
| Storage | 512 MB | Ca. 1-2 Mio Rows |
| Compute | 191.9 Hours/Monat | ~6 Stunden/Tag |
| Branches | 10 | Fuer Dev/Preview ausreichend |
| Projects | 1 (aber 10 Branches) | - |

**Datenvolumen-Schaetzung:**
- 1 processed_message: ~500 Bytes
- 1.000 E-Mails/Tag * 30 Tage = 15 MB/Monat
- Audit-Logs: ~200 Bytes/Eintrag
- Bei 512 MB: Ca. 1-2 Jahre Daten

**Compute Auto-Suspend:**
- Nach 5 Min Inaktivitaet: Suspend
- Cold Start: 1-2 Sekunden
- Fuer Cron-Jobs kein Problem

## Klassifizierungs-Limitierungen

### Regelbasiert

| Aspekt | Limit | Auswirkung |
|--------|-------|------------|
| Komplexitaet | Nur Pattern-Matching | Kein Kontextverstaendnis |
| Sprache | Keine NLP | Synonyme nicht erkannt |
| Genauigkeit | ~70-85% | False Positives moeglich |

**Wann regelbasiert nicht ausreicht:**
- Mehrdeutige Formulierungen
- Unbekannte Absender
- Komplexe Geschaeftslogik

### LLM-basiert

| Aspekt | Limit | Auswirkung |
|--------|-------|------------|
| Kosten | ~$0.001-0.01/E-Mail | Bei 1000 E-Mails: $1-10 |
| Latenz | 500-2000ms pro Aufruf | Langsamer als Regeln |
| Verfuegbarkeit | API-Abhaengigkeit | Fallback auf Regeln noetig |
| Datenschutz | E-Mail-Snippets an API | DSGVO-Bedenken moeglich |

**Empfehlung:**
- LLM nur als Fallback (`llmFallbackOnly: true`)
- Fuer niedrige Konfidenz-Faelle
- Kosten ueberwachen

## Architektonische Tradeoffs

### Polling vs Push (Webhooks)

**Aktuell: Polling (alle 5 Minuten)**

| Pro | Contra |
|-----|--------|
| Einfacher zu implementieren | Bis zu 5 Min Verzoegerung |
| Keine Webhook-Infrastruktur | Mehr API-Calls |
| Funktioniert mit allen Providern | Verschwendet Quota bei wenig E-Mails |

**Alternative: Push/Webhooks**
- Gmail: `watch` API mit Pub/Sub
- Outlook: Graph Subscriptions
- IMAP: IDLE (wenn unterstuetzt)

Nicht implementiert wegen:
- Komplexitaet (Pub/Sub, Webhook-Endpoints)
- IMAP-Inkompatibilitaet
- Free Tier Limits bei Cloud Pub/Sub

### Serverless vs Long-Running Process

**Aktuell: Serverless (Vercel Functions)**

| Pro | Contra |
|-----|--------|
| Keine Server-Wartung | 10s Timeout (Hobby) |
| Auto-Scaling | Cold Starts |
| Kostenlos (Free Tier) | Keine persistenten Connections |

**Alternative: Dedicated Worker**
- Fuer grosse Volumen
- Persistente IMAP-Connections
- Keine Timeouts

Nicht implementiert wegen:
- Zusaetzliche Infrastruktur noetig
- Kosten
- Komplexitaet

### Datenmodell: Keine Body-Speicherung

**Entscheidung:** E-Mail-Body wird nicht gespeichert

| Pro | Contra |
|-----|--------|
| Datenschutz | Keine nachtraegliche Analyse |
| Weniger Storage | Re-Fetch bei Re-Klassifizierung |
| Einfacher DSGVO-konform | - |

**Alternative:** Body verschluesselt speichern
- Mehr Flexibilitaet
- Hoehere Storage-Kosten
- Komplexere Verschluesselung

## Skalierungsgrenzen

### Single-User (aktuell)

- 1-5 Verbindungen
- ~100-500 E-Mails/Tag
- ~50 Regeln
- Innerhalb Free Tier

### Multi-User (nicht implementiert)

Benoetigt:
- User-Registrierung & Auth
- Usage Quotas
- Billing Integration
- Rate Limiting pro User

### Enterprise (Out of Scope)

Benoetigt:
- On-Premise Option
- SSO (SAML/OIDC)
- Audit Compliance
- SLA Garantien

## API-Quotas Referenz

### Gmail API

```
Quota: 1,000,000,000 units/day (Projekt)

Kosten pro Operation:
- messages.list: 5 units
- messages.get: 5 units
- messages.modify: 5 units
- labels.list: 1 unit
- labels.create: 5 units

Bei 1000 E-Mails/Tag:
- list: 5 units * (1000/100 pages) = 50 units
- get: 5 units * 1000 = 5,000 units
- modify: 5 units * 1000 = 5,000 units
Total: ~10,050 units/Tag = 0.001% des Tageslimits
```

### Microsoft Graph

```
Throttling: 10,000 Requests / 10 Minuten

Bei 1000 E-Mails/Tag:
- list: ~10 requests (pagination)
- patch (category): 1000 requests

Total: ~1,010 requests/Tag = weit unter Limit
```

### OpenAI (wenn LLM aktiv)

```
GPT-4o-mini Pricing:
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

Pro E-Mail (~500 tokens input, ~50 output):
- Input: $0.000075
- Output: $0.00003
Total: ~$0.0001 / E-Mail

Bei 1000 E-Mails/Tag: ~$0.10/Tag = ~$3/Monat
```

## Nicht unterstuetzte Szenarien

1. **Shared Mailboxes** (Exchange)
2. **Delegated Access** (Gmail)
3. **S/MIME verschluesselte E-Mails** (Body nicht lesbar)
4. **Sehr grosse Anhaenge** (werden ignoriert)
5. **Real-time Processing** (<1 Min Latenz)
6. **Archiv-Mails** (nur neue E-Mails seit lastSync)
7. **E-Mail-Antworten/Aktionen** (nur Klassifizierung)
