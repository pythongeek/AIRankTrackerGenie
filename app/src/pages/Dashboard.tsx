import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboard, projects } from '../services/api';
import { DashboardData, AIPlatform } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Quote,
  Target,
  Users,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Loader2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { toast } from 'sonner';

const platformColors: Record<AIPlatform, string> = {
  [AIPlatform.GOOGLE_AI_OVERVIEW]: '#4285F4',
  [AIPlatform.GEMINI]: '#8B5CF6',
  [AIPlatform.CHATGPT]: '#10A37F',
  [AIPlatform.PERPLEXITY]: '#22C55E',
  [AIPlatform.COPILOT]: '#0078D4',
  [AIPlatform.CLAUDE]: '#D97706',
  [AIPlatform.GROK]: '#EF4444',
  [AIPlatform.DEEPSEEK]: '#6366F1',
};

const gradeColors: Record<string, string> = {
  'A+': 'text-green-500',
  'A': 'text-green-500',
  'B': 'text-blue-500',
  'C': 'text-yellow-500',
  'D': 'text-orange-500',
  'F': 'text-red-500',
};

export default function Dashboard() {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const { data: dashboardData, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', selectedProject],
    queryFn: () => dashboard.get(selectedProject),
    enabled: !!selectedProject,
  });

  useEffect(() => {
    if (projectsData?.projects?.length && !selectedProject) {
      setSelectedProject(projectsData.projects[0].id);
    }
  }, [projectsData, selectedProject]);

  const handleRefresh = async () => {
    if (!selectedProject) return;
    setIsRefreshing(true);
    try {
      await dashboard.refresh(selectedProject);
      await refetch();
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to refresh dashboard');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const visibilityScore = dashboardData?.visibilityScore;
  const platformBreakdown = dashboardData?.platformBreakdown || {};
  const recentCitations = dashboardData?.recentCitations || [];
  const recentAlerts = dashboardData?.recentAlerts || [];
  const trendingKeywords = dashboardData?.trendingKeywords || [];
  const competitorComparison = dashboardData?.competitorComparison || [];

  // Prepare chart data
  const platformChartData = Object.entries(platformBreakdown).map(([platform, stats]) => ({
    platform: platform.replace(/_/g, ' '),
    citations: stats.total_citations,
    keywords: stats.keywords_ranked,
  }));

  const competitorChartData = competitorComparison.map(comp => ({
    name: comp.domain,
    citations: comp.total_citations,
    isYou: comp.is_you,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your AI visibility and citations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projectsData?.projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {visibilityScore && (
        <>
          {/* Visibility Score Card */}
          <Card>
            <CardHeader>
              <CardTitle>Visibility Score</CardTitle>
              <CardDescription>
                Overall AI visibility performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${gradeColors[visibilityScore.overall_grade] || 'text-muted-foreground'}`}>
                    {visibilityScore.overall_grade}
                  </div>
                  <div className="text-2xl font-semibold mt-2">
                    {visibilityScore.overall_score}/100
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Frequency</div>
                    <div className="text-lg font-semibold">{visibilityScore.frequency_score}</div>
                    <Progress value={visibilityScore.frequency_score} className="mt-1" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Position</div>
                    <div className="text-lg font-semibold">{visibilityScore.position_score}</div>
                    <Progress value={visibilityScore.position_score} className="mt-1" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Diversity</div>
                    <div className="text-lg font-semibold">{visibilityScore.diversity_score}</div>
                    <Progress value={visibilityScore.diversity_score} className="mt-1" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Context</div>
                    <div className="text-lg font-semibold">{visibilityScore.context_score}</div>
                    <Progress value={visibilityScore.context_score} className="mt-1" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Momentum</div>
                    <div className="text-lg font-semibold">{visibilityScore.momentum_score}</div>
                    <Progress value={visibilityScore.momentum_score} className="mt-1" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Citations</CardTitle>
                <Quote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(platformBreakdown).reduce((sum, p) => sum + p.total_citations, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 30 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Keywords Ranked</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(platformBreakdown).reduce((sum, p) => sum + p.keywords_ranked, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all platforms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Competitors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {competitorComparison.filter(c => !c.is_you).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Being tracked
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unread Alerts</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentAlerts.filter(a => !a.is_read).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  <Link to="/alerts" className="text-primary hover:underline">
                    View all alerts
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <Tabs defaultValue="platforms" className="space-y-4">
            <TabsList>
              <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
              <TabsTrigger value="competitors">Competitors</TabsTrigger>
              <TabsTrigger value="trending">Trending Keywords</TabsTrigger>
            </TabsList>

            <TabsContent value="platforms">
              <Card>
                <CardHeader>
                  <CardTitle>Citations by Platform</CardTitle>
                  <CardDescription>
                    Distribution of citations across AI platforms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="platform" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="citations" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="competitors">
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Comparison</CardTitle>
                  <CardDescription>
                    Citations comparison with competitors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={competitorChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip />
                        <Bar dataKey="citations" fill="#8884d8">
                          {competitorChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.isYou ? '#22C55E' : '#8884d8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trending">
              <Card>
                <CardHeader>
                  <CardTitle>Trending Keywords</CardTitle>
                  <CardDescription>
                    Keywords with significant changes in citations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trendingKeywords.map((keyword) => (
                      <div
                        key={keyword.keyword_id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{keyword.keyword_text}</div>
                          <div className="text-sm text-muted-foreground">
                            Citation change: {keyword.citation_change > 0 ? '+' : ''}
                            {keyword.citation_change}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {keyword.trend_direction === 'up' && (
                            <Badge variant="default" className="bg-green-500">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Up
                            </Badge>
                          )}
                          {keyword.trend_direction === 'down' && (
                            <Badge variant="destructive">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Down
                            </Badge>
                          )}
                          {keyword.trend_direction === 'stable' && (
                            <Badge variant="secondary">
                              <Minus className="h-3 w-3 mr-1" />
                              Stable
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {trendingKeywords.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No trending keywords yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Recent Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Citations</CardTitle>
                <CardDescription>
                  Latest citations across all platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentCitations.slice(0, 5).map((citation) => (
                    <div
                      key={citation.id}
                      className="flex items-start justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{citation.keyword_text}</div>
                        <div className="text-sm text-muted-foreground">
                          {citation.platform.replace(/_/g, ' ')}
                        </div>
                        {citation.citation_position && (
                          <Badge variant="outline" className="mt-1">
                            Position {citation.citation_position}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(citation.tracked_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {recentCitations.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No citations yet. Start tracking to see results.
                    </div>
                  )}
                </div>
                {recentCitations.length > 0 && (
                  <Button variant="ghost" className="w-full mt-4" asChild>
                    <Link to="/citations">
                      View all citations
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>
                  Latest notifications and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAlerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start justify-between p-3 rounded-lg ${
                        alert.is_read ? 'bg-muted' : 'bg-primary/5'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{alert.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {alert.description}
                        </div>
                      </div>
                      <Badge
                        variant={
                          alert.severity === 'critical'
                            ? 'destructive'
                            : alert.severity === 'warning'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                  {recentAlerts.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No alerts yet
                    </div>
                  )}
                </div>
                {recentAlerts.length > 0 && (
                  <Button variant="ghost" className="w-full mt-4" asChild>
                    <Link to="/alerts">
                      View all alerts
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!visibilityScore && selectedProject && (
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your keywords to see visibility scores and analytics.
            </p>
            <Button asChild>
              <Link to="/tracking">Start Tracking</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
