import type { 
  Project, 
  Keyword, 
  Citation, 
  DashboardData, 
  Alert,
  AIPlatform,
  ScoreHistoryPoint,
  TopKeyword,
  PlatformMetrics
} from '@/types';

// Helper to generate dates
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const randomDate = (daysBack: number = 30): string => {
  const days = Math.floor(Math.random() * daysBack);
  return daysAgo(days);
};

// Mock Projects
export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'TechCorp Website',
    domain: 'techcorp.com',
    description: 'Main company website tracking',
    status: 'active',
    createdAt: daysAgo(90),
    updatedAt: daysAgo(1),
    keywordsCount: 45,
    citationsCount: 128,
    visibilityScore: 78,
    competitors: ['competitor1.com', 'competitor2.com']
  },
  {
    id: '2',
    name: 'Product Blog',
    domain: 'blog.techcorp.com',
    description: 'Product blog and content marketing',
    status: 'active',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(2),
    keywordsCount: 32,
    citationsCount: 89,
    visibilityScore: 65,
    competitors: ['blog.competitor1.com']
  },
  {
    id: '3',
    name: 'E-commerce Store',
    domain: 'store.techcorp.com',
    description: 'Online store tracking',
    status: 'paused',
    createdAt: daysAgo(45),
    updatedAt: daysAgo(10),
    keywordsCount: 28,
    citationsCount: 45,
    visibilityScore: 52,
    competitors: ['store.competitor1.com', 'store.competitor2.com']
  },
  {
    id: '4',
    name: 'Developer Docs',
    domain: 'docs.techcorp.com',
    description: 'Developer documentation',
    status: 'active',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
    keywordsCount: 56,
    citationsCount: 203,
    visibilityScore: 85,
    competitors: ['docs.competitor1.com']
  }
];

// Mock Keywords
export const generateMockKeywords = (projectId: string): Keyword[] => {
  const keywords = [
    'AI software solutions',
    'machine learning platform',
    'cloud computing services',
    'data analytics tools',
    'enterprise software',
    'SaaS platform',
    'business intelligence',
    'digital transformation',
    'API integration',
    'automation tools'
  ];
  
  return keywords.map((kw, index) => ({
    id: `${projectId}-kw-${index}`,
    projectId,
    keyword: kw,
    status: Math.random() > 0.2 ? 'active' : 'paused',
    createdAt: randomDate(60),
    lastTrackedAt: randomDate(7),
    citationCount: Math.floor(Math.random() * 20),
    avgPosition: Math.floor(Math.random() * 5) + 1
  }));
};

// Mock Platforms
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

// Mock Citations
export const generateMockCitations = (count: number = 20): Citation[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `cite-${i}`,
    keywordId: `kw-${Math.floor(Math.random() * 10)}`,
    projectId: '1',
    platform: platforms[Math.floor(Math.random() * platforms.length)],
    url: `https://techcorp.com/page-${i}`,
    position: Math.floor(Math.random() * 5) + 1,
    context: 'This is a sample citation context where the brand is mentioned in an AI response...',
    sentiment: Math.random() > 0.3 ? 'positive' : Math.random() > 0.5 ? 'neutral' : 'negative',
    trackedAt: randomDate(14)
  }));
};

// Mock Score History
export const generateScoreHistory = (days: number = 30): ScoreHistoryPoint[] => {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    
    const baseScore = 70 + Math.sin(i / 5) * 10;
    
    return {
      date: date.toISOString().split('T')[0],
      score: Math.round(baseScore + Math.random() * 10),
      frequency: Math.round(60 + Math.random() * 30),
      position: Math.round(70 + Math.random() * 20),
      diversity: Math.round(50 + Math.random() * 40),
      context: Math.round(65 + Math.random() * 25),
      momentum: Math.round(40 + Math.random() * 50)
    };
  });
};

