-- AI Rank Tracker - Database Schema
-- PostgreSQL with Supabase extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- ORGANIZATIONS & USERS
-- ============================================

CREATE TABLE organizations (
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

CREATE TABLE organization_members (
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

CREATE TABLE projects (
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

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_domain ON projects(primary_domain);

-- ============================================
-- KEYWORDS
-- ============================================

CREATE TABLE keywords (
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

CREATE INDEX idx_keywords_project ON keywords(project_id);
CREATE INDEX idx_keywords_active ON keywords(is_active) WHERE is_active = true;
CREATE INDEX idx_keywords_priority ON keywords(priority_level);

-- ============================================
-- CITATIONS - Core tracking data
-- ============================================

CREATE TABLE citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN (
        'google_ai_overview', 'gemini', 'chatgpt', 'perplexity', 
        'copilot', 'claude', 'grok', 'deepseek'
    )),
    tracked_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Citation details
    domain_mentioned BOOLEAN DEFAULT false,
    specific_url TEXT,
    citation_position INTEGER,
    citation_context TEXT,
    full_response_text TEXT,
    response_summary TEXT,
    
    -- Content analysis
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    confidence_score DECIMAL(5,4),
    word_count INTEGER,
    
    -- Competitor data
    competitor_citations JSONB DEFAULT '[]'::jsonb,
    total_sources_cited INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citations_keyword ON citations(keyword_id);
CREATE INDEX idx_citations_project ON citations(project_id);
CREATE INDEX idx_citations_platform ON citations(platform);
CREATE INDEX idx_citations_tracked ON citations(tracked_at);
CREATE INDEX idx_citations_domain ON citations(domain_mentioned) WHERE domain_mentioned = true;

-- Partition citations by month for performance
CREATE TABLE citations_partitioned (
    LIKE citations INCLUDING ALL
) PARTITION BY RANGE (tracked_at);

-- Create monthly partitions
CREATE TABLE citations_y2024m12 PARTITION OF citations_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE citations_y2025m01 PARTITION OF citations_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE citations_y2025m02 PARTITION OF citations_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ============================================
-- DAILY METRICS - Aggregated statistics
-- ============================================

CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform TEXT NOT NULL,
    
    -- Citation metrics
    total_keywords_tracked INTEGER DEFAULT 0,
    keywords_with_citations INTEGER DEFAULT 0,
    total_citations INTEGER DEFAULT 0,
    
    -- Position metrics
    avg_citation_position DECIMAL(4,2),
    first_position_citations INTEGER DEFAULT 0,
    top3_citations INTEGER DEFAULT 0,
    
    -- Share of voice
    share_of_voice_percent DECIMAL(5,2),
    competitor_sov_data JSONB DEFAULT '{}'::jsonb,
    
    -- Sentiment
    positive_mentions INTEGER DEFAULT 0,
    neutral_mentions INTEGER DEFAULT 0,
    negative_mentions INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, date, platform)
);

CREATE INDEX idx_daily_metrics_project ON daily_metrics(project_id);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_platform ON daily_metrics(platform);

-- ============================================
-- VISIBILITY SCORES - Composite scoring
-- ============================================

CREATE TABLE visibility_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Platform scores
    platform_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Overall score
    overall_score DECIMAL(5,2) NOT NULL,
    overall_grade TEXT NOT NULL,
    
    -- Component breakdown
    frequency_score DECIMAL(5,2),
    position_score DECIMAL(5,2),
    diversity_score DECIMAL(5,2),
    context_score DECIMAL(5,2),
    momentum_score DECIMAL(5,2),
    
    -- Trend
    week_over_week_change DECIMAL(5,2),
    month_over_month_change DECIMAL(5,2)
);

CREATE INDEX idx_visibility_scores_project ON visibility_scores(project_id);
CREATE INDEX idx_visibility_scores_calculated ON visibility_scores(calculated_at);

