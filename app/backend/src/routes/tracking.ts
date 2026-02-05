/**
 * Tracking API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getTrackingEngine } from '../services/trackingEngine';
import { getScoringService } from '../services/scoring';
import { AIPlatform } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// Start tracking for a keyword
router.post('/keyword/:keywordId', asyncHandler(async (req, res) => {
  const { keywordId } = req.params;
  const { platforms } = req.body;
  const organizationId = req.user?.organizationId;

  // Get keyword and project
  const keywordResult = await pool.query(`
    SELECT k.*, p.*, p.id as project_id
    FROM keywords k
    JOIN projects p ON k.project_id = p.id
    WHERE k.id = $1 AND p.organization_id = $2
  `, [keywordId, organizationId]);

  if (keywordResult.rows.length === 0) {
    throw createError('Keyword not found', 404);
  }

  const row = keywordResult.rows[0];
  const keyword = {
    id: row.keyword_id,
    project_id: row.project_id,
    keyword_text: row.keyword_text,
    category: row.category,
    priority_level: row.priority_level,
    funnel_stage: row.funnel_stage,
    is_active: row.is_active
  };
  const project = {
    id: row.project_id,
    organization_id: row.organization_id,
    name: row.name,
    primary_domain: row.primary_domain,
    competitor_domains: row.competitor_domains
  };

  // Start tracking
  const trackingEngine = getTrackingEngine();
  const platformList = platforms || Object.values(AIPlatform);
  
  const results = await trackingEngine.trackKeyword(keyword, project, platformList);

  res.json({
    keyword: keyword.keyword_text,
    results: results.map(r => ({
      platform: r.platform,
      success: r.success,
      citationFound: !!r.citation?.domain_mentioned,
      position: r.citation?.citation_position,
      responseTimeMs: r.responseTimeMs,
      error: r.error
    }))
  });
}));

// Start tracking for entire project
router.post('/project/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { platforms, keywordFilter } = req.body;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  // Start tracking
  const trackingEngine = getTrackingEngine();
  
  // Run tracking asynchronously
  const trackingPromise = trackingEngine.trackProject(projectId, {
    platforms,
    keywordFilter
  });

  // Return immediately with job status
  res.json({
    message: 'Tracking started',
    projectId,
    status: 'processing'
  });

  // Continue tracking in background
  trackingPromise.then(result => {
    logger.info('Project tracking completed', { 
      projectId, 
      result 
    });
    
    // Calculate scores after tracking
    const scoringService = getScoringService();
    scoringService.calculateVisibilityScore(projectId).catch(error => {
      logger.error('Failed to calculate visibility score', { error, projectId });
    });

  }).catch(error => {
    logger.error('Project tracking failed', { error, projectId });
  });
}));

// Get tracking status
router.get('/status/:projectId', asyncHandler(async (req, res) => {
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

  const trackingEngine = getTrackingEngine();
  const status = await trackingEngine.getProjectTrackingStatus(projectId);

  // Get recent tracking jobs
  const jobsResult = await pool.query(`
    SELECT 
      platform,
      status,
      COUNT(*) as count,
      MAX(created_at) as last_job
    FROM tracking_jobs
    WHERE project_id = $1
    AND created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY platform, status
  `, [projectId]);

  res.json({
    ...status,
    recentJobs: jobsResult.rows
  });
}));

// Get tracking queue status
router.get('/queue', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT 
      tj.*,
      k.keyword_text,
      p.name as project_name
    FROM tracking_jobs tj
    JOIN keywords k ON tj.keyword_id = k.id
    JOIN projects p ON tj.project_id = p.id
    WHERE p.organization_id = $1
    AND tj.status IN ('pending', 'processing', 'retrying')
    ORDER BY tj.scheduled_at ASC
    LIMIT 50
  `, [organizationId]);

  res.json({ jobs: result.rows });
}));

// Schedule tracking job
router.post('/schedule', asyncHandler(async (req, res) => {
  const { project_id, keyword_ids, platforms, scheduled_at } = req.body;
  const organizationId = req.user?.organizationId;

  // Verify project belongs to organization
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [project_id, organizationId]
  );

  if (projectCheck.rows.length === 0) {
    throw createError('Project not found', 404);
  }

  // Get keywords
  const keywordsQuery = keyword_ids?.length
    ? 'SELECT id FROM keywords WHERE project_id = $1 AND id = ANY($2)'
    : 'SELECT id FROM keywords WHERE project_id = $1 AND is_active = true';
  
  const keywordsParams = keyword_ids?.length 
    ? [project_id, keyword_ids]
    : [project_id];

  const keywordsResult = await pool.query(keywordsQuery, keywordsParams);

  // Create tracking jobs
  const platformList = platforms || Object.values(AIPlatform);
  const scheduledTime = scheduled_at || new Date().toISOString();

  const jobs = [];
  for (const keyword of keywordsResult.rows) {
    for (const platform of platformList) {
      const jobResult = await pool.query(`
        INSERT INTO tracking_jobs (project_id, keyword_id, platform, scheduled_at, status)
        VALUES ($1, $2, $3, $4, 'pending')
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [project_id, keyword.id, platform, scheduledTime]);

      if (jobResult.rows.length > 0) {
        jobs.push(jobResult.rows[0]);
      }
    }

  res.status(201).json({
    message: 'Tracking jobs scheduled',
    jobsScheduled: jobs.length
  });
});

// Quick track (test tracking without storing)
router.post('/quick-test', asyncHandler(async (req, res) => {
  const { keyword, platforms, domain } = req.body;

  if (!keyword) {
    throw createError('Keyword is required', 400);
  }

  const trackingEngine = getTrackingEngine();
  const platformList = platforms || [AIPlatform.GEMINI, AIPlatform.GOOGLE_AI_OVERVIEW];

  // Create mock keyword and project
  const mockKeyword = {
    id: 'test',
    project_id: 'test',
    keyword_text: keyword,
    is_active: true
  };
  const mockProject = {
    id: 'test',
    organization_id: 'test',
    name: 'Test',
    primary_domain: domain || 'example.com',
    competitor_domains: []
  };

  const results = await trackingEngine.trackKeyword(mockKeyword, mockProject, platformList);

  // Don't store test results
  await pool.query('DELETE FROM citations WHERE keyword_id = $1', ['test']);

  res.json({
    keyword,
    results: results.map(r => ({
      platform: r.platform,
      success: r.success,
      citations: r.citation?.total_sources_cited || 0,
      domainMentioned: r.citation?.domain_mentioned,
      position: r.citation?.citation_position,
      responseTimeMs: r.responseTimeMs,
      error: r.error
    }))
  });
}));

export default router;
