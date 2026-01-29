# Email Kategorisierung - Setup-Anleitung

Diese Anleitung fuehrt dich Schritt fuer Schritt durch die Installation und Konfiguration.

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Lokale Installation](#2-lokale-installation)
3. [Neon PostgreSQL Setup](#3-neon-postgresql-setup)
4. [Google OAuth Setup (Gmail)](#4-google-oauth-setup-gmail)
5. [Microsoft Azure Setup (Outlook)](#5-microsoft-azure-setup-outlook)
6. [Strato IMAP Konfiguration](#6-strato-imap-konfiguration)
7. [Vercel Deployment](#7-vercel-deployment)
8. [Cron Job Konfiguration](#8-cron-job-konfiguration)
9. [LLM Setup (Optional)](#9-llm-setup-optional)

---

## 1. Voraussetzungen

### Software

- **Node.js** >= 18.0.0
- **npm** >= 10.0.0
- **Git**

### Accounts (Free Tier)

- [Neon](https://neon.tech) - PostgreSQL
- [Vercel](https://vercel.com) - Hosting
- [Google Cloud Console](https://console.cloud.google.com) - Gmail OAuth
- [Azure Portal](https://portal.azure.com) - Outlook OAuth
- (Optional) OpenAI oder Anthropic Account fuer LLM

---

## 2. Lokale Installation

### 2.1 Repository klonen

```bash
git clone https://github.com/dein-username/email-kategorisierung.git
cd email-kategorisierung
```

### 2.2 Dependencies installieren

```bash
npm install
```

### 2.3 Environment-Datei erstellen

```bash
cp .env.example .env
```

### 2.4 Encryption Key generieren

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kopiere den Output in `.env`:

```
ENCRYPTION_KEY=dein-64-zeichen-hex-string
```

### 2.5 NextAuth Secret generieren

```bash
openssl rand -base64 32
```

Kopiere den Output in `.env`:

```
NEXTAUTH_SECRET=dein-secret
NEXTAUTH_URL=http://localhost:3000
```

### 2.6 Cron Secret generieren

```bash
openssl rand -hex 16
```

Kopiere den Output in `.env`:

```
CRON_SECRET=dein-cron-secret
```

---

## 3. Neon PostgreSQL Setup

### 3.1 Account erstellen

1. Gehe zu [neon.tech](https://neon.tech)
2. Klicke "Sign Up" (GitHub oder Email)
3. Waehle den **Free Tier**

### 3.2 Projekt erstellen

1. Klicke "Create Project"
2. Name: `email-kategorisierung`
3. Region: `eu-central-1` (Frankfurt) - oder naechste zu dir
4. PostgreSQL Version: 16 (oder aktuellste)
5. Klicke "Create Project"

### 3.3 Connection Strings kopieren

Nach Erstellung siehst du die Connection Details:

1. Klicke auf "Connection Details"
2. Connection Type: "Pooled" fuer DATABASE_URL
3. Kopiere den String:

```
DATABASE_URL="postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/emailcat?sslmode=require"
```

4. Wechsle zu "Direct" fuer DIRECT_URL (wird fuer Migrations benoetigt)

```
DIRECT_URL="postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/emailcat?sslmode=require"
```

### 3.4 Database Migrations ausfuehren

```bash
npm run db:push
```

Dies erstellt alle Tabellen in der Datenbank.

### 3.5 Prisma Client generieren

```bash
npm run db:generate
```

---

## 4. Google OAuth Setup (Gmail)

### 4.1 Projekt erstellen

1. Gehe zur [Google Cloud Console](https://console.cloud.google.com)
2. Oben links: "Select a project" -> "New Project"
3. Name: `Email Kategorisierung`
4. Klicke "Create"

### 4.2 Gmail API aktivieren

1. Im Suchfeld: "Gmail API" eingeben
2. Klicke auf "Gmail API"
3. Klicke "Enable"

### 4.3 OAuth Consent Screen konfigurieren

1. Navigation: "APIs & Services" -> "OAuth consent screen"
2. User Type: "External" (fuer Tests)
3. Klicke "Create"

**App Information:**
- App name: `Email Kategorisierung`
- User support email: Deine Email
- Developer contact: Deine Email

4. Klicke "Save and Continue"

**Scopes:**
1. Klicke "Add or Remove Scopes"
2. Suche und waehle:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Klicke "Update" und "Save and Continue"

**Test Users:**
1. Klicke "Add Users"
2. Fuege deine Gmail-Adresse hinzu
3. Klicke "Save and Continue"

### 4.4 OAuth Credentials erstellen

1. Navigation: "APIs & Services" -> "Credentials"
2. Klicke "Create Credentials" -> "OAuth client ID"
3. Application type: "Web application"
4. Name: `Email Kategorisierung Web`

**Authorized JavaScript origins:**
```
http://localhost:3000
https://deine-app.vercel.app
```

**Authorized redirect URIs:**
```
http://localhost:3000/api/auth/callback/google
https://deine-app.vercel.app/api/auth/callback/google
```

5. Klicke "Create"
6. Kopiere "Client ID" und "Client Secret" in `.env`:

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```

### 4.5 App Verifizierung (Produktion)

Fuer Produktion musst du die App verifizieren lassen:
1. OAuth consent screen -> "Publish App"
2. Verification Process durchlaufen (kann 2-4 Wochen dauern)

---

## 5. Microsoft Azure Setup (Outlook)

### 5.1 Azure Account

1. Gehe zum [Azure Portal](https://portal.azure.com)
2. Melde dich mit Microsoft-Account an

### 5.2 App Registration erstellen

1. Suche: "App registrations"
2. Klicke "New registration"

**Register an application:**
- Name: `Email Kategorisierung`
- Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
- Redirect URI:
  - Platform: "Web"
  - URL: `http://localhost:3000/api/auth/callback/azure-ad`
3. Klicke "Register"

### 5.3 Client Secret erstellen

1. Navigation: "Certificates & secrets"
2. Klicke "New client secret"
3. Description: `Email Kategorisierung Secret`
4. Expires: "24 months" (oder kuerzer)
5. Klicke "Add"
6. **WICHTIG:** Kopiere den "Value" sofort (wird nur einmal angezeigt!)

Kopiere in `.env`:
```
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxx~xxx
```

### 5.4 API Permissions konfigurieren

1. Navigation: "API permissions"
2. Klicke "Add a permission"
3. Waehle "Microsoft Graph"
4. Waehle "Delegated permissions"
5. Suche und waehle:
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `MailboxSettings.Read`
   - `offline_access`
   - `openid`
   - `email`
   - `profile`
6. Klicke "Add permissions"
7. Klicke "Grant admin consent for [Directory]" (wenn verfuegbar)

### 5.5 Redirect URIs hinzufuegen (Produktion)

1. Navigation: "Authentication"
2. Under "Web" -> "Add URI"
3. Fuege hinzu: `https://deine-app.vercel.app/api/auth/callback/azure-ad`
4. Klicke "Save"

---

## 6. Strato IMAP Konfiguration

### 6.1 IMAP Zugangsdaten

**Strato IMAP Server:**
- Host: `imap.strato.de`
- Port: `993`
- Sicherheit: SSL/TLS

### 6.2 App-Passwort (bei 2FA)

Wenn du 2-Faktor-Authentifizierung aktiviert hast:

1. Gehe zu [Strato Kundenservice](https://www.strato.de/apps/CustomerService)
2. Login mit deinen Zugangsdaten
3. Navigation: "Sicherheit" -> "App-Passwoerter"
4. Erstelle ein neues App-Passwort
5. Beschreibung: "Email Kategorisierung"
6. Kopiere das generierte Passwort

### 6.3 In der App konfigurieren

Die IMAP-Konfiguration erfolgt in der Web-Oberflaeche:

1. Login in die App
2. Gehe zu "Verbindungen"
3. Klicke auf "IMAP (Strato, andere)"
4. Gib ein:
   - IMAP Server: `imap.strato.de`
   - Port: `993`
   - SSL/TLS: aktiviert
   - Email/Benutzername: `deine@email.de`
   - Passwort: Dein (App-)Passwort
5. Klicke "Verbinden"

### 6.4 Andere IMAP Provider

| Provider | Host | Port |
|----------|------|------|
| GMX | imap.gmx.net | 993 |
| Web.de | imap.web.de | 993 |
| 1&1 | imap.1und1.de | 993 |
| T-Online | secureimap.t-online.de | 993 |

---

## 7. Vercel Deployment

### 7.1 Vercel Account

1. Gehe zu [vercel.com](https://vercel.com)
2. "Sign Up" mit GitHub

### 7.2 Projekt importieren

1. Klicke "Add New..." -> "Project"
2. Import Git Repository
3. Waehle dein Repository
4. Klicke "Import"

### 7.3 Build Settings konfigurieren

- Framework Preset: `Next.js`
- Root Directory: `apps/web`
- Build Command: `npm run build` (oder leer lassen)
- Output Directory: (leer lassen, default)

### 7.4 Environment Variables setzen

Klicke "Environment Variables" und fuege hinzu:

| Key | Value | Environments |
|-----|-------|--------------|
| `DATABASE_URL` | Neon Pooled URL | Production, Preview, Development |
| `DIRECT_URL` | Neon Direct URL | Production, Preview, Development |
| `ENCRYPTION_KEY` | 64-char hex | Production, Preview, Development |
| `GOOGLE_CLIENT_ID` | Google Client ID | Production, Preview, Development |
| `GOOGLE_CLIENT_SECRET` | Google Secret | Production, Preview, Development |
| `MICROSOFT_CLIENT_ID` | Azure Client ID | Production, Preview, Development |
| `MICROSOFT_CLIENT_SECRET` | Azure Secret | Production, Preview, Development |
| `NEXTAUTH_SECRET` | Random string | Production, Preview, Development |
| `NEXTAUTH_URL` | `https://deine-app.vercel.app` | Production |
| `CRON_SECRET` | Random hex | Production, Preview, Development |

### 7.5 Deploy

1. Klicke "Deploy"
2. Warte auf Build (ca. 2-3 Minuten)
3. Nach erfolgreichem Build: Kopiere die URL

### 7.6 Redirect URIs aktualisieren

Gehe zurueck zu Google und Azure und fuege die Vercel-URL hinzu:

**Google Cloud Console:**
- Authorized JavaScript origins: `https://deine-app.vercel.app`
- Authorized redirect URIs: `https://deine-app.vercel.app/api/auth/callback/google`

**Azure Portal:**
- Redirect URI: `https://deine-app.vercel.app/api/auth/callback/azure-ad`

---

## 8. Cron Job Konfiguration

### 8.1 Vercel Cron (Hobby Plan)

Die `vercel.json` konfiguriert bereits einen Cron Job:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-emails",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Hinweis:** Vercel Hobby Plan erlaubt nur 1 Cron Job mit taeglicher Ausfuehrung.
Fuer 5-Minuten-Intervalle benoetigt man den Pro Plan.

### 8.2 GitHub Actions Fallback (kostenlos)

Erstelle `.github/workflows/cron.yml`:

```yaml
name: Process Emails Cron

on:
  schedule:
    # Alle 5 Minuten (GitHub Actions Minimum ist 5 Minuten)
    - cron: '*/5 * * * *'
  workflow_dispatch: # Manuelle Ausfuehrung ermoeglichen

jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Email Processing
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://deine-app.vercel.app/api/cron/process-emails
```

**GitHub Secret hinzufuegen:**
1. Repository Settings -> Secrets and variables -> Actions
2. New repository secret: `CRON_SECRET` mit deinem Wert

---

## 9. LLM Setup (Optional)

Die Klassifizierung funktioniert auch ohne LLM (nur regelbasiert). Fuer bessere Ergebnisse:

### 9.1 OpenAI

1. Gehe zu [platform.openai.com](https://platform.openai.com)
2. API Keys -> Create new secret key
3. Kopiere in `.env`:

```
LLM_PROVIDER=openai
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4o-mini  # Kostenguenstig
```

### 9.2 Anthropic

1. Gehe zu [console.anthropic.com](https://console.anthropic.com)
2. API Keys -> Create Key
3. Kopiere in `.env`:

```
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-xxx
LLM_MODEL=claude-3-haiku-20240307  # Kostenguenstig
```

### 9.3 Deaktiviert (Standard)

```
LLM_PROVIDER=none
```

---

## 10. Erste Schritte nach Installation

1. Oeffne `http://localhost:3000` (lokal) oder deine Vercel URL
2. Klicke "Mit Gmail anmelden" oder "Mit Microsoft anmelden"
3. Autorisiere die App
4. Gehe zu "Verbindungen" und verifiziere die Verbindung
5. Optional: Fuege IMAP-Konto hinzu
6. Gehe zu "Kategorien" und pruefe die Standardkategorien
7. Gehe zu "Regeln" und passe bei Bedarf an
8. Klicke bei einer Verbindung auf "Play" fuer manuellen Test
9. Die automatische Verarbeitung startet alle 5 Minuten

---

## Troubleshooting

### Fehler: "Token refresh failed"

- Loesung: Verbindung loeschen und neu hinzufuegen

### Fehler: "IMAP connection failed"

- Pruefe Host/Port
- Pruefe Passwort (App-Passwort bei 2FA)
- Pruefe ob IMAP aktiviert ist

### Fehler: "Database connection failed"

- Pruefe DATABASE_URL
- Neon: Pruefe ob IP-Whitelist konfiguriert ist (oder auf "All IPs" setzen)

### Cron Job laeuft nicht

- Pruefe CRON_SECRET in Vercel
- Pruefe Logs in Vercel Dashboard -> Deployments -> Functions
- Alternative: GitHub Actions nutzen

### OAuth Fehler "redirect_uri_mismatch"

- Pruefe ob alle Redirect URIs korrekt konfiguriert sind
- URLs muessen exakt uebereinstimmen (mit/ohne trailing slash)
