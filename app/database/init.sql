-- AI Rank Tracker - Database Initialization Script
-- Run this to set up the database schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ORGANIZATIONS & USERS
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{
        "max_keywords": 1000,
        "max_competitors": 10,
        "tracking_interval_hours": 24,
        "alert_email_enabled": true
    }'::jsonb
);

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    primary_domain TEXT NOT NULL,
    competitor_domains TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_domain ON projects(primary_domain);

-- ============================================
-- KEYWORDS
-- ============================================

CREATE TABLE IF NOT EXISTS keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    keyword_text TEXT NOT NULL,
    category TEXT,
    priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
    search_volume INTEGER,
    difficulty INTEGER CHECK (difficulty BETWEEN 0 AND 100),
    funnel_stage TEXT DEFAULT 'awareness' CHECK (funnel_stage IN ('awareness', 'consideration', 'decision')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_tracked_at TIMESTAMPTZ,
    UNIQUE(project_id, keyword_text)
);

CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_keywords_active ON keywords(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_keywords_priority ON keywords(priority_level);

-- ============================================
-- CITATIONS - Core tracking data
-- ============================================

CREATE TABLE IF NOT EXISTS citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN (
        'google_ai_overview', 'gemini', 'chatgpt', 'perplexity', 
        'copilot', 'claude', 'grok', 'deepseek'
    )),
    tracked_at TIMESTAMPTZ DEFAULT NOW(),
    domain_mentioned BOOLEAN DEFAULT false,
    specific_url TEXT,
    citation_position INTEGER,
    citation_context TEXT,
    full_response_text TEXT,
    response_summary TEXT,
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    confidence_score DECIMAL(5,4),
    word_count INTEGER,
    competitor_citations JSONB DEFAULT '[]'::jsonb,
    total_sources_cited INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_keyword ON citations(keyword_id);
CREATE INDEX IF NOT EXISTS idx_citations_project ON citations(project_id);
CREATE INDEX IF NOT EXISTS idx_citations_platform ON citations(platform);
CREATE INDEX IF NOT EXISTS idx_citations_tracked ON citations(tracked_at);
CREATE INDEX IF NOT EXISTS idx_citations_domain ON citations(domain_mentioned) WHERE domain_mentioned = true;

-- ============================================
-- DAILY METRICS - Aggregated statistics
-- ============================================

CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform TEXT NOT NULL,
    total_keywords_tracked INTEGER DEFAULT 0,
    keywords_with_citations INTEGER DEFAULT 0,
    total_citations INTEGER DEFAULT 0,
    avg_citation_position DECIMAL(4,2),
    first_position_citations INTEGER DEFAULT 0,
    top3_citations INTEGER DEFAULT 0,
    share_of_voice_percent DECIMAL(5,2),
    competitor_sov_data JSONB DEFAULT '{}'::jsonb,
    positive_mentions INTEGER DEFAULT 0,
    neutral_mentions INTEGER DEFAULT 0,
    negative_mentions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, date, platform)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_project ON daily_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_platform ON daily_metrics(platform);

-- ============================================
-- VISIBILITY SCORES - Composite scoring
-- ============================================

CREATE TABLE IF NOT EXISTS visibility_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    platform_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    overall_score DECIMAL(5,2) NOT NULL,
    overall_grade TEXT NOT NULL,
    frequency_score DECIMAL(5,2),
    position_score DECIMAL(5,2),
    diversity_score DECIMAL(5,2),
    context_score DECIMAL(5,2),
    momentum_score DECIMAL(5,2),
    week_over_week_change DECIMAL(5,2),
    month_over_month_change DECIMAL(5,2)
);

CREATE INDEX IF NOT EXISTS idx_visibility_scores_project ON visibility_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_visibility_scores_calculated ON visibility_scores(calculated_at);

-- ============================================
-- ALERTS & NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'new_citation', 'lost_citation', 'position_change', 
        'competitor_gain', 'new_platform', 'sentiment_shift', 'volume_spike'
    )),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    keyword_id UUID REFERENCES keywords(id),
    keyword_text TEXT,
    platform TEXT,
    competitor_domain TEXT,
    previous_value TEXT,
    current_value TEXT,
    change_percent DECIMAL(6,2),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    read_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_project ON alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

-- ============================================
-- TRACKING JOBS - Queue management
-- ============================================

CREATE TABLE IF NOT EXISTS tracking_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    citation_found BOOLEAN,
    result_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_jobs_status ON tracking_jobs(status);
CREATE INDEX IF NOT EXISTS idx_tracking_jobs_scheduled ON tracking_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tracking_jobs_project ON tracking_jobs(project_id);

-- ============================================
-- API INTEGRATIONS - Encrypted API keys
-- ============================================

CREATE TABLE IF NOT EXISTS api_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    gemini_api_key TEXT,
    serp_api_key TEXT,
    openai_api_key TEXT,
    perplexity_api_key TEXT,
    dataforseo_login TEXT,
    dataforseo_password TEXT,
    gemini_rate_limit INTEGER DEFAULT 60,
    serp_rate_limit INTEGER DEFAULT 100,
    openai_rate_limit INTEGER DEFAULT 60,
    monthly_requests JSONB DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_keywords_updated_at ON keywords;
CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default organization for testing
INSERT INTO organizations (id, name, slug) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default-org')
ON CONFLICT DO NOTHING;

-- Insert sample project
INSERT INTO projects (id, organization_id, name, primary_domain, competitor_domains) VALUES 
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 
     'Sample Project', 'example.com', ARRAY['competitor1.com', 'competitor2.com'])
ON CONFLICT DO NOTHING;
