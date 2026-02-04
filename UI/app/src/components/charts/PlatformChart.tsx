import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PlatformMetrics, AIPlatform } from '@/types';

interface PlatformChartProps {
  data: PlatformMetrics[];
  title?: string;
  className?: string;
}

const platformColors: Record<AIPlatform, string> = {
  google_ai_overview: '#3b82f6',
  gemini: '#6366f1',
  chatgpt: '#10b981',
  perplexity: '#14b8a6',
  copilot: '#a855f7',
  claude: '#f97316',
  grok: '#f43f5e',
  deepseek: '#06b6d4'
};

const platformLabels: Record<AIPlatform, string> = {
  google_ai_overview: 'Google AI',
  gemini: 'Gemini',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  copilot: 'Copilot',
  claude: 'Claude',
  grok: 'Grok',
  deepseek: 'DeepSeek'
};

export function PlatformChart({ 
  data, 
  title = 'Platform Distribution',
  className 
}: PlatformChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      name: platformLabels[item.platform],
      platform: item.platform,
      citations: item.citations,
      percentage: item.percentage,
      change: item.change
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: typeof chartData[0] }>;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-popover text-popover-foreground text-sm p-3 rounded-lg shadow-lg border">
          <p className="font-medium mb-1">{item.name}</p>
          <div className="space-y-0.5 text-xs">
            <p>Citations: <span className="font-medium">{item.citations}</span></p>
            <p>Share: <span className="font-medium">{item.percentage}%</span></p>
            <p className={item.change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              Change: <span className="font-medium">{item.change >= 0 ? '+' : ''}{item.change}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            <TabsTrigger value="pie">Pie Chart</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bar">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="citations" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={platformColors[entry.platform]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="pie">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="citations"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={platformColors[entry.platform]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {chartData.map((item) => (
                <div key={item.platform} className="flex items-center gap-1 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: platformColors[item.platform] }} 
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
