import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface DataCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  className?: string;
  loading?: boolean;
  children?: React.ReactNode;
}

export function DataCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  trend,
  className,
  loading,
  children
}: DataCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-600 bg-emerald-50';
    if (trend === 'down') return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="pb-2">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden card-hover', className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold">{value}</span>
          {(change !== undefined || trend) && (
            <Badge 
              variant="secondary" 
              className={cn('text-xs font-medium', getTrendColor())}
            >
              {getTrendIcon()}
              <span className="ml-1">
                {change !== undefined && change > 0 ? '+' : ''}
                {change !== undefined ? change : ''}
              </span>
            </Badge>
          )}
        </div>
        {(subtitle || changeLabel) && (
          <p className="text-xs text-muted-foreground mt-1">
            {changeLabel || subtitle}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

// Score Card with Grade
interface ScoreCardProps {
  score: number;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ScoreCard({ 
  score, 
  title = 'Visibility Score', 
  subtitle,
  className 
}: ScoreCardProps) {
  const getGrade = (s: number): string => {
    if (s >= 90) return 'A+';
    if (s >= 80) return 'A';
    if (s >= 70) return 'B';
    if (s >= 60) return 'C';
    if (s >= 50) return 'D';
    return 'F';
  };

  const getScoreColor = (s: number): string => {
    if (s >= 80) return 'text-emerald-600';
    if (s >= 60) return 'text-blue-600';
    if (s >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getProgressColor = (s: number): string => {
    if (s >= 80) return 'bg-emerald-500';
    if (s >= 60) return 'bg-blue-500';
    if (s >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={cn(
            'text-3xl font-bold',
            getScoreColor(score)
          )}>
            {getGrade(score)}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={cn('text-4xl font-bold', getScoreColor(score))}>
              {score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn('h-full rounded-full transition-all duration-500', getProgressColor(score))}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
