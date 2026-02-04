// AI Rank Tracker - Type Definitions

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

export enum CitationPosition {
  FIRST = 1,
  SECOND = 2,
  THIRD = 3,
  FOURTH = 4,
  FIFTH = 5,
  OTHER = 99
}

export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative'
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
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

// User & Organization
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  settings: OrganizationSettings;
}

export interface OrganizationSettings {
  max_keywords: number;
  max_competitors: number;
  tracking_interval_hours: number;
  alert_email_enabled: boolean;
  alert_webhook_url?: string;
}

// Project & Domain
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  primary_domain: string;
  competitor_domains: string[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Keywords & Prompts
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
}

// Citations - Core tracking data
export interface Citation {
  id: string;
  keyword_id: string;
  project_id: string;
  platform: AIPlatform;
  tracked_at: string;
  
  // Citation details
  domain_mentioned: boolean;
  specific_url?: string;
  citation_position?: CitationPosition;
  citation_context?: string;
  full_response_text?: string;
  response_summary?: string;
  
  // Content analysis
  sentiment: Sentiment;
  confidence_score?: number;
  word_count?: number;
  
  // Competitor data
  competitor_citations: CompetitorCitation[];
  total_sources_cited: number;
  
  // Metadata
  created_at: string;
}

export interface CompetitorCitation {
  domain: string;
  url?: string;
  position: CitationPosition;
  context?: string;
}

// Metrics & Analytics
export interface DailyMetric {
  id: string;
  project_id: string;
  date: string;
  platform: AIPlatform;
  
  // Citation metrics
  total_keywords_tracked: number;
  keywords_with_citations: number;
  total_citations: number;
  
  // Position metrics
  avg_citation_position: number;
  first_position_citations: number;
  top3_citations: number;
  
  // Share of voice
  share_of_voice_percent: number;
  competitor_sov_data: Record<string, number>;
  
  // Sentiment
  positive_mentions: number;
  neutral_mentions: number;
  negative_mentions: number;
  
  created_at: string;
}

export interface VisibilityScore {
  id: string;
  project_id: string;
  calculated_at: string;
  
  // Composite scores by platform
  platform_scores: Record<AIPlatform, PlatformScore>;
  
  // Overall score
  overall_score: number;
  overall_grade: string;
  
  // Component breakdown
  frequency_score: number;
  position_score: number;
  diversity_score: number;
  context_score: number;
  momentum_score: number;
  
  // Trend
  week_over_week_change: number;
  month_over_month_change: number;
}

export interface PlatformScore {
  score: number;
  citations_count: number;
  keywords_ranked: number;
  avg_position: number;
  share_of_voice: number;
}

// Alerts & Notifications
export interface Alert {
  id: string;
  project_id: string;
  organization_id: string;
  alert_type: AlertType;
  
  // Alert details
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  
  // Related entities
  keyword_id?: string;
  keyword_text?: string;
  platform?: AIPlatform;
  competitor_domain?: string;
  
  // Data snapshot
  previous_value?: number | string;
  current_value?: number | string;
  change_percent?: number;
  
  // Status
  is_read: boolean;
  read_at?: string;
  read_by?: string;
  
  created_at: string;
}

// Tracking Jobs
export interface TrackingJob {
  id: string;
  project_id: string;
  keyword_id: string;
  platform: AIPlatform;
  status: JobStatus;
  
  // Job details
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  
  // Results
  citation_found?: boolean;
  result_data?: Record<string, unknown>;
  error_message?: string;
  retry_count: number;
  
  created_at: string;
}

// API Integration Settings
export interface ApiIntegration {
  id: string;
  organization_id: string;
  
  // API Keys (encrypted)
  gemini_api_key?: string;
  serp_api_key?: string;
  openai_api_key?: string;
  perplexity_api_key?: string;
  dataforseo_login?: string;
  dataforseo_password?: string;
  
  // Rate limiting
  gemini_rate_limit: number;
  serp_rate_limit: number;
  openai_rate_limit: number;
  
  // Usage tracking
  monthly_requests: Record<string, number>;
  last_used_at?: string;
  
  updated_at: string;
}

// Content Analysis
export interface ContentAnalysis {
  id: string;
  url: string;
  project_id: string;
  analyzed_at: string;
  
  // Content quality scores
  content_quality_score: number;
  eeat_score: number;
  authority_score: number;
  structured_data_score: number;
  freshness_score: number;
  ux_score: number;
  
  // Detailed metrics
  word_count: number;
  reading_level: number;
  entity_density: number;
  schema_types: string[];
  has_faq_schema: boolean;
  has_author_bio: boolean;
  days_since_update: number;
  load_time_ms?: number;
  
  // Recommendations
  recommendations: ContentRecommendation[];
  
  // Overall
  total_score: number;
  grade: string;
  priority_actions: string[];
}

export interface ContentRecommendation {
  category: 'content_quality' | 'eeat' | 'authority' | 'structured_data' | 'freshness' | 'ux';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expected_impact: string;
  effort_level: 'low' | 'medium' | 'high';
}

// Dashboard Data
export interface DashboardData {
  project: Project;
  visibilityScore: VisibilityScore;
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

// Request/Response types
export interface TrackKeywordRequest {
  keyword_id: string;
  platforms?: AIPlatform[];
  priority?: boolean;
}

export interface BulkTrackRequest {
  project_id: string;
  keyword_ids?: string[];
  platforms?: AIPlatform[];
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  primary_domain: string;
  competitor_domains?: string[];
}

export interface AddKeywordRequest {
  project_id: string;
  keyword_text: string;
  category?: string;
  priority_level?: 1 | 2 | 3 | 4 | 5;
  funnel_stage?: 'awareness' | 'consideration' | 'decision';
}

// AI Platform Response Types
export interface AIPlatformResponse {
  platform: AIPlatform;
  query: string;
  response_text: string;
  citations: AICitation[];
  response_time_ms: number;
  error?: string;
}

export interface AICitation {
  url: string;
  title?: string;
  snippet?: string;
  position: number;
  domain: string;
  is_you: boolean;
}

// Gemini-specific types
export interface GeminiResponse {
  text: string;
  citations: GeminiCitation[];
  grounding_chunks?: GroundingChunk[];
}

export interface GeminiCitation {
  start_index: number;
  end_index: number;
  uri: string;
  title?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

// SERP API Types
export interface SerpAIOOverview {
  text_block?: string;
  references?: SerpReference[];
  serpapi_link?: string;
}

export interface SerpReference {
  title: string;
  link: string;
  source: string;
  date?: string;
}
