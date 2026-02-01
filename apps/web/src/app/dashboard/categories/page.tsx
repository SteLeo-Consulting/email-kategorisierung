'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, Settings } from 'lucide-react';
import Link from 'next/link';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';

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
  const userEmail = useUserEmail();

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
          <h1 className="text-3xl font-bold">Kategorien</h1>
          <p className="text-muted-foreground">
            Verwalte die E-Mail-Kategorien für die Klassifizierung
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verfügbare Kategorien</CardTitle>
          <CardDescription>
            Diese Kategorien werden zur Klassifizierung verwendet
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
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
                    {cat.isActive ? (
                      <Badge variant="success">Aktiv</Badge>
                    ) : (
                      <Badge variant="secondary">Inaktiv</Badge>
                    )}
                    {cat.isSystem && (
                      <Badge variant="outline" className="ml-1">
                        System
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hinweis zu System-Kategorien</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Die vordefinierten System-Kategorien (INVOICE, APPOINTMENT, etc.) wurden automatisch
            erstellt und enthalten bereits Standardregeln. Du kannst diese Regeln anpassen oder
            neue hinzufügen.
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
