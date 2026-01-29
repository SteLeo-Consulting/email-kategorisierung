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
import { Plus, RefreshCw, Trash2, Edit } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  type: string;
  field: string;
  pattern: string;
  caseSensitive: boolean;
  priority: number;
  confidence: number;
  isActive: boolean;
  category: {
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
  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    type: 'KEYWORD',
    field: 'ANY',
    pattern: '',
    caseSensitive: false,
    priority: 50,
    confidence: 0.85,
  });
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [rulesRes, categoriesRes] = await Promise.all([
        fetch('/api/rules'),
        fetch('/api/categories'),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/rules', {
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
    if (!confirm('Regel wirklich loeschen?')) return;

    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Regel geloescht' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Fehler beim Loeschen', variant: 'destructive' });
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Fehler', variant: 'destructive' });
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
          <h1 className="text-3xl font-bold">Klassifikationsregeln</h1>
          <p className="text-muted-foreground">
            Regeln fuer die automatische E-Mail-Kategorisierung
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neue Regel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Neue Regel erstellen</DialogTitle>
              <DialogDescription>
                Definiere ein Muster zur automatischen Kategorisierung
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie waehlen" />
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
                <Label>Muster</Label>
                <Input
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                  placeholder={
                    form.type === 'REGEX'
                      ? 'z.B. (rechnung|invoice)'
                      : 'z.B. rechnung'
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioritaet (0-100)</Label>
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

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.caseSensitive}
                  onCheckedChange={(v) => setForm({ ...form, caseSensitive: v })}
                />
                <Label>Gross-/Kleinschreibung beachten</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={!form.categoryId || !form.name || !form.pattern}>
                Erstellen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktive Regeln ({rules.length})</CardTitle>
          <CardDescription>
            Regeln werden nach Prioritaet absteigend angewendet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Muster</TableHead>
                <TableHead>Prioritaet</TableHead>
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
                    <Badge variant="outline">{rule.type}</Badge>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
