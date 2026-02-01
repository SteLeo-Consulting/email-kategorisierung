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
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: any;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  } | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const userEmail = useUserEmail();

  const fetchLogs = async () => {
    if (!userEmail) return;

    try {
      const res = await fetch(buildApiUrl(`/api/audit?page=${page}&pageSize=30`, userEmail));
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchLogs();
    }
  }, [page, userEmail]);

  const getActionBadge = (action: string) => {
    if (action.includes('CREATED')) {
      return <Badge variant="success">Erstellt</Badge>;
    }
    if (action.includes('DELETED')) {
      return <Badge variant="destructive">Gelöscht</Badge>;
    }
    if (action.includes('ERROR') || action.includes('FAILED')) {
      return <Badge variant="destructive">Fehler</Badge>;
    }
    if (action.includes('COMPLETED')) {
      return <Badge variant="success">Abgeschlossen</Badge>;
    }
    return <Badge variant="secondary">{action.replace(/_/g, ' ')}</Badge>;
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
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
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            Protokoll aller Systemaktivitäten
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitäten</CardTitle>
          <CardDescription>
            Alle Aktionen im System werden hier protokolliert
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.entityType || '-'}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {log.details && (
                      <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                        {JSON.stringify(log.details).slice(0, 100)}
                        {JSON.stringify(log.details).length > 100 && '...'}
                      </code>
                    )}
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
        </CardContent>
      </Card>
    </div>
  );
}
