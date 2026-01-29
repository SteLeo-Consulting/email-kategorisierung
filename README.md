# Email Kategorisierung

Automatische E-Mail-Klassifizierung mit Labels/Tags fuer Gmail, Outlook und IMAP.

## Features

- **Multi-Provider Support**: Gmail, Outlook/Microsoft 365, IMAP (Strato, GMX, etc.)
- **Automatische Klassifizierung**: Regelbasiert + optionales LLM
- **10 vordefinierte Kategorien**: Rechnung, Termin, Kunde, Lead, Support, Newsletter, Privat, ToDo, Spam-Verdacht, Pruefung
- **Provider-native Labels**: Gmail Labels, Outlook Categories, IMAP Folders
- **Review-Queue**: Manuelle Pruefung bei niedriger Konfidenz
- **Audit-Log**: Vollstaendige Nachverfolgbarkeit

## Tech Stack

- **Frontend**: Next.js 14 + React + shadcn/ui
- **Backend**: Next.js API Routes (Serverless)
- **Database**: PostgreSQL auf Neon (Free Tier)
- **Deployment**: Vercel
- **Auth**: NextAuth.js (Google + Microsoft OAuth)

## Schnellstart

### 1. Repository klonen

```bash
git clone https://github.com/dein-username/email-kategorisierung.git
cd email-kategorisierung
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment konfigurieren

```bash
cp .env.example .env
# Dann .env mit deinen Werten fuellen
```

### 4. Datenbank initialisieren

```bash
npm run db:push
npm run db:generate
```

### 5. Entwicklungsserver starten

```bash
npm run dev
```

Oeffne [http://localhost:3000](http://localhost:3000)

## Dokumentation

| Dokument | Beschreibung |
|----------|--------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System-Architektur & Datenfluss |
| [SETUP.md](./SETUP.md) | Detaillierte Setup-Anleitung |
| [SECURITY.md](./SECURITY.md) | Sicherheit & Datenschutz |
| [OPERATIONS.md](./OPERATIONS.md) | Day-2 Betrieb & Wartung |
| [TESTING.md](./TESTING.md) | Testplan & Testdaten |
| [LIMITATIONS.md](./LIMITATIONS.md) | Grenzen & Tradeoffs |

## Projektstruktur

```
email-kategorisierung/
├── apps/
│   └── web/                 # Next.js Application
│       ├── src/
│       │   ├── app/         # App Router (Pages + API)
│       │   ├── components/  # React Components (shadcn/ui)
│       │   └── lib/         # Services, Providers, Utils
│       └── vercel.json      # Cron Configuration
├── packages/
│   └── shared/              # Shared Types, Constants, Crypto
├── prisma/
│   └── schema.prisma        # Database Schema
├── .github/
│   └── workflows/
│       └── cron.yml         # GitHub Actions Fallback
└── docs/
```

## Kategorien

| Code | Name | Beschreibung |
|------|------|--------------|
| INVOICE | Rechnung | Rechnungen, Zahlungsaufforderungen |
| APPOINTMENT | Termin | Terminbestaetigungen, Einladungen |
| CUSTOMER | Kunde | Nachrichten von Bestandskunden |
| LEAD | Lead | Potenzielle Kunden, Anfragen |
| SUPPORT | Support | Support-Tickets, Hilfe-Anfragen |
| NEWSLETTER | Newsletter | Newsletter, Marketing-E-Mails |
| PERSONAL | Privat | Persoenliche E-Mails |
| TODO | ToDo | Handlungsbedarf, Action Items |
| SPAM_SUSPECT | Spam-Verdacht | Verdaechtige E-Mails |
| REVIEW | Pruefen | Unsichere Klassifizierung |

## Klassifizierungslogik

```
confidence >= 0.80  →  Kategorie-Label setzen
confidence 0.60-0.79  →  REVIEW-Label + Vorschlag loggen
confidence < 0.60  →  Nur REVIEW-Label
```

## API Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/auth/[...nextauth]` | GET/POST | OAuth Flows |
| `/api/connections` | GET/POST | Verbindungen verwalten |
| `/api/connections/[id]/test` | POST | Verbindung testen |
| `/api/connections/[id]/process` | POST | E-Mails verarbeiten |
| `/api/categories` | GET/POST | Kategorien verwalten |
| `/api/rules` | GET/POST | Regeln verwalten |
| `/api/label-mappings` | GET/POST | Label-Zuordnungen |
| `/api/processed-messages` | GET | Verarbeitete E-Mails |
| `/api/audit` | GET | Audit-Log |
| `/api/stats` | GET | Dashboard-Statistiken |
| `/api/cron/process-emails` | GET/POST | Cron-Trigger |

## Environment Variables

```bash
# Database (Neon)
DATABASE_URL=
DIRECT_URL=

# Encryption
ENCRYPTION_KEY=        # 64 hex chars

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Cron
CRON_SECRET=

# LLM (Optional)
LLM_PROVIDER=none      # none, openai, anthropic
LLM_API_KEY=
LLM_MODEL=
```

## Provider-Setup

### Gmail

1. Google Cloud Console -> APIs & Services -> Credentials
2. OAuth 2.0 Client erstellen
3. Gmail API aktivieren
4. Scopes: `gmail.readonly`, `gmail.labels`, `gmail.modify`

### Outlook

1. Azure Portal -> App registrations
2. API Permissions: `Mail.Read`, `Mail.ReadWrite`, `offline_access`
3. Client Secret erstellen

### IMAP (Strato)

- Host: `imap.strato.de`
- Port: `993`
- SSL: Ja
- App-Passwort bei 2FA verwenden

## Deployment

```bash
# Vercel CLI
npm i -g vercel
vercel

# Oder via GitHub Integration
# vercel.com -> Import Git Repository
```

## Lizenz

MIT

## Support

Issues: [GitHub Issues](https://github.com/dein-username/email-kategorisierung/issues)
