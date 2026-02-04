/**
 * Competitors API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Get competitor analysis for a project
router.get('/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  // Get project with competitor domains
  const projectResult = await pool.query(
    'SELECT primary_domain, competitor_domains FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectResult.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const { primary_domain, competitor_domains } = projectResult.rows[0];

  // Get citation comparison
  const comparisonResult = await pool.query(`
    WITH all_citations AS (
      SELECT 
        c.platform,
        c.keyword_id,
        CASE 
          WHEN c.domain_mentioned = true THEN $2
          ELSE (jsonb_array_elements(c.competitor_citations)->>'domain')
        END as domain,
        c.citation_position,
        c.tracked_at
      FROM citations c
      WHERE c.project_id = $1
      AND c.tracked_at >= NOW() - INTERVAL '${days} days'
    )
    SELECT 
      domain,
      platform,
      COUNT(*) as citations,
      COUNT(DISTINCT keyword_id) as keywords_ranked,
      AVG(citation_position) as avg_position
    FROM all_citations
    WHERE domain IS NOT NULL
    GROUP BY domain, platform
    ORDER BY citations DESC
  `, [projectId, primary_domain]);

  // Aggregate by domain
  const domainMap = new Map();
  comparisonResult.rows.forEach(row => {
    const domain = row.domain;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        is_you: domain === primary_domain,
        total_citations: 0,
        keywords_ranked: new Set(),
        platforms: {},
        avg_positions: []
      });
    }
    
    const d = domainMap.get(domain);
    d.total_citations += parseInt(row.citations);
    d.keywords_ranked.add(row.keyword_id);
    
    if (!d.platforms[row.platform]) {
      d.platforms[row.platform] = { citations: 0, avg_position: 0 };
    }
    d.platforms[row.platform].citations += parseInt(row.citations);
    
    if (row.avg_position) {
      d.avg_positions.push(parseFloat(row.avg_position));
    }
  });

  // Calculate averages and format
  const competitors = Array.from(domainMap.values()).map(d => ({
    domain: d.domain,
    is_you: d.is_you,
    total_citations: d.total_citations,
    keywords_ranked: d.keywords_ranked.size,
    avg_position: d.avg_positions.length > 0
      ? d.avg_positions.reduce((a: number, b: number) => a + b, 0) / d.avg_positions.length
      : null,
    platforms: Object.entries(d.platforms).map(([platform, data]: [string, any]) => ({
      platform,
      citations: data.citations
    }))
  }));

  // Sort by citations
  competitors.sort((a, b) => b.total_citations - a.total_citations);

  res.json({
    yourDomain: primary_domain,
    trackedCompetitors: competitor_domains || [],
    comparison: competitors
  });
}));

// Get content gap analysis
router.get('/:projectId/gap-analysis', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const organizationId = req.user?.organizationId;

  // Get project
  const projectResult = await pool.query(
    'SELECT primary_domain, competitor_domains FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectResult.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const { primary_domain, competitor_domains } = projectResult.rows[0];

  // Find keywords where competitors rank but you don't
  const gapResult = await pool.query(`
    WITH your_keywords AS (
      SELECT DISTINCT keyword_id
      FROM citations
      WHERE project_id = $1
      AND domain_mentioned = true
      AND tracked_at >= NOW() - INTERVAL '30 days'
    ),
    competitor_keywords AS (
      SELECT DISTINCT
        keyword_id,
        jsonb_array_elements(competitor_citations)->>'domain' as competitor_domain
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '30 days'
    )
    SELECT 
      k.id as keyword_id,
      k.keyword_text,
      k.funnel_stage,
      k.priority_level,
      COUNT(DISTINCT ck.competitor_domain) as competitor_count,
      ARRAY_AGG(DISTINCT ck.competitor_domain) as ranking_competitors
    FROM competitor_keywords ck
    JOIN keywords k ON ck.keyword_id = k.id
    WHERE ck.keyword_id NOT IN (SELECT keyword_id FROM your_keywords)
    AND ck.competitor_domain = ANY($2)
    GROUP BY k.id, k.keyword_text, k.funnel_stage, k.priority_level
    ORDER BY competitor_count DESC, k.priority_level ASC
    LIMIT 50
  `, [projectId, competitor_domains || []]);

  res.json({
    gapKeywords: gapResult.rows.map(row => ({
      keywordId: row.keyword_id,
      keywordText: row.keyword_text,
      funnelStage: row.funnel_stage,
      priorityLevel: row.priority_level,
      competitorCount: parseInt(row.competitor_count),
      rankingCompetitors: row.ranking_competitors
    }))
  });
}));

// Get competitor trending content
router.get('/:projectId/trending', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { competitor_domain, days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  // Get URLs cited for this competitor
  const result = await pool.query(`
    WITH competitor_citations AS (
      SELECT 
        (jsonb_array_elements(competitor_citations)->>'url') as url,
        (jsonb_array_elements(competitor_citations)->>'domain') as domain,
        tracked_at
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '${days} days'
    )
    SELECT 
      url,
      domain,
      COUNT(*) as citation_count,
      MAX(tracked_at) as last_cited
    FROM competitor_citations
    WHERE domain = $2
    AND url IS NOT NULL
    GROUP BY url, domain
    ORDER BY citation_count DESC
    LIMIT 20
  `, [projectId, competitor_domain]);

  res.json({
    competitorDomain: competitor_domain,
    topUrls: result.rows.map(row => ({
      url: row.url,
      citationCount: parseInt(row.citation_count),
      lastCited: row.last_cited
    }))
  });
}));

// Add competitor to track
router.post('/:projectId/add', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { domain } = req.body;
  const organizationId = req.user?.organizationId;

  if (!domain) {
    throw createError('Domain is required', 400);
  }

  // Validate domain
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw createError('Invalid domain format', 400);
  }

  // Get current competitors
  const projectResult = await pool.query(
    'SELECT competitor_domains FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectResult.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const currentCompetitors = projectResult.rows[0].competitor_domains || [];

  // Check limit
  if (currentCompetitors.length >= 10) {
    throw createError('Maximum number of competitors reached (10)', 400);
  }

  // Add if not already present
  if (!currentCompetitors.includes(domain)) {
    const newCompetitors = [...currentCompetitors, domain];
    
    await pool.query(`
      UPDATE projects
      SET competitor_domains = $1, updated_at = NOW()
      WHERE id = $2
    `, [newCompetitors, projectId]);
  }

  res.json({ 
    message: 'Competitor added successfully',
    domain
  });
}));

// Remove competitor
router.delete('/:projectId/remove', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { domain } = req.body;
  const organizationId = req.user?.organizationId;

  if (!domain) {
    throw createError('Domain is required', 400);
  }

  // Get current competitors
  const projectResult = await pool.query(
    'SELECT competitor_domains FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectResult.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const currentCompetitors = projectResult.rows[0].competitor_domains || [];
  const newCompetitors = currentCompetitors.filter((d: string) => d !== domain);

  await pool.query(`
    UPDATE projects
    SET competitor_domains = $1, updated_at = NOW()
    WHERE id = $2
  `, [newCompetitors, projectId]);

  res.json({ 
    message: 'Competitor removed successfully',
    domain
  });
}));

export default router;
