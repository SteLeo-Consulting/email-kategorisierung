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
import { Plus, RefreshCw, Trash2, Sparkles, Edit } from 'lucide-react';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';
import { useSettings } from '@/contexts/SettingsContext';

interface Rule {
  id: string;
  categoryId: string;
  name: string;
  type: string;
  field: string;
  pattern: string;
  caseSensitive: boolean;
  priority: number;
  confidence: number;
  isActive: boolean;
  useLLM?: boolean;
  category: {
    id: string;
    name: string;
    internalCode: string;
    color: string;
  };
}

interface Category {
  id: string;
  name: string;
  internalCode: string;
  color: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    type: 'KEYWORD',
    field: 'ANY',
    pattern: '',
    caseSensitive: false,
    priority: 50,
    confidence: 0.85,
    useLLM: false,
  });
  const { toast } = useToast();
  const userEmail = useUserEmail();
  const { t } = useSettings();

  const fetchData = async () => {
    if (!userEmail) return;

    try {
      const [rulesRes, categoriesRes] = await Promise.all([
        fetch(buildApiUrl('/api/rules', userEmail)),
        fetch(buildApiUrl('/api/categories', userEmail)),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchData();
    }
  }, [userEmail]);

  const handleCreate = async () => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl('/api/rules', userEmail), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast({ title: 'Regel erstellt' });
        setDialogOpen(false);
        setForm({
          categoryId: '',
          name: '',
          type: 'KEYWORD',
          field: 'ANY',
          pattern: '',
          caseSensitive: false,
          priority: 50,
          confidence: 0.85,
          useLLM: false,
        });
        fetchData();
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
    if (!confirm('Regel wirklich löschen?')) return;

    try {
      const res = await fetch(buildApiUrl(`/api/rules/${id}`, userEmail), {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Regel gelöscht' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    if (!userEmail) return;

    try {
      await fetch(buildApiUrl(`/api/rules/${id}`, userEmail), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setForm({
      categoryId: rule.categoryId || rule.category.id,
      name: rule.name,
      type: rule.type,
      field: rule.field,
      pattern: rule.pattern,
      caseSensitive: rule.caseSensitive,
      priority: rule.priority,
      confidence: rule.confidence,
      useLLM: rule.type === 'LLM',
    });
  };

  const handleUpdate = async () => {
    if (!editingRule || !userEmail) return;

    try {
      const res = await fetch(buildApiUrl(`/api/rules/${editingRule.id}`, userEmail), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          field: form.field,
          pattern: form.pattern,
          caseSensitive: form.caseSensitive,
          priority: form.priority,
          confidence: form.confidence,
        }),
      });

      if (res.ok) {
        toast({ title: 'Regel aktualisiert' });
        setEditingRule(null);
        setForm({
          categoryId: '',
          name: '',
          type: 'KEYWORD',
          field: 'ANY',
          pattern: '',
          caseSensitive: false,
          priority: 50,
          confidence: 0.85,
          useLLM: false,
        });
        fetchData();
      } else {
        const error = await res.json();
        toast({
          title: 'Fehler',
          description: error.error || 'Regel konnte nicht aktualisiert werden',
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

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setForm({
      categoryId: '',
      name: '',
      type: 'KEYWORD',
      field: 'ANY',
      pattern: '',
      caseSensitive: false,
      priority: 50,
      confidence: 0.85,
      useLLM: false,
    });
  };

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
          <h1 className="text-3xl font-bold">{t('rules.title')}</h1>
          <p className="text-muted-foreground">
            {t('rules.subtitle')}
          </p>
        </div>
        <Dialog open={dialogOpen || !!editingRule} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('rules.newRule')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Regel bearbeiten' : 'Neue Regel erstellen'}</DialogTitle>
              <DialogDescription>
                {editingRule
                  ? `Bearbeite die Regel "${editingRule.name}"`
                  : 'Definiere ein Muster zur automatischen Kategorisierung'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kategorie</Label>
                {editingRule ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: editingRule.category.color }}
                    />
                    <span className="text-muted-foreground">{editingRule.category.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">(nicht änderbar)</span>
                  </div>
                ) : (
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => setForm({ ...form, categoryId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Regelname</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. Rechnung im Betreff"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Regeltyp</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KEYWORD">Keyword</SelectItem>
                      <SelectItem value="REGEX">Regex</SelectItem>
                      <SelectItem value="SENDER">Absender</SelectItem>
                      <SelectItem value="LLM">LLM (KI-basiert)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Feld</Label>
                  <Select
                    value={form.field}
                    onValueChange={(v) => setForm({ ...form, field: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">Alle Felder</SelectItem>
                      <SelectItem value="FROM">Absender</SelectItem>
                      <SelectItem value="SUBJECT">Betreff</SelectItem>
                      <SelectItem value="BODY">Inhalt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Muster / Beschreibung</Label>
                <Input
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                  placeholder={
                    form.type === 'LLM'
                      ? 'z.B. E-Mails die eine Rechnung oder Zahlungsaufforderung enthalten'
                      : form.type === 'REGEX'
                      ? 'z.B. (rechnung|invoice)'
                      : 'z.B. rechnung'
                  }
                />
                {form.type === 'LLM' && (
                  <p className="text-xs text-muted-foreground">
                    Beschreibe in natürlicher Sprache, welche E-Mails erkannt werden sollen
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priorität (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Konfidenz (0-1)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={form.confidence}
                    onChange={(e) =>
                      setForm({ ...form, confidence: parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>

              {form.type !== 'LLM' && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.caseSensitive}
                    onCheckedChange={(v) => setForm({ ...form, caseSensitive: v })}
                  />
                  <Label>Groß-/Kleinschreibung beachten</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Abbrechen
              </Button>
              {editingRule ? (
                <Button onClick={handleUpdate} disabled={!form.name || !form.pattern}>
                  Speichern
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={!form.categoryId || !form.name || !form.pattern}>
                  Erstellen
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktive Regeln ({rules.length})</CardTitle>
          <CardDescription>
            Regeln werden nach Priorität absteigend angewendet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Muster</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Konfidenz</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: rule.category.color }}
                        />
                        {rule.category.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {rule.type === 'LLM' && <Sparkles className="h-3 w-3" />}
                        {rule.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs">
                      {rule.pattern}
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>{(rule.confidence * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggle(rule.id, rule.isActive)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rule)}
                          title="Bearbeiten"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
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
              Noch keine Regeln erstellt. Klicke auf "Neue Regel" um zu beginnen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
