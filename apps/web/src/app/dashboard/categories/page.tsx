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
import { RefreshCw, Settings, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';
import { useSettings } from '@/contexts/SettingsContext';

interface Category {
  id: string;
  name: string;
  internalCode: string;
  description: string | null;
  color: string;
  icon: string | null;
  isSystem: boolean;
  isActive: boolean;
  _count: {
    rules: number;
    labelMappings: number;
    processedMessages: number;
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    isActive: true,
  });
  const { toast } = useToast();
  const userEmail = useUserEmail();
  const { t } = useSettings();

  const fetchCategories = async () => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl('/api/categories', userEmail));
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchCategories();
    }
  }, [userEmail]);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setEditForm({
      name: category.name,
      description: category.description || '',
      color: category.color,
      isActive: category.isActive,
    });
  };

  const handleSave = async () => {
    if (!editingCategory || !userEmail) return;

    try {
      const res = await fetch(buildApiUrl(`/api/categories/${editingCategory.id}`, userEmail), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        toast({ title: 'Kategorie aktualisiert' });
        setEditingCategory(null);
        fetchCategories();
      } else {
        const error = await res.json();
        toast({
          title: 'Fehler',
          description: error.error || 'Kategorie konnte nicht aktualisiert werden',
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

  const handleDelete = async (category: Category) => {
    if (!userEmail) return;

    if (category.isSystem) {
      toast({
        title: 'Nicht erlaubt',
        description: 'System-Kategorien können nicht gelöscht werden. Du kannst sie deaktivieren.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Kategorie "${category.name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(buildApiUrl(`/api/categories/${category.id}`, userEmail), {
        method: 'DELETE',
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: data.message ? 'Kategorie deaktiviert' : 'Kategorie gelöscht',
          description: data.message,
        });
        fetchCategories();
      } else {
        const error = await res.json();
        toast({
          title: 'Fehler',
          description: error.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (category: Category) => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl(`/api/categories/${category.id}`, userEmail), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive }),
      });

      if (res.ok) {
        toast({
          title: category.isActive ? 'Kategorie deaktiviert' : 'Kategorie aktiviert',
        });
        fetchCategories();
      }
    } catch (error) {
      toast({ title: 'Fehler', variant: 'destructive' });
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
          <h1 className="text-3xl font-bold">{t('categories.title')}</h1>
          <p className="text-muted-foreground">
            {t('categories.subtitle')}
          </p>
        </div>
        <Button onClick={fetchCategories} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('categories.availableCategories')}</CardTitle>
          <CardDescription>
            {t('categories.categoriesUsed')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Regeln</TableHead>
                <TableHead>Verarbeitet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id} className={!cat.isActive ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {cat.internalCode}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {cat.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/rules?category=${cat.id}`}>
                      <Button variant="link" className="p-0 h-auto">
                        {cat._count.rules} Regel(n)
                      </Button>
                    </Link>
                  </TableCell>
                  <TableCell>{cat._count.processedMessages}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cat.isActive}
                        onCheckedChange={() => handleToggleActive(cat)}
                      />
                      {cat.isSystem && (
                        <Badge variant="outline">System</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(cat)}
                        title="Bearbeiten"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!cat.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cat)}
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Einstellungen für "{editingCategory?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Kategoriename"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Beschreibung der Kategorie"
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  placeholder="#6366f1"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
              />
              <Label>Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Hinweis zu System-Kategorien</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Die vordefinierten System-Kategorien (INVOICE, APPOINTMENT, etc.) wurden automatisch
            erstellt und enthalten bereits Standardregeln. Du kannst diese Regeln anpassen oder
            neue hinzufügen. System-Kategorien können nicht gelöscht, aber deaktiviert werden.
          </p>
          <div className="mt-4">
            <Link href="/dashboard/rules">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Regeln verwalten
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
