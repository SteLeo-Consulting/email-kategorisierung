# Security & Compliance

## Threat Model

### 1. Token Leakage

**Risiko:** OAuth Tokens oder IMAP-Passwoerter werden exponiert.

**Mitigations:**
- Alle Tokens werden mit AES-256-GCM verschluesselt in der Datenbank gespeichert
- Encryption Key wird nur ueber Environment Variables geladen
- Keine Tokens in Logs oder Fehlermeldungen
- Refresh Tokens werden automatisch erneuert vor Ablauf
- IMAP Passwoerter werden nie im Klartext gespeichert

**Code:**
```typescript
// packages/shared/src/crypto/index.ts
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = scryptSync(key, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  // ...
}
```

### 2. SSRF (Server-Side Request Forgery)

**Risiko:** Angreifer nutzt die App um interne Dienste anzufragen.

**Mitigations:**
- Keine benutzerdefinierten URLs fuer API-Aufrufe
- IMAP-Hosts werden nicht fuer HTTP-Requests verwendet
- Nur vordefinierte API-Endpoints (Google, Microsoft)

### 3. Webhook Spoofing

**Risiko:** Gefaelschte Webhook-Anfragen loesen unberechtigte Aktionen aus.

**Mitigations:**
- Cron-Endpoint ist mit CRON_SECRET geschuetzt
- Bearer Token Authentifizierung
- In Produktion werden nur Anfragen von Vercel akzeptiert

**Code:**
```typescript
// apps/web/src/app/api/cron/process-emails/route.ts
function verifyCronRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
  }
  return true;
}
```

### 4. IMAP Credential Exposure

**Risiko:** IMAP-Zugangsdaten werden kompromittiert.

**Mitigations:**
- Passwoerter werden verschluesselt gespeichert
- App-spezifische Passwoerter werden empfohlen
- Keine Passwort-Anzeige in der UI
- Passwoerter werden nie in API-Responses zurueckgegeben

### 5. SQL Injection

**Risiko:** Boeswillige SQL-Befehle werden ausgefuehrt.

**Mitigations:**
- Prisma ORM mit parameterisierten Queries
- Keine rohen SQL-Statements
- Input-Validierung mit Zod

### 6. XSS (Cross-Site Scripting)

**Risiko:** Schadcode wird in der UI ausgefuehrt.

**Mitigations:**
- React escaped standardmaessig alle Ausgaben
- Keine `dangerouslySetInnerHTML` Nutzung
- Content Security Policy Header (via Vercel)

### 7. Session Hijacking

**Risiko:** Session-Token wird gestohlen.

**Mitigations:**
- NextAuth mit sicheren Session-Cookies
- HttpOnly und Secure Flags
- CSRF-Token fuer State-aendernde Operationen

## OAuth Scopes (Least Privilege)

### Gmail Scopes

| Scope | Zweck | Minimal? |
|-------|-------|----------|
| `gmail.readonly` | E-Mails lesen | Ja |
| `gmail.labels` | Labels verwalten | Ja |
| `gmail.modify` | Labels setzen | Ja |
| `userinfo.email` | Email-Adresse fuer Account | Ja |
| `userinfo.profile` | Name fuer Anzeige | Optional |

**Nicht benoetigte Scopes (werden nicht angefordert):**
- `gmail.send` - Wir senden keine E-Mails
- `gmail.compose` - Wir erstellen keine E-Mails
- `gmail.insert` - Wir fuegen keine E-Mails ein
- `gmail.settings.*` - Wir aendern keine Einstellungen

### Microsoft Graph Scopes

| Scope | Zweck | Minimal? |
|-------|-------|----------|
| `Mail.Read` | E-Mails lesen | Ja |
| `Mail.ReadWrite` | Kategorien setzen | Ja |
| `MailboxSettings.Read` | Zeitzone etc. | Optional |
| `offline_access` | Refresh Token | Ja |

**Nicht benoetigte Scopes:**
- `Mail.Send` - Wir senden nicht
- `Calendars.*` - Kein Kalenderzugriff
- `Contacts.*` - Kein Kontaktzugriff

## Datenschutz

### Gespeicherte Daten

| Daten | Gespeichert | Verschluesselt | Zweck |
|-------|-------------|----------------|-------|
| Email-Adresse | Ja | Nein | Account-Identifikation |
| OAuth Tokens | Ja | Ja (AES-256) | API-Zugriff |
| IMAP Passwort | Ja | Ja (AES-256) | IMAP-Zugriff |
| Email-ID | Ja | Nein | Duplikat-Erkennung |
| Email-Betreff | Optional | Nein | Audit/Debug |
| Email-Body | Nein | - | Nicht gespeichert |

### Datenminimierung

- E-Mail-Inhalte werden nicht gespeichert
- Nur Metadaten fuer Klassifizierung verwendet
- Snippets nur im Memory waehrend Verarbeitung
- Processed Messages speichern nur IDs und Ergebnisse

### Loeschung

- Verbindung loeschen entfernt alle zugehoerigen Daten (CASCADE)
- Audit-Logs bleiben zur Nachvollziehbarkeit
- Manuelles Loeschen des Users moeglich

## Empfehlungen fuer Produktion

### Environment Security

```bash
# Niemals in Git committen:
.env
.env.local
.env.production

# Sichere Generierung:
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
NEXTAUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 16)
```

### Vercel Security Headers

Erstelle `vercel.json` mit Security Headers:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Rate Limiting

Fuer Produktion, implementiere Rate Limiting:

```typescript
// Beispiel mit Vercel Edge Config oder Upstash Redis
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});
```

### Monitoring

- Vercel Analytics aktivieren
- Error Tracking (Sentry) einrichten
- Audit-Logs regelmaessig pruefen
- Token-Refresh-Fehler ueberwachen
