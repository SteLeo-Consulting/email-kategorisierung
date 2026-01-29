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
