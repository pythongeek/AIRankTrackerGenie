// Project Types
export interface Project {
  id: string;
  name: string;
  domain: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
  keywordsCount: number;
  citationsCount: number;
  visibilityScore: number;
  competitors: string[];
}

export interface CreateProjectRequest {
  name: string;
  domain: string;
  description?: string;
  competitors?: string[];
}

// Keyword Types
export interface Keyword {
  id: string;
  projectId: string;
  keyword: string;
  status: 'active' | 'paused';
  createdAt: string;
  lastTrackedAt?: string;
  citationCount: number;
  avgPosition?: number;
}

export interface CreateKeywordRequest {
  projectId: string;
  keyword: string;
}

// Citation Types
export interface Citation {
  id: string;
  keywordId: string;
  projectId: string;
  platform: AIPlatform;
  url: string;
  position: number;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  trackedAt: string;
}

export type AIPlatform = 
  | 'google_ai_overview' 
  | 'gemini' 
  | 'chatgpt' 
  | 'perplexity' 
  | 'copilot' 
  | 'claude' 
  | 'grok' 
  | 'deepseek';

// Dashboard Types
export interface DashboardData {
  project: Project;
  overview: OverviewMetrics;
  platformBreakdown: PlatformMetrics[];
  recentCitations: Citation[];
  scoreHistory: ScoreHistoryPoint[];
  topKeywords: TopKeyword[];
}

export interface OverviewMetrics {
  totalCitations: number;
  totalKeywords: number;
  visibilityScore: number;
  scoreChange: number;
  activePlatforms: number;
  avgPosition: number;
  positionChange: number;
}

export interface PlatformMetrics {
  platform: AIPlatform;
  citations: number;
  percentage: number;
  change: number;
}

export interface ScoreHistoryPoint {
  date: string;
  score: number;
  frequency: number;
  position: number;
  diversity: number;
  context: number;
  momentum: number;
}

export interface TopKeyword {
  keyword: string;
  citations: number;
  avgPosition: number;
  trend: 'up' | 'down' | 'stable';
}

// Alert Types
export interface Alert {
  id: string;
  projectId: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type AlertType = 
  | 'new_citation' 
  | 'lost_citation' 
  | 'position_change' 
  | 'score_change'
  | 'competitor_alert'
  | 'system';

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  organizationId?: string;
}

// Settings Types
export interface OrganizationSettings {
  maxKeywords: number;
  maxCompetitors: number;
  trackingIntervalHours: number;
  alertEmailEnabled: boolean;
}

// Chart Data Types
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
