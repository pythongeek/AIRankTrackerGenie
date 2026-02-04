export enum AIPlatform {
  GOOGLE_AI_OVERVIEW = 'google_ai_overview',
  GEMINI = 'gemini',
  CHATGPT = 'chatgpt',
  PERPLEXITY = 'perplexity',
  COPILOT = 'copilot',
  CLAUDE = 'claude',
  GROK = 'grok',
  DEEPSEEK = 'deepseek'
}

export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative'
}

export enum AlertType {
  NEW_CITATION = 'new_citation',
  LOST_CITATION = 'lost_citation',
  POSITION_CHANGE = 'position_change',
  COMPETITOR_GAIN = 'competitor_gain',
  NEW_PLATFORM = 'new_platform',
  SENTIMENT_SHIFT = 'sentiment_shift',
  VOLUME_SPIKE = 'volume_spike'
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: {
    max_keywords: number;
    max_competitors: number;
    tracking_interval_hours: number;
    alert_email_enabled: boolean;
  };
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  primary_domain: string;
  competitor_domains: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  keyword_count?: number;
  total_citations?: number;
}

export interface Keyword {
  id: string;
  project_id: string;
  keyword_text: string;
  category?: string;
  priority_level: 1 | 2 | 3 | 4 | 5;
  search_volume?: number;
  difficulty?: number;
  funnel_stage: 'awareness' | 'consideration' | 'decision';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_tracked_at?: string;
  recent_citations?: number;
}

export interface Citation {
  id: string;
  keyword_id: string;
  project_id: string;
  platform: AIPlatform;
  tracked_at: string;
  domain_mentioned: boolean;
  specific_url?: string;
  citation_position?: number;
  citation_context?: string;
  full_response_text?: string;
  response_summary?: string;
  sentiment: Sentiment;
  confidence_score?: number;
  word_count?: number;
  competitor_citations: CompetitorCitation[];
  total_sources_cited: number;
  keyword_text?: string;
}

export interface CompetitorCitation {
  domain: string;
  url?: string;
  position: number;
  context?: string;
}

export interface VisibilityScore {
  id: string;
  project_id: string;
  calculated_at: string;
  overall_score: number;
  overall_grade: string;
  frequency_score: number;
  position_score: number;
  diversity_score: number;
  context_score: number;
  momentum_score: number;
  week_over_week_change: number;
  month_over_month_change: number;
  platform_scores: Record<AIPlatform, PlatformScore>;
}

export interface PlatformScore {
  score: number;
  citations_count: number;
  keywords_ranked: number;
  avg_position: number;
  share_of_voice: number;
}

export interface Alert {
  id: string;
  project_id: string;
  organization_id: string;
  alert_type: AlertType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  keyword_id?: string;
  keyword_text?: string;
  platform?: AIPlatform;
  competitor_domain?: string;
  previous_value?: string;
  current_value?: string;
  change_percent?: number;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface DashboardData {
  project: Project;
  visibilityScore: VisibilityScore | null;
  recentCitations: Citation[];
  recentAlerts: Alert[];
  platformBreakdown: Record<AIPlatform, PlatformStats>;
  trendingKeywords: TrendingKeyword[];
  competitorComparison: CompetitorComparison[];
}

export interface PlatformStats {
  total_citations: number;
  keywords_ranked: number;
  avg_position: number;
  share_of_voice: number;
  week_change: number;
}

export interface TrendingKeyword {
  keyword_id: string;
  keyword_text: string;
  citation_change: number;
  position_change: number;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface CompetitorComparison {
  domain: string;
  is_you: boolean;
  total_citations: number;
  share_of_voice: number;
  avg_position: number;
  platforms_present: AIPlatform[];
  week_change: number;
}

export interface DailyMetric {
  id: string;
  project_id: string;
  date: string;
  platform: AIPlatform;
  total_keywords_tracked: number;
  keywords_with_citations: number;
  total_citations: number;
  avg_citation_position: number;
  first_position_citations: number;
  top3_citations: number;
  share_of_voice_percent: number;
  positive_mentions: number;
  neutral_mentions: number;
  negative_mentions: number;
}

export interface TrackingResult {
  platform: AIPlatform;
  success: boolean;
  citationFound: boolean;
  position?: number;
  responseTimeMs: number;
  error?: string;
}
