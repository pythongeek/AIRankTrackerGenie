/**
 * Background Worker for AI Rank Tracker
 * Processes tracking jobs from the queue
 */

import { Worker, Queue, Job } from 'bullmq';
import { Pool } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';

import { logger } from '../utils/logger';
import { initTrackingEngine, getTrackingEngine } from '../services/trackingEngine';
import { initScoringService, getScoringService } from '../services/scoring';
import { initGeminiService } from '../services/gemini';
import { initSerpApiService } from '../services/serpapi';
import { initPerplexityService } from '../services/perplexity';
import { initOpenAIService } from '../services/openai';
import { createAlert } from '../routes/alerts';
import { AIPlatform, TrackingJob } from '../types';

dotenv.config();

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ai_rank_tracker',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize services
async function initializeServices() {
  if (process.env.GEMINI_API_KEY) {
    initGeminiService({ apiKey: process.env.GEMINI_API_KEY });
  }
  if (process.env.SERP_API_KEY) {
    initSerpApiService({ apiKey: process.env.SERP_API_KEY });
  }
  if (process.env.PERPLEXITY_API_KEY) {
    initPerplexityService({ apiKey: process.env.PERPLEXITY_API_KEY });
  }
  if (process.env.OPENAI_API_KEY) {
    initOpenAIService({ apiKey: process.env.OPENAI_API_KEY });
  }

  initTrackingEngine({
    db: pool,
    geminiApiKey: process.env.GEMINI_API_KEY,
    serpApiKey: process.env.SERP_API_KEY,
    perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY
  });

  initScoringService({ db: pool });

  logger.info('Worker services initialized');
}

// Job processors
interface TrackingJobData {
  jobId: string;
  projectId: string;
  keywordId: string;
  platform: AIPlatform;
}

