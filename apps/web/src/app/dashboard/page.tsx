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
  Play,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';
import { useSettings } from '@/contexts/SettingsContext';
import { useUserEmail, buildApiUrl } from '@/hooks/useUserEmail';

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
  const [processing, setProcessing] = useState(false);
  const userEmail = useUserEmail();
  const { t } = useSettings();
  const { toast } = useToast();

  const fetchStats = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(buildApiUrl('/api/stats', userEmail));
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
    if (userEmail) {
      fetchStats();
    }
  }, [userEmail]);

  const handleProcessAll = async () => {
    if (!userEmail || !stats?.connections.active) {
      toast({
        title: t('dashboard.noActiveConnections'),
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      // Fetch connections first
      const connectionsRes = await fetch(buildApiUrl('/api/connections', userEmail));
      if (!connectionsRes.ok) throw new Error('Failed to fetch connections');

      const { connections } = await connectionsRes.json();
      const activeConnections = connections.filter((c: any) => c.status === 'ACTIVE');

      let totalProcessed = 0;
      let totalLabeled = 0;

      // Process each active connection
      for (const conn of activeConnections) {
        const res = await fetch(buildApiUrl(`/api/connections/${conn.id}/process`, userEmail), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxEmails: 50 }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            totalProcessed += data.result.messagesProcessed;
            totalLabeled += data.result.messagesLabeled;
          }
        }
      }

      toast({
        title: t('connections.processingComplete'),
        description: `${totalProcessed} ${t('connections.emailsProcessed')}, ${totalLabeled} ${t('connections.labeled')}`,
      });
      fetchStats();
    } catch (error) {
      toast({
        title: t('connections.processingFailed'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.connections')}</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.connections.total || 0}</div>
            <div className="flex gap-2 mt-1">
              {(stats?.connections.active ?? 0) > 0 && (
                <Badge variant="success">{stats?.connections.active} {t('active')}</Badge>
              )}
              {(stats?.connections.error ?? 0) > 0 && (
                <Badge variant="destructive">{stats?.connections.error} {t('error')}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.todayProcessed')}</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processed.today || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.processed.total || 0} {t('dashboard.total')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.categories')}</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.categories || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.rules || 0} {t('dashboard.activeRules')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.needsReview')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.needsReview || 0}</div>
            <Link href="/dashboard/review">
              <Button variant="link" className="p-0 h-auto text-xs">
                {t('dashboard.reviewNow')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.categoryDistribution')}</CardTitle>
            <CardDescription>{t('dashboard.emailDistribution')}</CardDescription>
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
                {t('dashboard.noEmailsClassified')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
            <CardDescription>{t('dashboard.recentActivityDesc')}</CardDescription>
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
              <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={handleProcessAll}
            disabled={processing || !stats?.connections.active}
          >
            {processing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {processing ? t('dashboard.processingRunning') : t('dashboard.runProcessing')}
          </Button>
          <Link href="/dashboard/connections">
            <Button variant="outline">
              <LinkIcon className="h-4 w-4 mr-2" />
              {t('dashboard.addConnection')}
            </Button>
          </Link>
          <Link href="/dashboard/rules">
            <Button variant="outline">
              <Tags className="h-4 w-4 mr-2" />
              {t('dashboard.createRule')}
            </Button>
          </Link>
          <Link href="/dashboard/review">
            <Button variant="outline">
              <AlertCircle className="h-4 w-4 mr-2" />
              {t('dashboard.reviewEmails')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
