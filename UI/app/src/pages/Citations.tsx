import { useEffect, useState } from 'react';
import { 
  Search, 
  Filter,
  Download,
  ExternalLink,
  Quote,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/ui/platform-badge';
import { SentimentBadge } from '@/components/ui/status-badge';
import { DataCard } from '@/components/ui/data-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useApp } from '@/contexts/AppContext';
import { mockApiService } from '@/services/mockData';
import type { Citation, AIPlatform } from '@/types';

const platforms: AIPlatform[] = [
  'google_ai_overview',
  'gemini',
  'chatgpt',
  'perplexity',
  'copilot',
  'claude',
  'grok',
  'deepseek'
];

export function Citations() {
  const { selectedProject } = useApp();
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadCitations = async () => {
      if (!selectedProject) return;
      setLoading(true);
      try {
        const data = await mockApiService.getCitations(selectedProject.id);
        setCitations(data);
      } finally {
        setLoading(false);
      }
    };
    loadCitations();
  }, [selectedProject]);

  const filteredCitations = citations.filter(c => {
    const matchesSearch = 
      c.context.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || c.platform === platformFilter;
    const matchesSentiment = sentimentFilter === 'all' || c.sentiment === sentimentFilter;
    return matchesSearch && matchesPlatform && matchesSentiment;
  });

  const totalPages = Math.ceil(filteredCitations.length / itemsPerPage);
  const paginatedCitations = filteredCitations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: citations.length,
    byPlatform: platforms.reduce((acc, platform) => {
      acc[platform] = citations.filter(c => c.platform === platform).length;
      return acc;
    }, {} as Record<AIPlatform, number>),
    positive: citations.filter(c => c.sentiment === 'positive').length,
    negative: citations.filter(c => c.sentiment === 'negative').length,
    neutral: citations.filter(c => c.sentiment === 'neutral').length
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Quote className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground mb-4">Select a project to view citations</p>
        <Button onClick={() => window.location.href = '/projects'}>Go to Projects</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Citations</h1>
          <p className="text-muted-foreground mt-1">
            {selectedProject.name} - Track your brand mentions
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <DataCard
          title="Total Citations"
          value={stats.total}
          loading={loading}
        />
        <DataCard
          title="Positive"
          value={stats.positive}
          change={Math.round((stats.positive / stats.total) * 100)}
          changeLabel="% of total"
          loading={loading}
        />
        <DataCard
          title="Neutral"
          value={stats.neutral}
          change={Math.round((stats.neutral / stats.total) * 100)}
          changeLabel="% of total"
          loading={loading}
        />
        <DataCard
          title="Negative"
          value={stats.negative}
          change={Math.round((stats.negative / stats.total) * 100)}
          changeLabel="% of total"
          loading={loading}
        />
      </div>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Citations by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {platforms.map(platform => {
              const count = stats.byPlatform[platform] || 0;
              if (count === 0) return null;
              return (
                <div key={platform} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <PlatformBadge platform={platform} size="sm" />
                  <span className="text-sm font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search citations..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map(p => (
              <SelectItem key={p} value={p}>
                {p.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiment</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Citations List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 w-24 bg-muted rounded mb-2" />
                  <div className="h-16 bg-muted rounded" />
                </div>
              ))
            ) : paginatedCitations.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <Quote className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No citations found</p>
              </div>
            ) : (
              paginatedCitations.map((citation) => (
                <div 
                  key={citation.id} 
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <PlatformBadge platform={citation.platform} size="sm" />
                        <Badge variant="secondary">#{citation.position}</Badge>
                        <SentimentBadge sentiment={citation.sentiment} />
                      </div>
                      <p className="text-sm text-foreground mb-2 line-clamp-2">
                        "{citation.context}"
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(citation.trackedAt).toLocaleDateString()}
                        </span>
                        <a 
                          href={citation.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Source
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {!loading && filteredCitations.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredCitations.length)} of{' '}
                {filteredCitations.length} citations
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
