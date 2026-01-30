'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [detectedServer, setDetectedServer] = useState<string | null>(null);

  // Auto-detect IMAP server when email changes
  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setError('');
    setDetectedServer(null);

    // Detect IMAP server for the domain
    if (newEmail.includes('@')) {
      try {
        const res = await fetch(`/api/auth/imap?email=${encodeURIComponent(newEmail)}`);
        const data = await res.json();
        if (data.detected && data.host) {
          setDetectedServer(data.host);
          if (!showAdvanced) {
            setImapHost(data.host);
            setImapPort(String(data.port));
          }
        }
      } catch {
        // Ignore detection errors
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // First, authenticate with IMAP
      const imapRes = await fetch('/api/auth/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          host: showAdvanced && imapHost ? imapHost : undefined,
          port: showAdvanced && imapPort ? parseInt(imapPort) : undefined,
          secure: true,
        }),
      });

      const imapData = await imapRes.json();

      if (!imapRes.ok) {
        setError(imapData.error || 'Anmeldung fehlgeschlagen');
        setIsLoading(false);
        return;
      }

      // Then, create NextAuth session
      const result = await signIn('imap', {
        email: imapData.user.email,
        userId: imapData.user.id,
        connectionId: imapData.connection.id,
        redirect: false,
      });

      if (result?.error) {
        setError('Session konnte nicht erstellt werden');
        setIsLoading(false);
        return;
      }

      // Success! Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Kategorisierung</CardTitle>
          <CardDescription>
            Automatische E-Mail-Klassifizierung mit Labels und Tags
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="deine@email.de"
                  value={email}
                  onChange={handleEmailChange}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
              {detectedServer && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Server erkannt: {detectedServer}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="Dein E-Mail-Passwort oder App-Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              {email.includes('gmail') && (
                <p className="text-xs text-amber-600">
                  Fuer Gmail brauchst du ein{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    App-Passwort
                  </a>
                </p>
              )}
            </div>

            {/* Advanced settings toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Erweiterte Einstellungen
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="imapHost">IMAP-Server</Label>
                  <Input
                    id="imapHost"
                    type="text"
                    placeholder="z.B. imap.gmail.com"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imapPort">Port</Label>
                  <Input
                    id="imapPort"
                    type="number"
                    placeholder="993"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verbinde...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Anmelden
                </>
              )}
            </Button>
          </form>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-center text-muted-foreground">
              Funktioniert mit Gmail, GMX, Web.de, Outlook, Strato, 1&1 und allen anderen E-Mail-Anbietern
            </p>
          </div>

          <Separator className="my-4" />

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Dein Passwort wird verschluesselt gespeichert und nur zur E-Mail-Abfrage verwendet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
