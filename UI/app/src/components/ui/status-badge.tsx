import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, PauseCircle, AlertCircle, Clock } from 'lucide-react';

type StatusType = 'active' | 'paused' | 'archived' | 'pending' | 'error' | 'success';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<StatusType, { 
  label: string; 
  color: string; 
  icon: React.ElementType 
}> = {
  active: { 
    label: 'Active', 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20',
    icon: CheckCircle2
  },
  paused: { 
    label: 'Paused', 
    color: 'bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20',
    icon: PauseCircle
  },
  archived: { 
    label: 'Archived', 
    color: 'bg-slate-500/10 text-slate-600 border-slate-200 hover:bg-slate-500/20',
    icon: XCircle
  },
  pending: { 
    label: 'Pending', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20',
    icon: Clock
  },
  error: { 
    label: 'Error', 
    color: 'bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20',
    icon: AlertCircle
  },
  success: { 
    label: 'Success', 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20',
    icon: CheckCircle2
  }
};

export function StatusBadge({ 
  status, 
  className, 
  showIcon = true,
  size = 'sm'
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'font-medium border transition-colors',
        config.color,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
    >
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {config.label}
    </Badge>
  );
}

// Sentiment Badge
interface SentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
  className?: string;
}

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const config = {
    positive: { 
      label: 'Positive', 
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' 
    },
    neutral: { 
      label: 'Neutral', 
      color: 'bg-slate-500/10 text-slate-600 border-slate-200' 
    },
    negative: { 
      label: 'Negative', 
      color: 'bg-red-500/10 text-red-600 border-red-200' 
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-[10px] px-2 py-0.5 font-medium border',
        config[sentiment].color,
        className
      )}
    >
      {config[sentiment].label}
    </Badge>
  );
}

// Trend Indicator
interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'stable';
  value?: number;
  className?: string;
}

export function TrendIndicator({ trend, value, className }: TrendIndicatorProps) {
  const config = {
    up: { color: 'text-emerald-600', arrow: '↑' },
    down: { color: 'text-red-600', arrow: '↓' },
    stable: { color: 'text-slate-500', arrow: '→' }
  };

  return (
    <span className={cn('text-xs font-medium flex items-center gap-1', config[trend].color, className)}>
      <span>{config[trend].arrow}</span>
      {value !== undefined && <span>{Math.abs(value)}%</span>}
    </span>
  );
}