-- ============================================
-- ALERTS & NOTIFICATIONS
-- ============================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'new_citation', 'lost_citation', 'position_change', 
        'competitor_gain', 'new_platform', 'sentiment_shift', 'volume_spike'
    )),
    
    -- Alert details
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    
    -- Related entities
    keyword_id UUID REFERENCES keywords(id),
    keyword_text TEXT,
    platform TEXT,
    competitor_domain TEXT,
    
    -- Data snapshot
    previous_value TEXT,
    current_value TEXT,
    change_percent DECIMAL(6,2),
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    read_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_project ON alerts(project_id);
CREATE INDEX idx_alerts_org ON alerts(organization_id);
CREATE INDEX idx_alerts_unread ON alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_created ON alerts(created_at);

-- ============================================
-- TRACKING JOBS - Queue management
-- ============================================

CREATE TABLE tracking_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    
    -- Job timing
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Results
    citation_found BOOLEAN,
    result_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_jobs_status ON tracking_jobs(status);
CREATE INDEX idx_tracking_jobs_scheduled ON tracking_jobs(scheduled_at);
CREATE INDEX idx_tracking_jobs_project ON tracking_jobs(project_id);

-- ============================================
-- API INTEGRATIONS - Encrypted API keys
-- ============================================

CREATE TABLE api_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- API Keys (encrypted with pgcrypto)
    gemini_api_key TEXT,
    serp_api_key TEXT,
    openai_api_key TEXT,
    perplexity_api_key TEXT,
    dataforseo_login TEXT,
    dataforseo_password TEXT,
    
    -- Rate limiting
    gemini_rate_limit INTEGER DEFAULT 60,
    serp_rate_limit INTEGER DEFAULT 100,
    openai_rate_limit INTEGER DEFAULT 60,
    
    -- Usage tracking
    monthly_requests JSONB DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTENT ANALYSIS - Page scoring
-- ============================================

CREATE TABLE content_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Content quality scores
    content_quality_score DECIMAL(5,2),
    eeat_score DECIMAL(5,2),
    authority_score DECIMAL(5,2),
    structured_data_score DECIMAL(5,2),
    freshness_score DECIMAL(5,2),
    ux_score DECIMAL(5,2),
    
    -- Detailed metrics
    word_count INTEGER,
    reading_level DECIMAL(4,2),
    entity_density DECIMAL(5,2),
    schema_types TEXT[],
    has_faq_schema BOOLEAN DEFAULT false,
    has_author_bio BOOLEAN DEFAULT false,
    days_since_update INTEGER,
    load_time_ms INTEGER,
    
    -- Recommendations
    recommendations JSONB DEFAULT '[]'::jsonb,
    
    -- Overall
    total_score DECIMAL(5,2),
    grade TEXT,
    priority_actions TEXT[],
    
    UNIQUE(project_id, url)
);

CREATE INDEX idx_content_analyses_project ON content_analyses(project_id);
CREATE INDEX idx_content_analyses_url ON content_analyses(url);

-- ============================================
-- COMPETITOR TRACKING
-- ============================================

CREATE TABLE competitor_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    competitor_domain TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    
    -- Citation data
    total_citations INTEGER DEFAULT 0,
    platforms_present TEXT[],
    avg_position DECIMAL(4,2),
    share_of_voice DECIMAL(5,2),
    
    -- Keywords where they rank
    ranking_keywords TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, competitor_domain, snapshot_date)
);

