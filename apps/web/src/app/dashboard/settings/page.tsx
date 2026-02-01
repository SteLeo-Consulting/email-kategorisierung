'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Plus, Trash2, Key, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';

interface LLMProvider {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  status: 'active' | 'error' | 'unchecked';
  createdAt: string;
}

const PROVIDERS = [
  { value: 'mistral', label: 'Mistral AI', models: ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large-latest'] },
  { value: 'openai', label: 'OpenAI', models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'] },
  { value: 'groq', label: 'Groq', models: ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
];

export default function SettingsPage() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    provider: 'mistral',
    apiKey: '',
    model: 'mistral-large-latest',
    isDefault: false,
  });
  const { toast } = useToast();
  const userEmail = useUserEmail();

  const fetchProviders = async () => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl('/api/llm-providers', userEmail));
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchProviders();
    }
  }, [userEmail]);

  const handleAdd = async () => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl('/api/llm-providers', userEmail), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast({ title: 'LLM Provider hinzugefügt' });
        setShowAddForm(false);
        setForm({
          name: '',
          provider: 'mistral',
          apiKey: '',
          model: 'mistral-large-latest',
          isDefault: false,
        });
        fetchProviders();
      } else {
        const error = await res.json();
        toast({
          title: 'Fehler',
          description: error.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Netzwerkfehler', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!userEmail) return;
    if (!confirm('Provider wirklich löschen?')) return;

    try {
      const res = await fetch(buildApiUrl(`/api/llm-providers/${id}`, userEmail), {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Provider gelöscht' });
        fetchProviders();
      }
    } catch (error) {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const handleTest = async (id: string) => {
    if (!userEmail) return;
    setTestingId(id);

    try {
      const res = await fetch(buildApiUrl(`/api/llm-providers/${id}/test`, userEmail), {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Verbindung erfolgreich!' });
      } else {
        toast({
          title: 'Verbindung fehlgeschlagen',
          description: data.error,
          variant: 'destructive',
        });
      }
      fetchProviders();
    } catch (error) {
      toast({ title: 'Fehler beim Testen', variant: 'destructive' });
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!userEmail) return;

    try {
      await fetch(buildApiUrl(`/api/llm-providers/${id}`, userEmail), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      fetchProviders();
      toast({ title: 'Standard-Provider gesetzt' });
    } catch (error) {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const selectedProvider = PROVIDERS.find(p => p.value === form.provider);

  if (loading || !userEmail) {
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
          <h1 className="text-3xl font-bold">Einstellungen</h1>
          <p className="text-muted-foreground">
            LLM-APIs und andere Konfigurationen
          </p>
        </div>
      </div>

      {/* LLM Providers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                LLM API Verbindungen
              </CardTitle>
              <CardDescription>
                KI-APIs für intelligente E-Mail-Klassifizierung
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Neue API
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="z.B. Mein Mistral Account"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={form.provider}
                    onValueChange={(v) => setForm({ ...form, provider: v, model: PROVIDERS.find(p => p.value === v)?.models[0] || '' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                      placeholder="API Key eingeben"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Modell</Label>
                  <Select
                    value={form.model}
                    onValueChange={(v) => setForm({ ...form, model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider?.models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleAdd} disabled={!form.name || !form.apiKey}>
                  Hinzufügen
                </Button>
              </div>
            </div>
          )}

          {providers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Modell</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PROVIDERS.find(p => p.value === provider.provider)?.label || provider.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{provider.model}</TableCell>
                    <TableCell>
                      {provider.status === 'active' ? (
                        <Badge variant="success" className="flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          Aktiv
                        </Badge>
                      ) : provider.status === 'error' ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" />
                          Fehler
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Ungetestet</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {provider.isDefault ? (
                        <Badge variant="success">Standard</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(provider.id)}
                        >
                          Als Standard
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(provider.id)}
                          disabled={testingId === provider.id}
                        >
                          {testingId === provider.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(provider.id)}
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
              Noch keine LLM-APIs konfiguriert. Füge eine hinzu um KI-basierte Klassifizierung zu nutzen.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Über LLM-Klassifizierung</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Mit einer LLM-API kannst du E-Mails intelligent klassifizieren lassen.
            Das LLM analysiert den Inhalt und entscheidet basierend auf deinen Regeln.
          </p>
          <p>
            <strong>Unterstützte Anbieter:</strong> Mistral AI, OpenAI, Anthropic, Groq
          </p>
          <p>
            Um LLM-Regeln zu nutzen, wähle bei "Regeln" den Typ "LLM (KI-basiert)" aus.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
