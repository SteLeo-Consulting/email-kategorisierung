# Einfache Deploy-Anleitung

## Methode A: Über GitHub Desktop (Empfohlen für Einsteiger)

### Schritt 1: GitHub Desktop installieren
1. Gehe zu: https://desktop.github.com/
2. Download und installieren
3. Mit deinem GitHub Account anmelden

### Schritt 2: Repository erstellen
1. In GitHub Desktop: **File** → **New Repository**
2. Name: `email-kategorisierung`
3. Local path: Wähle den Ordner `C:\Users\Administrator\Desktop\Claude\Email Kategorisierung`
4. ✅ "Initialize with README" NICHT ankreuzen (wir haben schon eine)
5. Klicke **Create Repository**

### Schritt 3: Ersten Commit machen
1. Du siehst links alle Dateien
2. Unten bei "Summary": Schreibe `Initial commit`
3. Klicke **Commit to main**

### Schritt 4: Zu GitHub hochladen
1. Klicke oben **Publish repository**
2. Name: `email-kategorisierung`
3. ❌ "Keep this code private" - kannst du ankreuzen wenn du willst
4. Klicke **Publish Repository**

---

## Methode B: Direkt über die Kommandozeile

Falls du Git schon installiert hast:

```bash
cd "C:\Users\Administrator\Desktop\Claude\Email Kategorisierung"

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/email-kategorisierung.git
git push -u origin main
```

Ersetze `DEIN-USERNAME` mit deinem GitHub Benutzernamen.

---

## Nach dem Upload: Vercel Deployment

1. Gehe zu: https://vercel.com/new
2. Klicke **Import Git Repository**
3. Wähle `email-kategorisierung`
4. Bei **Root Directory**: Klicke "Edit" und gib ein: `apps/web`
5. Klicke **Deploy**

Es wird erstmal fehlschlagen - das ist OK! Wir müssen noch die Environment Variables setzen.

---

## Für Claude Code: Deployment-Workflow

Dieses Projekt ist ein **Monorepo** mit zwei separaten Vercel-Projekten:
- **api** - Backend API (apps/api)
- **web** - Frontend Web App (apps/web)

### WICHTIG: Manuelles Deployment via Vercel CLI

GitHub Push triggert KEIN automatisches Deployment! Deployment muss manuell via Vercel CLI erfolgen.

### Standard-Deployment (nach Code-Änderungen)

```bash
# 1. Änderungen committen und pushen (für Versionierung)
git add <geänderte-dateien>
git commit -m "Beschreibung der Änderung

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push

# 2. API deployen (wenn API-Code geändert wurde)
cd "C:\Users\Administrator\Desktop\Claude\Email Kategorisierung\apps\api"
vercel --prod

# 3. Web deployen (wenn Web-Code geändert wurde)
cd "C:\Users\Administrator\Desktop\Claude\Email Kategorisierung\apps\web"
vercel --prod
```

### Welches Projekt deployen?

| Geänderte Dateien | Zu deployen |
|-------------------|-------------|
| `apps/api/**` | API: `cd apps/api && vercel --prod` |
| `apps/web/**` | Web: `cd apps/web && vercel --prod` |
| `packages/shared/**` | Beide: API und Web |
| Beide apps | Beide deployen |

### Vercel CLI Befehle

```bash
# Production Deployment
vercel --prod

# Preview Deployment (zum Testen)
vercel

# Logs anzeigen
vercel logs <deployment-url>

# Letztes Deployment erneut deployen
vercel redeploy <deployment-url>
```

### Vercel Projekt-URLs

- **API**: https://api-vert-kappa-96.vercel.app
- **Web**: https://web-delta-blue-48.vercel.app

### Repository

- GitHub: https://github.com/SteLeo-Consulting/email-kategorisierung.git

### Bei Build-Fehlern auf Vercel

1. Prüfe die Vercel Build-Logs unter: https://vercel.com/dashboard
2. Häufige Probleme:
   - Fehlende Environment Variables → Im Vercel Dashboard unter Project Settings > Environment Variables setzen
   - Prisma Client Fehler → Wird automatisch während des Vercel Builds generiert
   - TypeScript Fehler → Lokal mit `npm run build` testen vor dem Push
