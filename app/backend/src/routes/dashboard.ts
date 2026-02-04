/**
 * Dashboard API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getScoringService } from '../services/scoring';
import { AIPlatform } from '../types';

const router = Router();

// Get dashboard data for a project
router.get('/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectResult = await pool.query(`
    SELECT p.*, 
      COUNT(DISTINCT k.id) as keyword_count
    FROM projects p
    LEFT JOIN keywords k ON p.id = k.project_id AND k.is_active = true
    WHERE p.id = $1 AND p.organization_id = $2
    GROUP BY p.id
  `, [projectId, organizationId]);

  if (projectResult.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const project = projectResult.rows[0];

  // Get latest visibility score
  const scoreResult = await pool.query(`
    SELECT * FROM visibility_scores
    WHERE project_id = $1
    ORDER BY calculated_at DESC
    LIMIT 1
  `, [projectId]);

  const visibilityScore = scoreResult.rows[0] || null;

  // Get recent citations
  const citationsResult = await pool.query(`
    SELECT c.*, k.keyword_text
    FROM citations c
    JOIN keywords k ON c.keyword_id = k.id
    WHERE c.project_id = $1
    AND c.domain_mentioned = true
    ORDER BY c.tracked_at DESC
    LIMIT 10
  `, [projectId]);

  // Get recent alerts
  const alertsResult = await pool.query(`
    SELECT *
    FROM alerts
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 10
  `, [projectId]);

  // Get platform breakdown
  const platformResult = await pool.query(`
    SELECT 
      platform,
      COUNT(*) FILTER (WHERE domain_mentioned = true) as total_citations,
      COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_ranked,
      AVG(citation_position) FILTER (WHERE domain_mentioned = true AND citation_position IS NOT NULL) as avg_position
    FROM citations
    WHERE project_id = $1
    AND tracked_at >= NOW() - INTERVAL '30 days'
    GROUP BY platform
  `, [projectId]);

  const platformBreakdown: Record<string, any> = {};
  platformResult.rows.forEach(row => {
    platformBreakdown[row.platform] = {
      total_citations: parseInt(row.total_citations),
      keywords_ranked: parseInt(row.keywords_ranked),
      avg_position: parseFloat(row.avg_position) || 0
    };
  });

  // Get trending keywords
  const scoringService = getScoringService();
  const trendingKeywords = await scoringService.getTrendingKeywords(projectId, 5);

  // Get competitor comparison
  const competitorResult = await pool.query(`
    WITH your_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE domain_mentioned = true) as citations,
        COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_ranked
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '30 days'
    ),
    competitor_stats AS (
      SELECT 
        (jsonb_array_elements(competitor_citations)->>'domain') as domain,
        COUNT(*) as mentions
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '30 days'
      GROUP BY domain
    )
    SELECT 
      $2 as domain,
      true as is_you,
      (SELECT citations FROM your_stats) as total_citations,
      (SELECT keywords_ranked FROM your_stats) as keywords_ranked
    UNION ALL
    SELECT 
      domain,
      false as is_you,
      mentions as total_citations,
      0 as keywords_ranked
    FROM competitor_stats
    WHERE domain IS NOT NULL
    ORDER BY total_citations DESC
    LIMIT 5
  `, [projectId, project.primary_domain]);

  res.json({
    project: {
      id: project.id,
      name: project.name,
      primary_domain: project.primary_domain,
      keyword_count: parseInt(project.keyword_count)
    },
    visibilityScore: visibilityScore ? {
      overall_score: visibilityScore.overall_score,
      overall_grade: visibilityScore.overall_grade,
      frequency_score: visibilityScore.frequency_score,
      position_score: visibilityScore.position_score,
      diversity_score: visibilityScore.diversity_score,
      context_score: visibilityScore.context_score,
      momentum_score: visibilityScore.momentum_score,
      calculated_at: visibilityScore.calculated_at
    } : null,
    recentCitations: citationsResult.rows,
    recentAlerts: alertsResult.rows,
    platformBreakdown,
    trendingKeywords,
    competitorComparison: competitorResult.rows
  });
}));

// Get visibility score history
router.get('/:projectId/scores', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const result = await pool.query(`
    SELECT 
      calculated_at,
      overall_score,
      overall_grade,
      frequency_score,
      position_score,
      diversity_score,
      context_score,
      momentum_score
    FROM visibility_scores
    WHERE project_id = $1
    AND calculated_at >= NOW() - INTERVAL '${days} days'
    ORDER BY calculated_at ASC
  `, [projectId]);

  res.json({ scores: result.rows });
}));

// Get daily metrics
router.get('/:projectId/metrics', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { start_date, end_date, platform } = req.query;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  let query = `
    SELECT *
    FROM daily_metrics
    WHERE project_id = $1
  `;
  const params: any[] = [projectId];
  let paramIndex = 2;

  if (start_date) {
    query += ` AND date >= $${paramIndex++}`;
    params.push(start_date);
  }

  if (end_date) {
    query += ` AND date <= $${paramIndex++}`;
    params.push(end_date);
  }

  if (platform) {
    query += ` AND platform = $${paramIndex++}`;
    params.push(platform);
  }

  query += ` ORDER BY date DESC`;

  const result = await pool.query(query, params);

  res.json({ metrics: result.rows });
}));

// Get share of voice
router.get('/:projectId/share-of-voice', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const organizationId = req.user?.organizationId;

  // Get project with competitors
  const projectResult = await pool.query(
    'SELECT primary_domain, competitor_domains FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectResult.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const { primary_domain, competitor_domains } = projectResult.rows[0];

  const scoringService = getScoringService();
  const sov = await scoringService.calculateShareOfVoice(
    projectId, 
    competitor_domains || []
  );

  res.json({
    yourDomain: primary_domain,
    yourShare: sov.yourShare,
    competitorShares: sov.competitorShares,
    totalMentions: sov.totalMentions
  });
}));

// Get citation trends
router.get('/:projectId/trends', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { platform, days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  let query = `
    SELECT 
      DATE(tracked_at) as date,
      platform,
      COUNT(*) FILTER (WHERE domain_mentioned = true) as citations,
      COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_ranked,
      AVG(citation_position) FILTER (WHERE domain_mentioned = true AND citation_position IS NOT NULL) as avg_position
    FROM citations
    WHERE project_id = $1
    AND tracked_at >= NOW() - INTERVAL '${days} days'
  `;
  const params: any[] = [projectId];

  if (platform) {
    query += ` AND platform = $${params.length + 1}`;
    params.push(platform);
  }

  query += `
    GROUP BY DATE(tracked_at), platform
    ORDER BY date ASC
  `;

  const result = await pool.query(query, params);

  res.json({ trends: result.rows });
}));

// Refresh dashboard data
router.post('/:projectId/refresh', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  // Recalculate visibility score
  const scoringService = getScoringService();
  const score = await scoringService.calculateVisibilityScore(projectId);

  // Generate daily metrics for today
  await scoringService.generateDailyMetrics(projectId, new Date());

  res.json({
    message: 'Dashboard data refreshed',
    visibilityScore: {
      overall_score: score.overall_score,
      overall_grade: score.overall_grade
    }
  });
}));

export default router;
