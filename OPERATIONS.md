# Day-2 Operations Guide

## Inhaltsverzeichnis

1. [Monitoring & Logging](#1-monitoring--logging)
2. [Neue Kategorien hinzufuegen](#2-neue-kategorien-hinzufuegen)
3. [False Positives reduzieren](#3-false-positives-reduzieren)
4. [Migrations & Schema Updates](#4-migrations--schema-updates)
5. [Backup & Recovery](#5-backup--recovery)
6. [Retry Strategie](#6-retry-strategie)
7. [Skalierung](#7-skalierung)

---

## 1. Monitoring & Logging

### Vercel Dashboard

1. Gehe zu [vercel.com/dashboard](https://vercel.com/dashboard)
2. Waehle dein Projekt
3. Tabs:
   - **Deployments**: Build-Logs, Fehler
   - **Functions**: Serverless Function Logs
   - **Analytics**: Traffic, Performance
   - **Logs**: Real-time Logs

### Audit Log pruefen

Die App speichert alle wichtigen Aktionen:

```sql
-- Letzte Cron-Runs
SELECT * FROM audit_log
WHERE action IN ('CRON_RUN_STARTED', 'CRON_RUN_COMPLETED', 'CRON_RUN_FAILED')
ORDER BY created_at DESC
LIMIT 20;

-- Verbindungsfehler
SELECT * FROM audit_log
WHERE action = 'CONNECTION_ERROR'
ORDER BY created_at DESC;

-- Klassifizierungen heute
SELECT COUNT(*) FROM audit_log
WHERE action = 'EMAIL_CLASSIFIED'
AND created_at >= CURRENT_DATE;
```

### Metriken ueberwachen

In der Dashboard-UI siehst du:
- Verbindungen (aktiv/Fehler)
- Heute verarbeitet
- Zur Pruefung
- Kategorieverteilung

### Alerts einrichten (mit Vercel)

1. Project Settings -> Notifications
2. Slack/Email fuer Deploy Failures
3. Function Errors > X

---

## 2. Neue Kategorien hinzufuegen

### Via UI

1. Derzeit sind nur System-Kategorien implementiert
2. Zur Erweiterung: `packages/shared/src/constants/index.ts` anpassen

### Via Code

**1. Kategorie-Code hinzufuegen:**

```typescript
// packages/shared/src/types/index.ts
export const CategoryCodeEnum = z.enum([
  'INVOICE',
  'APPOINTMENT',
  // ... bestehende
  'NEUE_KATEGORIE', // Hinzufuegen
]);
```

**2. Default-Kategorie definieren:**

```typescript
// packages/shared/src/constants/index.ts
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ... bestehende
  {
    code: 'NEUE_KATEGORIE',
    name: 'Neue Kategorie',
    description: 'Beschreibung der Kategorie',
    color: '#10b981', // Hex-Farbe
    icon: 'folder',
    isSystem: true,
  },
];
```

**3. Default-Regeln hinzufuegen:**

```typescript
// packages/shared/src/constants/index.ts
export const DEFAULT_RULES: DefaultRule[] = [
  // ... bestehende
  {
    categoryCode: 'NEUE_KATEGORIE',
    name: 'Keyword Match',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'suchbegriff',
    priority: 90,
    confidence: 0.85,
  },
];
```

**4. Label-Name definieren:**

```typescript
// packages/shared/src/constants/index.ts
export const DEFAULT_LABEL_NAMES: Record<CategoryCode, string> = {
  // ... bestehende
  NEUE_KATEGORIE: 'EmailCat/NeueKategorie',
};
```

**5. Deploy und Migration:**

```bash
npm run build
# Prisma Schema unveraendert, nur Code-Update
git push
```

Nach Deploy: In der UI werden neue Kategorien beim naechsten Login erstellt.

---

## 3. False Positives reduzieren

### Feedback Loop implementieren

Die Review-Queue ermoeglicht manuelles Korrigieren:

1. `/dashboard/review` zeigt unsichere Klassifizierungen
2. "Genehmigen", "Aendern" oder "Ablehnen"
3. Aenderungen werden in `processed_messages` gespeichert

### Regeln anpassen

**Haeufige Anpassungen:**

1. **Prioritaet erhoehen:** Spezifischere Regeln hoeher priorisieren
2. **Konfidenz anpassen:** Bei vielen False Positives -> Konfidenz senken
3. **Pattern verfeinern:** Regex statt Keyword fuer Praezision

**Beispiel: Newsletter-Regel verbessern:**

```typescript
// Vorher: Zu viele False Positives bei "News" im Betreff
{
  type: 'KEYWORD',
  pattern: 'news',
  confidence: 0.80,
}

// Nachher: Praeziser
{
  type: 'REGEX',
  pattern: '(newsletter|abmelden|unsubscribe)',
  field: 'BODY', // Nur im Body suchen
  confidence: 0.85,
}
```

### Analyse durchfuehren

```sql
-- Haeufig korrigierte Kategorien
SELECT
  pm.category_id,
  c.name as original_category,
  pm.reviewed_action,
  COUNT(*) as count
FROM processed_messages pm
JOIN categories c ON pm.category_id = c.id
WHERE pm.reviewed_action IS NOT NULL
GROUP BY pm.category_id, c.name, pm.reviewed_action
ORDER BY count DESC;

-- Low-Confidence Klassifizierungen
SELECT
  c.name,
  AVG(pm.confidence) as avg_confidence,
  COUNT(*) as count
FROM processed_messages pm
JOIN categories c ON pm.category_id = c.id
GROUP BY c.name
HAVING AVG(pm.confidence) < 0.7;
```

### LLM fuer schwierige Faelle

Wenn regelbasierte Klassifizierung nicht ausreicht:

1. LLM aktivieren (`LLM_PROVIDER=openai`)
2. LLM wird nur als Fallback genutzt (llmFallbackOnly: true)
3. LLM-Kosten ueberwachen

---

## 4. Migrations & Schema Updates

### Prisma Migration erstellen

```bash
cd prisma
npx prisma migrate dev --name beschreibung_der_aenderung
```

### Produktions-Deployment

```bash
# Automatisch bei Vercel Deploy oder manuell:
npx prisma migrate deploy
```

### Schema-Aenderungen testen

1. Lokale DB mit Test-Daten
2. Migration lokal testen
3. Preview Deployment in Vercel
4. Produktion deployen

### Rollback

Prisma unterstuetzt kein automatisches Rollback. Bei Problemen:

1. Vorherige Migration manuell rueckgaengig machen
2. `_prisma_migrations` Tabelle anpassen
3. Neues Deploy

---

## 5. Backup & Recovery

### Neon Backups

Neon erstellt automatische Backups:

1. [Neon Console](https://console.neon.tech)
2. Projekt waehlen
3. "Branches" -> Point-in-time Recovery

### Manuelles Backup

```bash
# pg_dump mit Neon Connection String
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Recovery

```bash
# Restore aus Backup
psql "$DATABASE_URL" < backup_20240115.sql
```

### Wichtige Tabellen

Bei Datenverlust priorisieren:
1. `users` - Account-Daten
2. `connections` + `oauth_tokens` - Verbindungen
3. `categories` + `rules` - Konfiguration
4. `processed_messages` - Kann regeneriert werden

---

## 6. Retry Strategie

### Implementierte Strategien

**Token Refresh:**
- Automatisch 5 Minuten vor Ablauf
- Bei Fehler: Connection Status -> `NEEDS_REAUTH`
- User muss neu autorisieren

**Email Processing:**
- Fehler werden pro Message geloggt
- Naechste Messages werden weiter verarbeitet
- Retry beim naechsten Cron-Run

**IMAP Connection:**
- Reconnect bei Verbindungsabbruch
- Max 3 Retries mit exponential Backoff (1s, 2s, 4s)

### Retry-Konfiguration

```typescript
// packages/shared/src/constants/index.ts
export const PROCESSING_LIMITS = {
  MAX_EMAILS_PER_RUN: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TOKEN_REFRESH_BUFFER_MINUTES: 5,
};
```

### Manueller Retry

1. Dashboard -> Verbindungen
2. Klicke "Test" (Haekchen-Icon)
3. Bei Erfolg: Status -> ACTIVE
4. Klicke "Play" fuer manuelle Verarbeitung

---

## 7. Skalierung

### Aktuelle Limits

| Ressource | Free Tier Limit |
|-----------|-----------------|
| Neon Storage | 512 MB |
| Neon Compute | 191.9 Hours/Monat |
| Vercel Functions | 100 GB-Hours |
| Vercel Cron | 1 Job (taeglich bei Hobby) |

### Multi-User Vorbereitung

Die Architektur unterstuetzt Multi-User:

1. Alle Daten sind user-scoped (`userId` Foreign Key)
2. Queries filtern nach User
3. Connections sind isoliert

**Fuer echtes Multi-User:**

1. User-Registrierung implementieren
2. Subscription-Modell (Stripe)
3. Usage-Limits pro User

### Performance-Optimierung

**Bei vielen Verbindungen:**

```typescript
// Parallel Processing mit Limit
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 gleichzeitig

const results = await Promise.all(
  connections.map(conn =>
    limit(() => processConnection(conn.id))
  )
);
```

**Bei vielen Regeln:**

- Regeln cachen (in Memory waehrend Processing)
- Nach Prioritaet sortieren
- Early Exit bei hoher Konfidenz

**Bei grossem Audit Log:**

```sql
-- Alte Eintraege loeschen
DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Index hinzufuegen
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

### Upgrade-Pfad

1. **Neon Pro:** Mehr Storage, Compute, Branches
2. **Vercel Pro:** Mehr Functions, Cron-Intervalle
3. **Dedicated Infrastructure:** Bei sehr hohem Volumen
