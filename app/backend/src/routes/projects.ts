/**
 * Projects API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get all projects for user's organization
router.get('/', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  
  if (!organizationId) {
    throw createError('Organization not found', 400);
  }

  const result = await pool.query(`
    SELECT p.*, 
      COUNT(DISTINCT k.id) as keyword_count,
      COUNT(DISTINCT c.id) FILTER (WHERE c.domain_mentioned = true) as total_citations
    FROM projects p
    LEFT JOIN keywords k ON p.id = k.project_id AND k.is_active = true
    LEFT JOIN citations c ON p.id = c.project_id AND c.tracked_at >= NOW() - INTERVAL '30 days'
    WHERE p.organization_id = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [organizationId]);

  res.json({ projects: result.rows });
}));

// Get single project
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT p.*,
      COUNT(DISTINCT k.id) as keyword_count,
      COUNT(DISTINCT c.id) FILTER (WHERE c.domain_mentioned = true AND c.tracked_at >= NOW() - INTERVAL '30 days') as recent_citations
    FROM projects p
    LEFT JOIN keywords k ON p.id = k.project_id AND k.is_active = true
    LEFT JOIN citations c ON p.id = c.project_id
    WHERE p.id = $1 AND p.organization_id = $2
    GROUP BY p.id
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  res.json({ project: result.rows[0] });
}));

// Create new project
router.post('/', asyncHandler(async (req, res) => {
  const { name, description, primary_domain, competitor_domains = [] } = req.body;
  const organizationId = req.user?.organizationId;

  if (!name || !primary_domain) {
    throw createError('Name and primary domain are required', 400);
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(primary_domain)) {
    throw createError('Invalid domain format', 400);
  }

  const result = await pool.query(`
    INSERT INTO projects (organization_id, name, description, primary_domain, competitor_domains)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [organizationId, name, description, primary_domain, competitor_domains]);

  logger.info('Project created', { 
    projectId: result.rows[0].id, 
    organizationId 
  });

  res.status(201).json({ project: result.rows[0] });
}));

// Update project
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, primary_domain, competitor_domains, is_active } = req.body;
  const organizationId = req.user?.organizationId;

  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description);
  }
  if (primary_domain !== undefined) {
    updates.push(`primary_domain = $${paramIndex++}`);
    values.push(primary_domain);
  }
  if (competitor_domains !== undefined) {
    updates.push(`competitor_domains = $${paramIndex++}`);
    values.push(competitor_domains);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(is_active);
  }

  if (updates.length === 0) {
    throw createError('No fields to update', 400);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id, organizationId);

  const result = await pool.query(`
    UPDATE projects 
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  res.json({ project: result.rows[0] });
}));

// Delete project
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    DELETE FROM projects 
    WHERE id = $1 AND organization_id = $2
    RETURNING id
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  logger.info('Project deleted', { projectId: id, organizationId });

  res.json({ message: 'Project deleted successfully' });
}));

// Get project statistics
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [id, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  // Get comprehensive stats
  const stats = await pool.query(`
    WITH citation_stats AS (
      SELECT 
        platform,
        COUNT(*) FILTER (WHERE domain_mentioned = true) as citations,
        COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_ranked,
        AVG(citation_position) FILTER (WHERE domain_mentioned = true AND citation_position IS NOT NULL) as avg_position
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= NOW() - INTERVAL '30 days'
      GROUP BY platform
    ),
    keyword_stats AS (
      SELECT 
        COUNT(*) as total_keywords,
        COUNT(*) FILTER (WHERE last_tracked_at IS NOT NULL) as tracked_keywords
      FROM keywords
      WHERE project_id = $1 AND is_active = true
    ),
    sentiment_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative
      FROM citations
      WHERE project_id = $1
      AND domain_mentioned = true
      AND tracked_at >= NOW() - INTERVAL '30 days'
    )
    SELECT 
      (SELECT json_object_agg(platform, json_build_object(
        'citations', citations,
        'keywords_ranked', keywords_ranked,
        'avg_position', avg_position
      )) FROM citation_stats) as platform_breakdown,
      (SELECT json_build_object(
        'total', total_keywords,
        'tracked', tracked_keywords
      ) FROM keyword_stats) as keyword_stats,
      (SELECT json_build_object(
        'positive', positive,
        'neutral', neutral,
        'negative', negative
      ) FROM sentiment_stats) as sentiment_stats
  `, [id]);

  res.json({ stats: stats.rows[0] });
}));

export default router;
