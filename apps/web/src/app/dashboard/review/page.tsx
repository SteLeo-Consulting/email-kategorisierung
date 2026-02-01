'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { RefreshCw, Check, X, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, truncate } from '@/lib/utils';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';
import { useSettings } from '@/contexts/SettingsContext';

interface ProcessedMessage {
  id: string;
  messageId: string;
  emailSubject: string | null;
  emailFrom: string | null;
  emailDate: string | null;
  confidence: number;
  rationale: string | null;
  needsReview: boolean;
  connection: {
    provider: string;
    email: string;
  };
  category: {
    name: string;
    internalCode: string;
    color: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
  internalCode: string;
  color: string;
}

export default function ReviewPage() {
  const [messages, setMessages] = useState<ProcessedMessage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const userEmail = useUserEmail();
  const { t } = useSettings();

  const fetchData = async () => {
    if (!userEmail) return;

    try {
      const [messagesRes, categoriesRes] = await Promise.all([
        fetch(buildApiUrl(`/api/processed-messages?needsReview=true&page=${page}&pageSize=20`, userEmail)),
        fetch(buildApiUrl('/api/categories', userEmail)),
      ]);

      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.messages || []);
        setTotalPages(data.pagination?.totalPages || 1);
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
  }, [page, userEmail]);

  const handleReview = async (
    id: string,
    action: 'approve' | 'change' | 'reject',
    newCategoryId?: string
  ) => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl(`/api/processed-messages/${id}/review`, userEmail), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, newCategoryId }),
      });

      if (res.ok) {
        toast({
          title:
            action === 'approve'
              ? 'Genehmigt'
              : action === 'change'
              ? 'Kategorie geaendert'
              : 'Abgelehnt',
        });
        // Remove from list
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        const error = await res.json();
        toast({ title: 'Fehler', description: error.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Netzwerkfehler', variant: 'destructive' });
    }
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
          <h1 className="text-3xl font-bold">{t('review.title')}</h1>
          <p className="text-muted-foreground">
            {t('review.subtitle')}
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('review.forReview')} ({messages.length})</CardTitle>
          <CardDescription>
            {t('review.reviewDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Absender</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Vorschlag</TableHead>
                    <TableHead>Konfidenz</TableHead>
                    <TableHead>Neue Kategorie</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell className="max-w-xs truncate font-medium">
                        {msg.emailSubject || '(Kein Betreff)'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {msg.emailFrom || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {msg.emailDate ? formatDate(msg.emailDate) : '-'}
                      </TableCell>
                      <TableCell>
                        {msg.category ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: msg.category.color }}
                            />
                            <span>{msg.category.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            msg.confidence >= 0.6 ? 'secondary' : 'destructive'
                          }
                        >
                          {(msg.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedCategory[msg.id] || ''}
                          onValueChange={(v) =>
                            setSelectedCategory((prev) => ({
                              ...prev,
                              [msg.id]: v,
                            }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Ändern..." />
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
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(msg.id, 'approve')}
                            title="Genehmigen"
                            className="text-green-600"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          {selectedCategory[msg.id] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleReview(msg.id, 'change', selectedCategory[msg.id])
                              }
                              title="Mit neuer Kategorie speichern"
                              className="text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(msg.id, 'reject')}
                            title="Ablehnen (Label entfernen)"
                            className="text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Seite {page} von {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Keine E-Mails zur Prüfung vorhanden. Gut gemacht!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
