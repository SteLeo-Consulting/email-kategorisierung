'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Link as LinkIcon,
  Mail,
  Tags,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  connections: {
    total: number;
    active: number;
    error: number;
    needsReauth: number;
  };
  categories: number;
  rules: number;
  processed: {
    today: number;
    total: number;
  };
  needsReview: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    color: string;
    count: number;
  }>;
  recentActivity: Array<{
    action: string;
    entityType: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Uebersicht ueber deine E-Mail-Kategorisierung
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verbindungen</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.connections.total || 0}</div>
            <div className="flex gap-2 mt-1">
              {(stats?.connections.active ?? 0) > 0 && (
                <Badge variant="success">{stats?.connections.active} aktiv</Badge>
              )}
              {(stats?.connections.error ?? 0) > 0 && (
                <Badge variant="destructive">{stats?.connections.error} Fehler</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heute verarbeitet</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processed.today || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.processed.total || 0} insgesamt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kategorien</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.categories || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.rules || 0} aktive Regeln
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zur Pruefung</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.needsReview || 0}</div>
            <Link href="/dashboard/review">
              <Button variant="link" className="p-0 h-auto text-xs">
                Jetzt pruefen
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kategorieverteilung</CardTitle>
            <CardDescription>Verteilung der klassifizierten E-Mails</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {stats.categoryBreakdown.slice(0, 6).map((cat) => (
                  <div key={cat.categoryId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-sm">{cat.categoryName}</span>
                    </div>
                    <Badge variant="secondary">{cat.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine E-Mails klassifiziert
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivitaeten</CardTitle>
            <CardDescription>Die letzten Aktionen im System</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 6).map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {activity.action.includes('COMPLETED') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : activity.action.includes('ERROR') ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-muted-foreground">
                        {activity.action.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Aktivitaeten</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellaktionen</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Link href="/dashboard/connections">
            <Button>
              <LinkIcon className="h-4 w-4 mr-2" />
              Verbindung hinzufuegen
            </Button>
          </Link>
          <Link href="/dashboard/rules">
            <Button variant="outline">
              <Tags className="h-4 w-4 mr-2" />
              Regel erstellen
            </Button>
          </Link>
          <Link href="/dashboard/review">
            <Button variant="outline">
              <AlertCircle className="h-4 w-4 mr-2" />
              E-Mails pruefen
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