async function processTrackingJob(job: Job<TrackingJobData>): Promise<void> {
  const { jobId, projectId, keywordId, platform } = job.data;

  logger.info('Processing tracking job', { jobId, keywordId, platform });

  try {
    // Update job status
    await pool.query(`
      UPDATE tracking_jobs
      SET status = 'processing', started_at = NOW()
      WHERE id = $1
    `, [jobId]);

    // Get keyword and project
    const keywordResult = await pool.query(`
      SELECT k.*, p.primary_domain, p.organization_id
      FROM keywords k
      JOIN projects p ON k.project_id = p.id
      WHERE k.id = $1
    `, [keywordId]);

    if (keywordResult.rows.length === 0) {
      throw new Error('Keyword not found');
    }

    const row = keywordResult.rows[0];
    const keyword = {
      id: row.id,
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

    // Track
    const trackingEngine = getTrackingEngine();
    const results = await trackingEngine.trackKeyword(keyword, project, [platform]);
    const result = results[0];

    // Update job status
    await pool.query(`
      UPDATE tracking_jobs
      SET status = 'completed',
          completed_at = NOW(),
          citation_found = $2,
          result_data = $3
      WHERE id = $1
    `, [jobId, result.citation?.domain_mentioned || false, JSON.stringify(result)]);

    // Check for alerts
    await checkForAlerts(projectId, keywordId, keyword.keyword_text, platform, result);

    logger.info('Tracking job completed', { jobId, success: result.success });

  } catch (error) {
    logger.error('Tracking job failed', { jobId, error });

    // Update job status
    await pool.query(`
      UPDATE tracking_jobs
      SET status = 'failed',
          error_message = $2,
          retry_count = retry_count + 1
      WHERE id = $1
    `, [jobId, error instanceof Error ? error.message : 'Unknown error']);

    throw error;
  }
}

async function checkForAlerts(
  projectId: string,
  keywordId: string,
  keywordText: string,
  platform: AIPlatform,
  result: any
): Promise<void> {
  try {
    // Get previous citation for this keyword/platform
    const previousResult = await pool.query(`
      SELECT domain_mentioned, citation_position
      FROM citations
      WHERE keyword_id = $1 AND platform = $2
      ORDER BY tracked_at DESC
      OFFSET 1
      LIMIT 1
    `, [keywordId, platform]);

    const previous = previousResult.rows[0];
    const current = result.citation;

    if (!previous && current?.domain_mentioned) {
      // New citation
      await createAlert({
        project_id: projectId,
        organization_id: '', // Will be filled from project
        alert_type: 'new_citation',
        title: 'New Citation Detected',
        description: `Your domain was cited for "${keywordText}" on ${platform}`,
        severity: 'info',
        keyword_id: keywordId,
        keyword_text: keywordText,
        platform
      });
    } else if (previous?.domain_mentioned && !current?.domain_mentioned) {
      // Lost citation
      await createAlert({
        project_id: projectId,
        organization_id: '',
        alert_type: 'lost_citation',
        title: 'Citation Lost',
        description: `Your domain is no longer cited for "${keywordText}" on ${platform}`,
        severity: 'warning',
        keyword_id: keywordId,
        keyword_text: keywordText,
        platform,
        previous_value: previous.citation_position?.toString()
      });
    } else if (previous?.citation_position && current?.citation_position) {
      const positionChange = previous.citation_position - current.citation_position;
      
      if (Math.abs(positionChange) >= 2) {
        // Significant position change
        await createAlert({
          project_id: projectId,
          organization_id: '',
          alert_type: 'position_change',
          title: positionChange > 0 ? 'Position Improved' : 'Position Declined',
          description: `Your citation position for "${keywordText}" on ${platform} changed from ${previous.citation_position} to ${current.citation_position}`,
          severity: positionChange > 0 ? 'info' : 'warning',
          keyword_id: keywordId,
          keyword_text: keywordText,
          platform,
          previous_value: previous.citation_position.toString(),
          current_value: current.citation_position.toString(),
          change_percent: (positionChange / previous.citation_position) * 100
        });
      }
    }

  } catch (error) {
    logger.error('Error checking for alerts', { error });
  }
}

// Scheduled job: Daily tracking
async function runDailyTracking(): Promise<void> {
  logger.info('Starting daily tracking job');

  try {
    // Get all active projects
    const projectsResult = await pool.query(`
      SELECT id
      FROM projects
      WHERE is_active = true
    `);

    const trackingEngine = getTrackingEngine();
    const scoringService = getScoringService();

    for (const project of projectsResult.rows) {
      try {
        // Track project
        const result = await trackingEngine.trackProject(project.id);
        logger.info('Project tracking completed', { projectId: project.id, result });

        // Calculate visibility score
        await scoringService.calculateVisibilityScore(project.id);

        // Generate daily metrics
        await scoringService.generateDailyMetrics(project.id, new Date());

      } catch (error) {
        logger.error('Failed to track project', { error, projectId: project.id });
      }

      // Delay between projects
      await sleep(5000);
    }

    logger.info('Daily tracking job completed');

  } catch (error) {
    logger.error('Daily tracking job failed', { error });
  }
}

// Scheduled job: Calculate scores
async function runScoreCalculation(): Promise<void> {
  logger.info('Starting score calculation job');

  try {
    const projectsResult = await pool.query(`
      SELECT id FROM projects WHERE is_active = true
    `);

    const scoringService = getScoringService();

    for (const project of projectsResult.rows) {
      try {
        await scoringService.calculateVisibilityScore(project.id);
        logger.info('Score calculated', { projectId: project.id });
      } catch (error) {
        logger.error('Failed to calculate score', { error, projectId: project.id });
      }

      await sleep(1000);
    }

    logger.info('Score calculation job completed');

  } catch (error) {
    logger.error('Score calculation job failed', { error });
  }
}

// Scheduled job: Clean old data
async function runDataCleanup(): Promise<void> {
  logger.info('Starting data cleanup job');

  try {
    // Delete old citations (keep 1 year)
    const citationsResult = await pool.query(`
      DELETE FROM citations
      WHERE tracked_at < NOW() - INTERVAL '1 year'
    `);

    // Delete old alerts (keep 90 days)
    const alertsResult = await pool.query(`
      DELETE FROM alerts
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);

    // Delete old tracking jobs (keep 30 days)
    const jobsResult = await pool.query(`
      DELETE FROM tracking_jobs
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    logger.info('Data cleanup completed', {
      citationsDeleted: citationsResult.rowCount,
      alertsDeleted: alertsResult.rowCount,
      jobsDeleted: jobsResult.rowCount
    });

  } catch (error) {
    logger.error('Data cleanup job failed', { error });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main worker function
async function startWorker(): Promise<void> {
  await initializeServices();

  // Create tracking job queue
  const trackingQueue = new Queue<TrackingJobData>('tracking', {
    connection: redis
  });

  // Create worker
  const worker = new Worker<TrackingJobData>('tracking', processTrackingJob, {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 60,
      duration: 60000 // 60 requests per minute
    }
  });

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', { jobId: job?.id, error });
  });

  // Schedule recurring jobs
  // Daily tracking at 2 AM
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      await runDailyTracking();
    }
  }, 60000); // Check every minute

  // Score calculation every 6 hours
  setInterval(async () => {
    await runScoreCalculation();
  }, 6 * 60 * 60 * 1000);

  // Data cleanup weekly
  setInterval(async () => {
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 3 && now.getMinutes() === 0) {
      await runDataCleanup();
    }
  }, 60000);

  logger.info('Worker started successfully');
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Worker shutting down');
  await redis.disconnect();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Worker shutting down');
  await redis.disconnect();
  await pool.end();
  process.exit(0);
});

// Start worker
startWorker().catch(error => {
  logger.error('Failed to start worker', { error });
  process.exit(1);
});
