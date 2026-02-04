/**
 * Citations API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Get citations for a project
router.get('/', asyncHandler(async (req, res) => {
  const { 
    project_id, 
    keyword_id, 
    platform, 
    domain_mentioned, 
    sentiment,
    start_date,
    end_date,
    limit = 50,
    offset = 0
  } = req.query;
  
  const organizationId = req.user?.organizationId;

  if (!project_id && !keyword_id) {
    throw createError('Project ID or Keyword ID is required', 400);
  }

  let query = `
    SELECT c.*, k.keyword_text, p.primary_domain
    FROM citations c
    JOIN keywords k ON c.keyword_id = k.id
    JOIN projects p ON c.project_id = p.id
    WHERE p.organization_id = $1
  `;
  const params: any[] = [organizationId];
  let paramIndex = 2;

  if (project_id) {
    query += ` AND c.project_id = $${paramIndex++}`;
    params.push(project_id);
  }

  if (keyword_id) {
    query += ` AND c.keyword_id = $${paramIndex++}`;
    params.push(keyword_id);
  }

  if (platform) {
    query += ` AND c.platform = $${paramIndex++}`;
    params.push(platform);
  }

  if (domain_mentioned !== undefined) {
    query += ` AND c.domain_mentioned = $${paramIndex++}`;
    params.push(domain_mentioned === 'true');
  }

  if (sentiment) {
    query += ` AND c.sentiment = $${paramIndex++}`;
    params.push(sentiment);
  }

  if (start_date) {
    query += ` AND c.tracked_at >= $${paramIndex++}`;
    params.push(start_date);
  }

  if (end_date) {
    query += ` AND c.tracked_at <= $${paramIndex++}`;
    params.push(end_date);
  }

  // Get total count
  const countResult = await pool.query(
    query.replace('SELECT c.*, k.keyword_text, p.primary_domain', 'SELECT COUNT(*)'),
    params
  );
  const totalCount = parseInt(countResult.rows[0].count);

  // Add pagination
  query += ` ORDER BY c.tracked_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  res.json({
    citations: result.rows,
    pagination: {
      total: totalCount,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
    }
  });
}));

// Get single citation
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT c.*, k.keyword_text, p.primary_domain
    FROM citations c
    JOIN keywords k ON c.keyword_id = k.id
    JOIN projects p ON c.project_id = p.id
    WHERE c.id = $1 AND p.organization_id = $2
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Citation not found', 404);
  }

  res.json({ citation: result.rows[0] });
}));

// Get citation statistics
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const { project_id, days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  if (!project_id) {
    throw createError('Project ID is required', 400);
  }

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [project_id, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const result = await pool.query(`
    WITH citation_stats AS (
      SELECT 
        platform,
        COUNT(*) FILTER (WHERE domain_mentioned = true) as your_citations,
        COUNT(*) as total_citations,
        COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_ranked,
        AVG(citation_position) FILTER (WHERE domain_mentioned = true AND citation_position IS NOT NULL) as avg_position,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_mentions,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_mentions,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_mentions
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '${days} days'
      GROUP BY platform
    ),
    position_distribution AS (
      SELECT 
        citation_position,
        COUNT(*) as count
      FROM citations
      WHERE project_id = $1
      AND domain_mentioned = true
      AND tracked_at >= NOW() - INTERVAL '${days} days'
      AND citation_position IS NOT NULL
      GROUP BY citation_position
    )
    SELECT 
      (SELECT json_object_agg(platform, json_build_object(
        'your_citations', your_citations,
        'total_citations', total_citations,
        'keywords_ranked', keywords_ranked,
        'avg_position', avg_position,
        'positive_mentions', positive_mentions,
        'neutral_mentions', neutral_mentions,
        'negative_mentions', negative_mentions
      )) FROM citation_stats) as platform_stats,
      (SELECT json_object_agg(citation_position::text, count) FROM position_distribution) as position_distribution,
      (SELECT SUM(your_citations) FROM citation_stats) as total_your_citations,
      (SELECT SUM(total_citations) FROM citation_stats) as total_all_citations
  `, [project_id]);

  res.json({ stats: result.rows[0] });
}));

// Get top cited keywords
router.get('/stats/top-keywords', asyncHandler(async (req, res) => {
  const { project_id, limit = 10 } = req.query;
  const organizationId = req.user?.organizationId;

  if (!project_id) {
    throw createError('Project ID is required', 400);
  }

  const result = await pool.query(`
    SELECT 
      k.id,
      k.keyword_text,
      COUNT(*) FILTER (WHERE c.domain_mentioned = true) as citation_count,
      AVG(c.citation_position) FILTER (WHERE c.domain_mentioned = true AND c.citation_position IS NOT NULL) as avg_position,
      MAX(c.tracked_at) FILTER (WHERE c.domain_mentioned = true) as last_cited_at
    FROM keywords k
    LEFT JOIN citations c ON k.id = c.keyword_id
    WHERE k.project_id = $1
    AND k.is_active = true
    GROUP BY k.id, k.keyword_text
    HAVING COUNT(*) FILTER (WHERE c.domain_mentioned = true) > 0
    ORDER BY citation_count DESC
    LIMIT $2
  `, [project_id, limit]);

  res.json({ keywords: result.rows });
}));

// Get competitor citation analysis
router.get('/stats/competitors', asyncHandler(async (req, res) => {
  const { project_id, days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  if (!project_id) {
    throw createError('Project ID is required', 400);
  }

  const result = await pool.query(`
    WITH competitor_citations AS (
      SELECT 
        jsonb_array_elements(competitor_citations)->>'domain' as competitor_domain,
        platform,
        keyword_id
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '${days} days'
    )
    SELECT 
      competitor_domain,
      platform,
      COUNT(*) as mentions,
      COUNT(DISTINCT keyword_id) as keywords_ranked
    FROM competitor_citations
    WHERE competitor_domain IS NOT NULL
    GROUP BY competitor_domain, platform
    ORDER BY mentions DESC
  `, [project_id]);

  // Aggregate by competitor
  const competitorMap = new Map();
  result.rows.forEach(row => {
    const domain = row.competitor_domain;
    if (!competitorMap.has(domain)) {
      competitorMap.set(domain, {
        domain,
        total_mentions: 0,
        keywords_ranked: new Set(),
        platforms: new Set()
      });
    }
    
    const comp = competitorMap.get(domain);
    comp.total_mentions += parseInt(row.mentions);
    comp.keywords_ranked.add(row.keyword_id);
    comp.platforms.add(row.platform);
  });

  const competitors = Array.from(competitorMap.values()).map(c => ({
    domain: c.domain,
    total_mentions: c.total_mentions,
    keywords_ranked: c.keywords_ranked.size,
    platforms: Array.from(c.platforms)
  }));

  res.json({ competitors });
}));

export default router;
