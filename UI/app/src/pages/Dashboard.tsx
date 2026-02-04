import { useEffect, useState } from 'react';
import { 
  Quote, 
  KeyRound, 
  TrendingUp, 
  Target,
  Activity,
  Calendar
} from 'lucide-react';
import { DataCard, ScoreCard } from '@/components/ui/data-card';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { StatusBadge, SentimentBadge, TrendIndicator } from '@/components/ui/status-badge';
import { ScoreChart } from '@/components/charts/ScoreChart';
import { PlatformChart } from '@/components/charts/PlatformChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/contexts/AppContext';
import { mockApiService } from '@/services/mockData';
import type { DashboardData } from '@/types';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { selectedProject } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!selectedProject) return;
      setLoading(true);
      try {
        const dashboardData = await mockApiService.getDashboard(selectedProject.id);
        setData(dashboardData);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [selectedProject]);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground mb-4">Select a project to view your dashboard</p>
        <Button>Go to Projects</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <span>{selectedProject.name}</span>
            <StatusBadge status={selectedProject.status} size="sm" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Last 30 Days
          </Button>
          <Button size="sm">
            <Activity className="h-4 w-4 mr-2" />
            Track Now
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataCard
          title="Total Citations"
          value={loading ? '-' : data?.overview.totalCitations || 0}
          change={12}
          changeLabel="vs last month"
          icon={Quote}
          trend="up"
          loading={loading}
        />
        <DataCard
          title="Tracked Keywords"
          value={loading ? '-' : data?.overview.totalKeywords || 0}
          change={5}
          changeLabel="vs last month"
          icon={KeyRound}
          trend="up"
          loading={loading}
        />
        <DataCard
          title="Active Platforms"
          value={loading ? '-' : data?.overview.activePlatforms || 0}
          subtitle="Out of 8 platforms"
          icon={Target}
          loading={loading}
        />
        <DataCard
          title="Avg Position"
          value={loading ? '-' : data?.overview.avgPosition?.toFixed(1) || '-'}
          change={-0.4}
          changeLabel="vs last month"
          icon={TrendingUp}
          trend="up"
          loading={loading}
        />
      </div>

      {/* Score & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ScoreCard 
          score={loading ? 0 : data?.overview.visibilityScore || 0}
          subtitle="Based on frequency, position, diversity, context & momentum"
          className="lg:col-span-1"
        />
        <ScoreChart 
          data={loading ? [] : data?.scoreHistory || []}
          className="lg:col-span-2"
        />
      </div>

      {/* Platform & Top Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlatformChart 
          data={loading ? [] : data?.platformBreakdown || []}
        />
        
        {/* Top Keywords */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Top Keywords</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : (
                data?.topKeywords.map((kw, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                        index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                        index === 1 ? 'bg-slate-400/20 text-slate-600' :
                        index === 2 ? 'bg-orange-600/20 text-orange-600' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {index + 1}
                      </span>
                      <span className="font-medium">{kw.keyword}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{kw.citations}</p>
                        <p className="text-xs text-muted-foreground">citations</p>
                      </div>
                      <div className="text-right w-16">
                        <p className="text-sm font-medium">#{kw.avgPosition}</p>
                        <p className="text-xs text-muted-foreground">avg pos</p>
                      </div>
                      <TrendIndicator trend={kw.trend} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Citations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Recent Citations</CardTitle>
          <Button variant="ghost" size="sm">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left">Platform</th>
                  <th className="pb-3 text-left">Context</th>
                  <th className="pb-3 text-left">Position</th>
                  <th className="pb-3 text-left">Sentiment</th>
                  <th className="pb-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="py-3">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  data?.recentCitations.slice(0, 5).map((citation) => (
                    <tr key={citation.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3">
                        <PlatformBadge platform={citation.platform} size="sm" />
                      </td>
                      <td className="py-3">
                        <p className="max-w-md truncate text-sm">{citation.context}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary">#{citation.position}</Badge>
                      </td>
                      <td className="py-3">
                        <SentimentBadge sentiment={citation.sentiment} />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(citation.trackedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
