import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Play,
  Pause,
  Trash2,
  BarChart3,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataCard } from '@/components/ui/data-card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/AppContext';
import { mockApiService } from '@/services/mockData';
import type { Keyword } from '@/types';
import { cn } from '@/lib/utils';

export function Keywords() {
  const { selectedProject } = useApp();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newKeywords, setNewKeywords] = useState('');

  useEffect(() => {
    const loadKeywords = async () => {
      if (!selectedProject) return;
      setLoading(true);
      try {
        const data = await mockApiService.getKeywords(selectedProject.id);
        setKeywords(data);
      } finally {
        setLoading(false);
      }
    };
    loadKeywords();
  }, [selectedProject]);

  const filteredKeywords = keywords.filter(kw => {
    const matchesSearch = kw.keyword.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || kw.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: keywords.length,
    active: keywords.filter(k => k.status === 'active').length,
    paused: keywords.filter(k => k.status === 'paused').length,
    totalCitations: keywords.reduce((acc, k) => acc + k.citationCount, 0)
  };

  const toggleSelectAll = () => {
    if (selectedKeywords.length === filteredKeywords.length) {
      setSelectedKeywords([]);
    } else {
      setSelectedKeywords(filteredKeywords.map(k => k.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedKeywords(prev => 
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  };

  const handleAddKeywords = async () => {
    // Mock implementation
    setIsAddDialogOpen(false);
    setNewKeywords('');
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
        <p className="text-muted-foreground mb-4">Select a project to view keywords</p>
        <Button onClick={() => window.location.href = '/projects'}>Go to Projects</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Keywords</h1>
          <p className="text-muted-foreground mt-1">
            {selectedProject.name} - Manage tracked keywords
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Keywords
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Keywords</DialogTitle>
                <DialogDescription>
                  Enter keywords to track, one per line.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords</Label>
                  <Textarea
                    id="keywords"
                    placeholder="AI software solutions&#10;machine learning platform&#10;cloud computing services"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one keyword per line. You can add up to 100 keywords at once.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddKeywords} disabled={!newKeywords.trim()}>
                  Add Keywords
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <DataCard
          title="Total Keywords"
          value={stats.total}
          loading={loading}
        />
        <DataCard
          title="Active"
          value={stats.active}
          loading={loading}
        />
        <DataCard
          title="Paused"
          value={stats.paused}
          loading={loading}
        />
        <DataCard
          title="Total Citations"
          value={stats.totalCitations}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search keywords..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        {selectedKeywords.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedKeywords.length} selected
            </span>
            <Button variant="outline" size="sm">
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
            <Button variant="outline" size="sm">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Keywords Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-left w-10">
                    <Checkbox 
                      checked={selectedKeywords.length === filteredKeywords.length && filteredKeywords.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-3 px-4 text-left">Keyword</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Citations</th>
                  <th className="py-3 px-4 text-left">Avg Position</th>
                  <th className="py-3 px-4 text-left">Last Tracked</th>
                  <th className="py-3 px-4 text-left w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="py-3 px-4">
                        <div className="h-10 bg-muted rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredKeywords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">No keywords found</p>
                    </td>
                  </tr>
                ) : (
                  filteredKeywords.map((keyword) => (
                    <tr 
                      key={keyword.id} 
                      className={cn(
                        'hover:bg-muted/50 transition-colors',
                        selectedKeywords.includes(keyword.id) && 'bg-primary/5'
                      )}
                    >
                      <td className="py-3 px-4">
                        <Checkbox 
                          checked={selectedKeywords.includes(keyword.id)}
                          onCheckedChange={() => toggleSelect(keyword.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{keyword.keyword}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={keyword.status} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{keyword.citationCount}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {keyword.avgPosition ? (
                          <span className="text-sm">#{keyword.avgPosition}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {keyword.lastTrackedAt 
                          ? new Date(keyword.lastTrackedAt).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Play className="h-4 w-4 mr-2" />
                              Track Now
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              {keyword.status === 'active' ? (
                                <><Pause className="h-4 w-4 mr-2" /> Pause</>
                              ) : (
                                <><Play className="h-4 w-4 mr-2" /> Resume</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
