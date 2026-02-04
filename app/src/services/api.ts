import { User, Project, Keyword, Citation, Alert, VisibilityScore, DailyMetric, TrackingResult, DashboardData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) => 
    fetchWithAuth('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  
  register: (email: string, password: string, name: string) => 
    fetchWithAuth('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  
  me: (): Promise<{ user: User }> => 
    fetchWithAuth('/auth/me'),
};

// Projects
export const projects = {
  list: (): Promise<{ projects: Project[] }> => 
    fetchWithAuth('/api/projects'),
  
  get: (id: string): Promise<{ project: Project }> => 
    fetchWithAuth(`/api/projects/${id}`),
  
  create: (data: Partial<Project>): Promise<{ project: Project }> => 
    fetchWithAuth('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  
  update: (id: string, data: Partial<Project>): Promise<{ project: Project }> => 
    fetchWithAuth(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  
  delete: (id: string): Promise<void> => 
    fetchWithAuth(`/api/projects/${id}`, { method: 'DELETE' }),
  
  stats: (id: string): Promise<{ stats: any }> => 
    fetchWithAuth(`/api/projects/${id}/stats`),
};

// Keywords
export const keywords = {
  list: (projectId: string, params?: Record<string, string>): Promise<{ keywords: Keyword[] }> => {
    const queryParams = new URLSearchParams({ project_id: projectId, ...params });
    return fetchWithAuth(`/api/keywords?${queryParams}`);
  },
  
  get: (id: string): Promise<{ keyword: Keyword }> => 
    fetchWithAuth(`/api/keywords/${id}`),
  
  create: (data: Partial<Keyword>): Promise<{ keyword: Keyword }> => 
    fetchWithAuth('/api/keywords', { method: 'POST', body: JSON.stringify(data) }),
  
  bulkCreate: (projectId: string, keywords: Partial<Keyword>[]): Promise<{ keywords: Keyword[] }> => 
    fetchWithAuth('/api/keywords/bulk', { method: 'POST', body: JSON.stringify({ project_id: projectId, keywords }) }),
  
  update: (id: string, data: Partial<Keyword>): Promise<{ keyword: Keyword }> => 
    fetchWithAuth(`/api/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  
  delete: (id: string): Promise<void> => 
    fetchWithAuth(`/api/keywords/${id}`, { method: 'DELETE' }),
  
  history: (id: string, days?: number): Promise<{ citations: Citation[] }> => 
    fetchWithAuth(`/api/keywords/${id}/history?days=${days || 30}`),
};

// Tracking
export const tracking = {
  trackKeyword: (keywordId: string, platforms?: string[]): Promise<{ results: TrackingResult[] }> => 
    fetchWithAuth(`/api/tracking/keyword/${keywordId}`, { 
      method: 'POST', 
      body: JSON.stringify({ platforms }) 
    }),
  
  trackProject: (projectId: string, data?: { platforms?: string[]; keywordFilter?: string[] }): Promise<{ message: string; status: string }> => 
    fetchWithAuth(`/api/tracking/project/${projectId}`, { method: 'POST', body: JSON.stringify(data) }),
  
  status: (projectId: string): Promise<any> => 
    fetchWithAuth(`/api/tracking/status/${projectId}`),
  
  queue: (): Promise<{ jobs: any[] }> => 
    fetchWithAuth('/api/tracking/queue'),
  
  schedule: (data: { project_id: string; keyword_ids?: string[]; platforms?: string[]; scheduled_at?: string }): Promise<any> => 
    fetchWithAuth('/api/tracking/schedule', { method: 'POST', body: JSON.stringify(data) }),
  
  quickTest: (keyword: string, domain?: string, platforms?: string[]): Promise<any> => 
    fetchWithAuth('/api/tracking/quick-test', { 
      method: 'POST', 
      body: JSON.stringify({ keyword, domain, platforms }) 
    }),
};

// Dashboard
export const dashboard = {
  get: (projectId: string): Promise<DashboardData> => 
    fetchWithAuth(`/api/dashboard/${projectId}`),
  
  scores: (projectId: string, days?: number): Promise<{ scores: VisibilityScore[] }> => 
    fetchWithAuth(`/api/dashboard/${projectId}/scores?days=${days || 30}`),
  
  metrics: (projectId: string, params?: { start_date?: string; end_date?: string; platform?: string }): Promise<{ metrics: DailyMetric[] }> => {
    const queryParams = new URLSearchParams(params as Record<string, string>);
    return fetchWithAuth(`/api/dashboard/${projectId}/metrics?${queryParams}`);
  },
  
  shareOfVoice: (projectId: string): Promise<any> => 
    fetchWithAuth(`/api/dashboard/${projectId}/share-of-voice`),
  
  trends: (projectId: string, params?: { platform?: string; days?: number }): Promise<{ trends: any[] }> => {
    const queryParams = new URLSearchParams(params as Record<string, string>);
    return fetchWithAuth(`/api/dashboard/${projectId}/trends?${queryParams}`);
  },
  
  refresh: (projectId: string): Promise<any> => 
    fetchWithAuth(`/api/dashboard/${projectId}/refresh`, { method: 'POST' }),
};

// Citations
export const citations = {
  list: (params: { project_id?: string; keyword_id?: string; platform?: string; limit?: number; offset?: number }): Promise<{ citations: Citation[]; pagination: any }> => {
    const queryParams = new URLSearchParams(params as Record<string, string>);
    return fetchWithAuth(`/api/citations?${queryParams}`);
  },
  
  get: (id: string): Promise<{ citation: Citation }> => 
    fetchWithAuth(`/api/citations/${id}`),
  
  stats: {
    overview: (projectId: string, days?: number): Promise<{ stats: any }> => 
      fetchWithAuth(`/api/citations/stats/overview?project_id=${projectId}&days=${days || 30}`),
    
    topKeywords: (projectId: string, limit?: number): Promise<{ keywords: any[] }> => 
      fetchWithAuth(`/api/citations/stats/top-keywords?project_id=${projectId}&limit=${limit || 10}`),
    
    competitors: (projectId: string, days?: number): Promise<{ competitors: any[] }> => 
      fetchWithAuth(`/api/citations/stats/competitors?project_id=${projectId}&days=${days || 30}`),
  },
};

// Alerts
export const alerts = {
  list: (params?: { project_id?: string; is_read?: boolean; severity?: string; limit?: number; offset?: number }): Promise<{ alerts: Alert[]; pagination: any }> => {
    const queryParams = new URLSearchParams(params as Record<string, string>);
    return fetchWithAuth(`/api/alerts?${queryParams}`);
  },
  
  unreadCount: (): Promise<{ unreadCount: number; criticalUnread: number; warningUnread: number }> => 
    fetchWithAuth('/api/alerts/unread-count'),
  
  get: (id: string): Promise<{ alert: Alert }> => 
    fetchWithAuth(`/api/alerts/${id}`),
  
  markRead: (id: string): Promise<{ alert: Alert }> => 
    fetchWithAuth(`/api/alerts/${id}/read`, { method: 'PATCH' }),
  
  markAllRead: (projectId?: string): Promise<{ message: string; count: number }> => 
    fetchWithAuth('/api/alerts/mark-all-read', { method: 'POST', body: JSON.stringify({ project_id: projectId }) }),
  
  delete: (id: string): Promise<void> => 
    fetchWithAuth(`/api/alerts/${id}`, { method: 'DELETE' }),
};

// Competitors
export const competitors = {
  list: (projectId: string, days?: number): Promise<any> => 
    fetchWithAuth(`/api/competitors/${projectId}?days=${days || 30}`),
  
  gapAnalysis: (projectId: string): Promise<{ gapKeywords: any[] }> => 
    fetchWithAuth(`/api/competitors/${projectId}/gap-analysis`),
  
  trending: (projectId: string, competitorDomain: string, days?: number): Promise<any> => {
    const queryParams = new URLSearchParams({ competitor_domain: competitorDomain, days: String(days || 30) });
    return fetchWithAuth(`/api/competitors/${projectId}/trending?${queryParams}`);
  },
  
  add: (projectId: string, domain: string): Promise<any> => 
    fetchWithAuth(`/api/competitors/${projectId}/add`, { method: 'POST', body: JSON.stringify({ domain }) }),
  
  remove: (projectId: string, domain: string): Promise<any> => 
    fetchWithAuth(`/api/competitors/${projectId}/remove`, { method: 'DELETE', body: JSON.stringify({ domain }) }),
};

// Settings
export const settings = {
  organization: {
    get: (): Promise<{ organization: any }> => 
      fetchWithAuth('/api/settings/organization'),
    
    update: (settings: any): Promise<{ settings: any }> => 
      fetchWithAuth('/api/settings/organization', { method: 'PATCH', body: JSON.stringify({ settings }) }),
  },
  
  apiIntegrations: {
    get: (): Promise<any> => 
      fetchWithAuth('/api/settings/api-integrations'),
    
    update: (data: any): Promise<any> => 
      fetchWithAuth('/api/settings/api-integrations', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  
  tracking: {
    get: (): Promise<any> => 
      fetchWithAuth('/api/settings/tracking'),
    
    update: (data: any): Promise<any> => 
      fetchWithAuth('/api/settings/tracking', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  
  notifications: {
    get: (): Promise<any> => 
      fetchWithAuth('/api/settings/notifications'),
    
    update: (data: any): Promise<any> => 
      fetchWithAuth('/api/settings/notifications', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  
  testApi: (apiType: string, apiKey: string): Promise<any> => 
    fetchWithAuth('/api/settings/test-api', { method: 'POST', body: JSON.stringify({ api_type: apiType, api_key: apiKey }) }),
};

export default {
  auth,
  projects,
  keywords,
  tracking,
  dashboard,
  citations,
  alerts,
  competitors,
  settings,
};
