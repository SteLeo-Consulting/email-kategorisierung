'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  RefreshCw,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { formatDate, getProviderDisplayName } from '@/lib/utils';

interface Connection {
  id: string;
  provider: string;
  email: string;
  displayName: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  _count: {
    processedMessages: number;
    labelMappings: number;
  };
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [imapDialogOpen, setImapDialogOpen] = useState(false);
  const [imapForm, setImapForm] = useState({
    host: 'imap.strato.de',
    port: 993,
    secure: true,
    username: '',
    password: '',
  });
  const { toast } = useToast();

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleAddIMAP = async () => {
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imapForm),
      });

      if (res.ok) {
        toast({ title: 'IMAP-Verbindung hinzugefuegt' });
        setImapDialogOpen(false);
        fetchConnections();
      } else {
        const error = await res.json();
        toast({
          title: 'Fehler',
          description: error.error || 'Verbindung konnte nicht erstellt werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`/api/connections/${id}/test`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Verbindungstest erfolgreich' });
        fetchConnections();
      } else {
        toast({
          title: 'Verbindungstest fehlgeschlagen',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Fehler beim Testen', variant: 'destructive' });
    }
  };

  const handleProcess = async (id: string) => {
    try {
      toast({ title: 'Verarbeitung gestartet...' });

      const res = await fetch(`/api/connections/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxEmails: 10 }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Verarbeitung abgeschlossen',
          description: `${data.result.messagesProcessed} E-Mails verarbeitet, ${data.result.messagesLabeled} gelabelt`,
        });
        fetchConnections();
      } else {
        toast({
          title: 'Verarbeitung fehlgeschlagen',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Fehler bei der Verarbeitung', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Verbindung wirklich loeschen?')) return;

    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Verbindung geloescht' });
        fetchConnections();
      }
    } catch (error) {
      toast({ title: 'Fehler beim Loeschen', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Aktiv</Badge>;
      case 'ERROR':
        return <Badge variant="destructive">Fehler</Badge>;
      case 'NEEDS_REAUTH':
        return <Badge variant="warning">Neu anmelden</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verbindungen</h1>
          <p className="text-muted-foreground">
            Verwalte deine E-Mail-Provider-Verbindungen
          </p>
        </div>
      </div>

      {/* Add Connection Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => signIn('google', { callbackUrl: '/dashboard/connections' })}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Gmail
            </CardTitle>
            <CardDescription>Mit Google verbinden</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Verbinden
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => signIn('azure-ad', { callbackUrl: '/dashboard/connections' })}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Outlook / Microsoft 365
            </CardTitle>
            <CardDescription>Mit Microsoft verbinden</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Verbinden
            </Button>
          </CardContent>
        </Card>

        <Dialog open={imapDialogOpen} onOpenChange={setImapDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">IMAP (Strato, andere)</CardTitle>
                <CardDescription>Mit IMAP-Server verbinden</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Konfigurieren
                </Button>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>IMAP-Verbindung hinzufuegen</DialogTitle>
              <DialogDescription>
                Gib die IMAP-Zugangsdaten ein. Fuer Strato sind die Standardwerte bereits eingetragen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IMAP Server</Label>
                  <Input
                    value={imapForm.host}
                    onChange={(e) => setImapForm({ ...imapForm, host: e.target.value })}
                    placeholder="imap.strato.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={imapForm.port}
                    onChange={(e) => setImapForm({ ...imapForm, port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={imapForm.secure}
                  onCheckedChange={(checked) => setImapForm({ ...imapForm, secure: checked })}
                />
                <Label>SSL/TLS verwenden</Label>
              </div>
              <div className="space-y-2">
                <Label>E-Mail / Benutzername</Label>
                <Input
                  value={imapForm.username}
                  onChange={(e) => setImapForm({ ...imapForm, username: e.target.value })}
                  placeholder="deine@email.de"
                />
              </div>
              <div className="space-y-2">
                <Label>Passwort</Label>
                <Input
                  type="password"
                  value={imapForm.password}
                  onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                  placeholder="App-Passwort eingeben"
                />
                <p className="text-xs text-muted-foreground">
                  Bei 2FA verwende ein App-spezifisches Passwort
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImapDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleAddIMAP}>Verbinden</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Connections */}
      <Card>
        <CardHeader>
          <CardTitle>Aktive Verbindungen</CardTitle>
          <CardDescription>
            {connections.length} Verbindung(en) konfiguriert
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Letzte Sync</TableHead>
                  <TableHead>Verarbeitet</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell className="font-medium">
                      {getProviderDisplayName(conn.provider)}
                    </TableCell>
                    <TableCell>{conn.email}</TableCell>
                    <TableCell>{getStatusBadge(conn.status)}</TableCell>
                    <TableCell>
                      {conn.lastSyncAt ? formatDate(conn.lastSyncAt) : 'Nie'}
                    </TableCell>
                    <TableCell>{conn._count.processedMessages}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(conn.id)}
                          title="Verbindung testen"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleProcess(conn.id)}
                          title="Jetzt verarbeiten"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(conn.id)}
                          title="Loeschen"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Noch keine Verbindungen. Fuege oben eine hinzu.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
