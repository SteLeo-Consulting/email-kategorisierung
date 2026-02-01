'use client';

import { useEffect, useState } from 'react';
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
  Mail,
} from 'lucide-react';
import { formatDate, getProviderDisplayName } from '@/lib/utils';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';

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
  const userEmail = useUserEmail();

  const fetchConnections = async () => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl('/api/connections', userEmail));
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
    if (userEmail) {
      fetchConnections();
    }
  }, [userEmail]);

  const handleAddIMAP = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/connections', userEmail), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imapForm),
      });

      if (res.ok) {
        toast({ title: 'IMAP-Verbindung hinzugefügt' });
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
      const res = await fetch(buildApiUrl(`/api/connections/${id}/test`, userEmail), {
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

  const handleProcess = async (id: string, reprocessAll = false) => {
    try {
      toast({
        title: reprocessAll ? 'Verarbeite alle E-Mails...' : 'Verarbeitung gestartet...',
        description: 'Dies kann einen Moment dauern.'
      });

      const res = await fetch(buildApiUrl(`/api/connections/${id}/process`, userEmail), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxEmails: reprocessAll ? 100 : 50,
          reprocessAll
        }),
      });

      const data = await res.json();
      if (data.success) {
        const { messagesProcessed, messagesLabeled, messagesReview } = data.result;
        toast({
          title: 'Verarbeitung abgeschlossen',
          description: messagesProcessed === 0
            ? 'Keine neuen E-Mails gefunden.'
            : `${messagesProcessed} E-Mails verarbeitet, ${messagesLabeled} gelabelt, ${messagesReview} zur Prüfung`,
        });
        fetchConnections();
      } else {
        toast({
          title: 'Verarbeitung fehlgeschlagen',
          description: data.error || 'Unbekannter Fehler',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler bei der Verarbeitung',
        description: 'Netzwerkfehler - bitte erneut versuchen',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Verbindung wirklich löschen?')) return;

    try {
      const res = await fetch(buildApiUrl(`/api/connections/${id}`, userEmail), {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Verbindung gelöscht' });
        fetchConnections();
      }
    } catch (error) {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
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

  if (loading && !userEmail) {
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

      {/* Add Connection Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Dialog open={imapDialogOpen} onOpenChange={setImapDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  IMAP (Strato, GMX, etc.)
                </CardTitle>
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
              <DialogTitle>IMAP-Verbindung hinzufügen</DialogTitle>
              <DialogDescription>
                Gib die IMAP-Zugangsdaten ein. Für Strato sind die Standardwerte bereits eingetragen.
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
                          onClick={() => handleProcess(conn.id, false)}
                          title="Neue E-Mails verarbeiten"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleProcess(conn.id, true)}
                          title="Alle E-Mails erneut verarbeiten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(conn.id)}
                          title="Löschen"
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
              Noch keine Verbindungen. Füge oben eine hinzu.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
