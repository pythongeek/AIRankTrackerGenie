import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Calendar,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataCard } from '@/components/ui/data-card';
import { PlatformChart } from '@/components/charts/PlatformChart';
import { MetricsChart } from '@/components/charts/MetricsChart';
import { ScoreChart } from '@/components/charts/ScoreChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { mockApiService } from '@/services/mockData';
import type { DashboardData } from '@/types';

export function Analytics() {
  const { selectedProject } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    const loadData = async () => {
      if (!selectedProject) return;
      setLoading(true);
      try {
        const dashboardData = await mockApiService.getDashboard(selectedProject.id);
        setData(dashboardData);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedProject]);

  // Generate mock metrics data
  const metricsData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString(),
      citations: Math.floor(Math.random() * 20) + 100,
      keywords: Math.floor(Math.random() * 5) + 40,
      position: Math.random() * 2 + 1.5
    };
  });

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground mb-4">Select a project to view analytics</p>
        <Button onClick={() => window.location.href = '/projects'}>Go to Projects</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            {selectedProject.name} - Detailed performance analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <DataCard
          title="Visibility Score"
          value={loading ? '-' : data?.overview.visibilityScore || 0}
          change={5.2}
          changeLabel="vs previous period"
          trend="up"
          loading={loading}
        />
        <DataCard
          title="Total Citations"
          value={loading ? '-' : data?.overview.totalCitations || 0}
          change={12}
          changeLabel="vs previous period"
          trend="up"
          loading={loading}
        />
        <DataCard
          title="Avg Position"
          value={loading ? '-' : data?.overview.avgPosition?.toFixed(1) || '-'}
          change={-0.4}
          changeLabel="vs previous period"
          trend="up"
          loading={loading}
        />
        <DataCard
          title="Active Platforms"
          value={loading ? '-' : data?.overview.activePlatforms || 0}
          change={1}
          changeLabel="vs previous period"
          trend="up"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ScoreChart 
            data={loading ? [] : data?.scoreHistory || []}
            title="Visibility Score Over Time"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricsChart data={metricsData} title="Citation Trends" />
            <PlatformChart 
              data={loading ? [] : data?.platformBreakdown || []}
              title="Platform Distribution"
            />
          </div>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlatformChart 
              data={loading ? [] : data?.platformBreakdown || []}
              title="Citations by Platform"
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Platform Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))
                  ) : (
                    data?.platformBreakdown.map((platform) => (
                      <div 
                        key={platform.platform}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="secondary" 
                            className="w-8 h-8 flex items-center justify-center p-0"
                          >
                            {platform.percentage}%
                          </Badge>
                          <div>
                            <p className="font-medium capitalize">
                              {platform.platform.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {platform.citations} citations
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={platform.change >= 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {platform.change >= 0 ? '+' : ''}{platform.change}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Top Performing Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                  ))
                ) : (
                  data?.topKeywords.map((kw, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`
                          w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                          ${index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                            index === 1 ? 'bg-slate-400/20 text-slate-600' :
                            index === 2 ? 'bg-orange-600/20 text-orange-600' :
                            'bg-muted text-muted-foreground'}
                        `}>
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
                        <Badge 
                          variant={kw.trend === 'up' ? 'default' : kw.trend === 'down' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {kw.trend === 'up' ? '↑' : kw.trend === 'down' ? '↓' : '→'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <MetricsChart data={metricsData} title="Performance Metrics" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DataCard
              title="Weekly Growth"
              value="+8.5%"
              change={2.3}
              changeLabel="vs last week"
              trend="up"
            />
            <DataCard
              title="Monthly Growth"
              value="+24.2%"
              change={5.1}
              changeLabel="vs last month"
              trend="up"
            />
            <DataCard
              title="Projected Score"
              value="82"
              change={4}
              changeLabel="by next month"
              trend="up"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
