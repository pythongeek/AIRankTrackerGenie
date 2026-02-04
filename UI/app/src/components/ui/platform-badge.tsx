import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIPlatform } from '@/types';

interface PlatformBadgeProps {
  platform: AIPlatform;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const platformConfig: Record<AIPlatform, { label: string; color: string; icon: string }> = {
  google_ai_overview: { 
    label: 'Google AI', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    icon: 'G'
  },
  gemini: { 
    label: 'Gemini', 
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
    icon: '✦'
  },
  chatgpt: { 
    label: 'ChatGPT', 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    icon: 'C'
  },
  perplexity: { 
    label: 'Perplexity', 
    color: 'bg-teal-500/10 text-teal-600 border-teal-200',
    icon: 'P'
  },
  copilot: { 
    label: 'Copilot', 
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    icon: 'M'
  },
  claude: { 
    label: 'Claude', 
    color: 'bg-orange-500/10 text-orange-600 border-orange-200',
    icon: '◈'
  },
  grok: { 
    label: 'Grok', 
    color: 'bg-rose-500/10 text-rose-600 border-rose-200',
    icon: 'X'
  },
  deepseek: { 
    label: 'DeepSeek', 
    color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
    icon: 'D'
  }
};

export function PlatformBadge({ 
  platform, 
  showIcon = true, 
  className,
  size = 'md'
}: PlatformBadgeProps) {
  const config = platformConfig[platform];
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1'
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'font-medium border',
        config.color,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <span className="mr-1 font-bold">{config.icon}</span>
      )}
      {config.label}
    </Badge>
  );
}

// Platform Icon only
export function PlatformIcon({ 
  platform, 
  className 
}: { 
  platform: AIPlatform; 
  className?: string 
}) {
  const config = platformConfig[platform];
  
  return (
    <div 
      className={cn(
        'flex items-center justify-center rounded-md font-bold text-white',
        config.color.replace('/10', '').replace('text-', 'bg-').replace('border-', ''),
        className
      )}
      title={config.label}
    >
      {config.icon}
    </div>
  );
}

// Get platform color class
export function getPlatformColor(platform: AIPlatform): string {
  return platformConfig[platform]?.color || 'bg-gray-500/10 text-gray-600';
}

// Get platform label
export function getPlatformLabel(platform: AIPlatform): string {
  return platformConfig[platform]?.label || platform;
}
