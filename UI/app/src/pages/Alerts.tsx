import { useEffect, useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Trash2, 
  Filter,
  Check,
  Info,
  TrendingUp,
  TrendingDown,
  Users
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataCard } from '@/components/ui/data-card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';
import type { AlertType } from '@/types';
import { cn } from '@/lib/utils';

const alertIcons: Record<AlertType, React.ElementType> = {
  new_citation: CheckCircle2,
  lost_citation: TrendingDown,
  position_change: TrendingUp,
  score_change: TrendingUp,
  competitor_alert: Users,
  system: Info
};

const alertColors: Record<AlertType, string> = {
  new_citation: 'text-emerald-600 bg-emerald-50',
  lost_citation: 'text-red-600 bg-red-50',
  position_change: 'text-blue-600 bg-blue-50',
  score_change: 'text-purple-600 bg-purple-50',
  competitor_alert: 'text-amber-600 bg-amber-50',
  system: 'text-slate-600 bg-slate-50'
};

export function Alerts() {
  const { alerts, unreadAlertsCount, refreshAlerts, markAlertAsRead, isLoadingAlerts } = useApp();
  const [filter, setFilter] = useState<string>('all');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !alert.read;
    return alert.type === filter;
  });

  const stats = {
    total: alerts.length,
    unread: unreadAlertsCount,
    newCitations: alerts.filter(a => a.type === 'new_citation').length,
    competitorAlerts: alerts.filter(a => a.type === 'competitor_alert').length
  };

  const toggleSelect = (id: string) => {
    setSelectedAlerts(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleMarkAsRead = async (id: string) => {
    await markAlertAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    for (const alert of alerts.filter(a => !a.read)) {
      await markAlertAsRead(alert.id);
    }
  };

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground mt-1">
            Stay informed about your AI visibility
          </p>
        </div>
        {unreadAlertsCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            <Check className="h-4 w-4 mr-2" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <DataCard
          title="Total Alerts"
          value={stats.total}
          loading={isLoadingAlerts}
        />
        <DataCard
          title="Unread"
          value={stats.unread}
          loading={isLoadingAlerts}
        />
        <DataCard
          title="New Citations"
          value={stats.newCitations}
          loading={isLoadingAlerts}
        />
        <DataCard
          title="Competitor Alerts"
          value={stats.competitorAlerts}
          loading={isLoadingAlerts}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter alerts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Alerts</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="new_citation">New Citations</SelectItem>
            <SelectItem value="position_change">Position Changes</SelectItem>
            <SelectItem value="score_change">Score Changes</SelectItem>
            <SelectItem value="competitor_alert">Competitor Alerts</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        {selectedAlerts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedAlerts.length} selected
            </span>
            <Button variant="outline" size="sm">
              <Check className="h-4 w-4 mr-2" />
              Mark Read
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Alerts List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {isLoadingAlerts ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-12 bg-muted rounded" />
                </div>
              ))
            ) : filteredAlerts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No alerts found</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const Icon = alertIcons[alert.type];
                return (
                  <div 
                    key={alert.id} 
                    className={cn(
                      'p-4 hover:bg-muted/50 transition-colors',
                      !alert.read && 'bg-primary/5'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox 
                        checked={selectedAlerts.includes(alert.id)}
                        onCheckedChange={() => toggleSelect(alert.id)}
                        className="mt-1"
                      />
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                        alertColors[alert.type]
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={cn(
                              'font-medium',
                              !alert.read && 'text-primary'
                            )}>
                              {alert.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {alert.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={alert.severity === 'error' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {alert.severity}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Filter className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!alert.read && (
                                  <DropdownMenuItem onClick={() => handleMarkAsRead(alert.id)}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Mark as Read
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