// Mock Top Keywords
export const mockTopKeywords: TopKeyword[] = [
  { keyword: 'AI software solutions', citations: 24, avgPosition: 1.8, trend: 'up' },
  { keyword: 'machine learning platform', citations: 19, avgPosition: 2.3, trend: 'up' },
  { keyword: 'cloud computing services', citations: 17, avgPosition: 2.1, trend: 'stable' },
  { keyword: 'data analytics tools', citations: 15, avgPosition: 2.8, trend: 'down' },
  { keyword: 'enterprise software', citations: 14, avgPosition: 1.9, trend: 'up' }
];

// Mock Platform Breakdown
export const mockPlatformBreakdown: PlatformMetrics[] = [
  { platform: 'google_ai_overview', citations: 45, percentage: 35, change: 12 },
  { platform: 'gemini', citations: 32, percentage: 25, change: 8 },
  { platform: 'chatgpt', citations: 28, percentage: 22, change: -3 },
  { platform: 'perplexity', citations: 15, percentage: 12, change: 5 },
  { platform: 'copilot', citations: 8, percentage: 6, change: 2 }
];

// Mock Dashboard Data
export const getMockDashboardData = (projectId: string): DashboardData => {
  const project = mockProjects.find(p => p.id === projectId) || mockProjects[0];
  
  return {
    project,
    overview: {
      totalCitations: 128,
      totalKeywords: 45,
      visibilityScore: 78,
      scoreChange: 5.2,
      activePlatforms: 5,
      avgPosition: 2.3,
      positionChange: -0.4
    },
    platformBreakdown: mockPlatformBreakdown,
    recentCitations: generateMockCitations(10),
    scoreHistory: generateScoreHistory(30),
    topKeywords: mockTopKeywords
  };
};

// Mock Alerts
export const mockAlerts: Alert[] = [
  {
    id: '1',
    projectId: '1',
    type: 'new_citation',
    severity: 'success',
    title: 'New Citation Detected',
    message: 'Your domain was cited for "AI software solutions" on Google AI Overview',
    read: false,
    createdAt: daysAgo(0.5)
  },
  {
    id: '2',
    projectId: '1',
    type: 'position_change',
    severity: 'info',
    title: 'Position Improved',
    message: 'Your position improved from #3 to #1 for "machine learning platform"',
    read: false,
    createdAt: daysAgo(1)
  },
  {
    id: '3',
    projectId: '1',
    type: 'score_change',
    severity: 'success',
    title: 'Visibility Score Increased',
    message: 'Your visibility score increased by 5.2 points to 78',
    read: true,
    createdAt: daysAgo(2)
  },
  {
    id: '4',
    projectId: '1',
    type: 'competitor_alert',
    severity: 'warning',
    title: 'Competitor Alert',
    message: 'competitor1.com gained 3 new citations for your tracked keywords',
    read: false,
    createdAt: daysAgo(3)
  },
  {
    id: '5',
    projectId: '2',
    type: 'system',
    severity: 'info',
    title: 'Tracking Completed',
    message: 'Daily tracking completed successfully for Product Blog',
    read: true,
    createdAt: daysAgo(4)
  }
];

// API Mock Service
export const mockApiService = {
  getProjects: async (): Promise<Project[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockProjects;
  },
  
  getProject: async (id: string): Promise<Project | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockProjects.find(p => p.id === id);
  },
  
  createProject: async (data: Partial<Project>): Promise<Project> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      keywordsCount: 0,
      citationsCount: 0,
      visibilityScore: 0,
      status: 'active'
    } as Project;
  },
  
  getKeywords: async (projectId: string): Promise<Keyword[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return generateMockKeywords(projectId);
  },
  
  getCitations: async (_projectId: string): Promise<Citation[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return generateMockCitations(25);
  },
  
  getDashboard: async (projectId: string): Promise<DashboardData> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    return getMockDashboardData(projectId);
  },
  
  getAlerts: async (): Promise<Alert[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockAlerts;
  },
  
  markAlertRead: async (id: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const alert = mockAlerts.find(a => a.id === id);
    if (alert) alert.read = true;
  }
};
