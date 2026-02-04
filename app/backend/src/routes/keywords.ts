/**
 * Keywords API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get keywords for a project
router.get('/', asyncHandler(async (req, res) => {
  const { project_id, search, category, priority, is_active } = req.query;
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

  // Build query with filters
  let query = `
    SELECT k.*,
      COUNT(c.id) FILTER (WHERE c.domain_mentioned = true AND c.tracked_at >= NOW() - INTERVAL '30 days') as recent_citations,
      MAX(c.tracked_at) as last_citation_at
    FROM keywords k
    LEFT JOIN citations c ON k.id = c.keyword_id
    WHERE k.project_id = $1
  `;
  const params: any[] = [project_id];
  let paramIndex = 2;

  if (search) {
    query += ` AND k.keyword_text ILIKE $${paramIndex++}`;
    params.push(`%${search}%`);
  }

  if (category) {
    query += ` AND k.category = $${paramIndex++}`;
    params.push(category);
  }

  if (priority) {
    query += ` AND k.priority_level = $${paramIndex++}`;
    params.push(priority);
  }

  if (is_active !== undefined) {
    query += ` AND k.is_active = $${paramIndex++}`;
    params.push(is_active === 'true');
  }

  query += `
    GROUP BY k.id
    ORDER BY k.priority_level ASC, k.created_at DESC
  `;

  const result = await pool.query(query, params);

  res.json({ keywords: result.rows });
}));

// Get single keyword
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT k.*, p.organization_id
    FROM keywords k
    JOIN projects p ON k.project_id = p.id
    WHERE k.id = $1 AND p.organization_id = $2
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Keyword not found', 404);
  }

  res.json({ keyword: result.rows[0] });
}));

// Create new keyword
router.post('/', asyncHandler(async (req, res) => {
  const { 
    project_id, 
    keyword_text, 
    category, 
    priority_level = 3, 
    search_volume, 
    difficulty, 
    funnel_stage = 'awareness' 
  } = req.body;
  
  const organizationId = req.user?.organizationId;

  if (!project_id || !keyword_text) {
    throw createError('Project ID and keyword text are required', 400);
  }

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [project_id, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  // Check keyword limit
  const limitCheck = await pool.query(`
    SELECT COUNT(*) as count
    FROM keywords
    WHERE project_id = $1 AND is_active = true
  `, [project_id]);

  const keywordCount = parseInt(limitCheck.rows[0].count);
  const maxKeywords = 1000; // From organization settings

  if (keywordCount >= maxKeywords) {
    throw createError(`Keyword limit reached (${maxKeywords})`, 400);
  }

  try {
    const result = await pool.query(`
      INSERT INTO keywords (project_id, keyword_text, category, priority_level, search_volume, difficulty, funnel_stage)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [project_id, keyword_text, category, priority_level, search_volume, difficulty, funnel_stage]);

    logger.info('Keyword created', { 
      keywordId: result.rows[0].id, 
      projectId: project_id 
    });

    res.status(201).json({ keyword: result.rows[0] });

  } catch (error: any) {
    if (error.code === '23505') {
      throw createError('Keyword already exists for this project', 409);
    }
    throw error;
  }
}));

// Bulk create keywords
router.post('/bulk', asyncHandler(async (req, res) => {
  const { project_id, keywords } = req.body;
  const organizationId = req.user?.organizationId;

  if (!project_id || !Array.isArray(keywords) || keywords.length === 0) {
    throw createError('Project ID and keywords array are required', 400);
  }

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [project_id, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  const results = [];
  const errors = [];

  for (const kw of keywords) {
    try {
      const result = await pool.query(`
        INSERT INTO keywords (project_id, keyword_text, category, priority_level, funnel_stage)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id, keyword_text) DO UPDATE SET
          category = EXCLUDED.category,
          priority_level = EXCLUDED.priority_level,
          funnel_stage = EXCLUDED.funnel_stage,
          is_active = true
        RETURNING *
      `, [
        project_id, 
        kw.keyword_text, 
        kw.category, 
        kw.priority_level || 3, 
        kw.funnel_stage || 'awareness'
      ]);

      results.push(result.rows[0]);

    } catch (error: any) {
      errors.push({ keyword: kw.keyword_text, error: error.message });
    }
  }

  logger.info('Bulk keywords created', { 
    projectId: project_id,
    created: results.length,
    errors: errors.length
  });

  res.status(201).json({ 
    keywords: results,
    errors: errors.length > 0 ? errors : undefined
  });
}));

// Update keyword
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { keyword_text, category, priority_level, search_volume, difficulty, funnel_stage, is_active } = req.body;
  const organizationId = req.user?.organizationId;

  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (keyword_text !== undefined) {
    updates.push(`keyword_text = $${paramIndex++}`);
    values.push(keyword_text);
  }
  if (category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(category);
  }
  if (priority_level !== undefined) {
    updates.push(`priority_level = $${paramIndex++}`);
    values.push(priority_level);
  }
  if (search_volume !== undefined) {
    updates.push(`search_volume = $${paramIndex++}`);
    values.push(search_volume);
  }
  if (difficulty !== undefined) {
    updates.push(`difficulty = $${paramIndex++}`);
    values.push(difficulty);
  }
  if (funnel_stage !== undefined) {
    updates.push(`funnel_stage = $${paramIndex++}`);
    values.push(funnel_stage);
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
    UPDATE keywords k
    SET ${updates.join(', ')}
    FROM projects p
    WHERE k.id = $${paramIndex++} 
    AND k.project_id = p.id 
    AND p.organization_id = $${paramIndex}
    RETURNING k.*
  `, values);

  if (result.rows.length === 0) {
    throw createError('Keyword not found', 404);
  }

  res.json({ keyword: result.rows[0] });
}));

// Delete keyword
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    DELETE FROM keywords k
    USING projects p
    WHERE k.id = $1 
    AND k.project_id = p.id 
    AND p.organization_id = $2
    RETURNING k.id
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Keyword not found', 404);
  }

  logger.info('Keyword deleted', { keywordId: id });

  res.json({ message: 'Keyword deleted successfully' });
}));

// Get keyword citation history
router.get('/:id/history', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { days = 30 } = req.query;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT c.*
    FROM citations c
    JOIN keywords k ON c.keyword_id = k.id
    JOIN projects p ON k.project_id = p.id
    WHERE c.keyword_id = $1 
    AND p.organization_id = $2
    AND c.tracked_at >= NOW() - INTERVAL '${days} days'
    ORDER BY c.tracked_at DESC
  `, [id, organizationId]);

  res.json({ citations: result.rows });
}));

export default router;