CREATE INDEX idx_competitor_snapshots_project ON competitor_snapshots(project_id);
CREATE INDEX idx_competitor_snapshots_domain ON competitor_snapshots(competitor_domain);
CREATE INDEX idx_competitor_snapshots_date ON competitor_snapshots(snapshot_date);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate visibility score
CREATE OR REPLACE FUNCTION calculate_visibility_score(project_uuid UUID)
RETURNS TABLE (
    overall_score DECIMAL,
    overall_grade TEXT,
    frequency_score DECIMAL,
    position_score DECIMAL,
    diversity_score DECIMAL,
    context_score DECIMAL,
    momentum_score DECIMAL
) AS $$
DECLARE
    v_frequency DECIMAL;
    v_position DECIMAL;
    v_diversity DECIMAL;
    v_context DECIMAL;
    v_momentum DECIMAL;
    v_total DECIMAL;
    v_grade TEXT;
BEGIN
    -- Calculate frequency score (40% weight)
    SELECT COALESCE(
        (COUNT(*) FILTER (WHERE domain_mentioned = true)::DECIMAL / 
         NULLIF(COUNT(*), 0) * 100), 0
    ) INTO v_frequency
    FROM citations
    WHERE project_id = project_uuid
    AND tracked_at >= NOW() - INTERVAL '30 days';
    
    -- Calculate position score (30% weight)
    SELECT COALESCE(
        (100 - (AVG(citation_position) FILTER (WHERE citation_position IS NOT NULL) * 20)), 
        0
    ) INTO v_position
    FROM citations
    WHERE project_id = project_uuid
    AND domain_mentioned = true
    AND tracked_at >= NOW() - INTERVAL '30 days';
    
    -- Calculate diversity score (15% weight)
    SELECT COALESCE(
        (COUNT(DISTINCT platform)::DECIMAL / 8 * 100), 0
    ) INTO v_diversity
    FROM citations
    WHERE project_id = project_uuid
    AND domain_mentioned = true
    AND tracked_at >= NOW() - INTERVAL '30 days';
    
    -- Calculate context score (10% weight)
    SELECT COALESCE(
        (COUNT(*) FILTER (WHERE sentiment = 'positive')::DECIMAL / 
         NULLIF(COUNT(*) FILTER (WHERE sentiment IN ('positive', 'negative')), 0) * 100), 
        50
    ) INTO v_context
    FROM citations
    WHERE project_id = project_uuid
    AND domain_mentioned = true
    AND tracked_at >= NOW() - INTERVAL '30 days';
    
    -- Calculate momentum score (5% weight)
    SELECT COALESCE(
        CASE 
            WHEN last_month.count = 0 THEN 0
            ELSE ((this_month.count - last_month.count)::DECIMAL / last_month.count * 100)
        END, 0
    ) INTO v_momentum
    FROM (
        SELECT COUNT(*) as count
        FROM citations
        WHERE project_id = project_uuid
        AND domain_mentioned = true
        AND tracked_at >= DATE_TRUNC('month', NOW())
    ) this_month,
    (
        SELECT COUNT(*) as count
        FROM citations
        WHERE project_id = project_uuid
        AND domain_mentioned = true
        AND tracked_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
        AND tracked_at < DATE_TRUNC('month', NOW())
    ) last_month;
    
    -- Calculate total weighted score
    v_total := (v_frequency * 0.40) + 
               (v_position * 0.30) + 
               (v_diversity * 0.15) + 
               (v_context * 0.10) + 
               (LEAST(GREATEST(v_momentum, -100), 100) * 0.05);
    
    -- Assign grade
    v_grade := CASE
        WHEN v_total >= 90 THEN 'A+'
        WHEN v_total >= 80 THEN 'A'
        WHEN v_total >= 70 THEN 'B'
        WHEN v_total >= 60 THEN 'C'
        WHEN v_total >= 50 THEN 'D'
        ELSE 'F'
    END;
    
    RETURN QUERY SELECT 
        ROUND(v_total, 2),
        v_grade,
        ROUND(v_frequency, 2),
        ROUND(v_position, 2),
        ROUND(v_diversity, 2),
        ROUND(v_context, 2),
        ROUND(v_momentum, 2);
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (simplified - adjust based on auth setup)
CREATE POLICY org_isolation ON organizations
    FOR ALL USING (id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

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
