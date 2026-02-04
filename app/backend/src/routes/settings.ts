/**
 * Settings API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get organization settings
router.get('/organization', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT id, name, slug, settings, created_at
    FROM organizations
    WHERE id = $1
  `, [organizationId]);

  if (result.rows.length === 0) {
    throw createError('Organization not found', 404);
  }

  res.json({ organization: result.rows[0] });
}));

// Update organization settings
router.patch('/organization', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    throw createError('Settings object is required', 400);
  }

  const result = await pool.query(`
    UPDATE organizations
    SET settings = settings || $1::jsonb,
        updated_at = NOW()
    WHERE id = $2
    RETURNING settings
  `, [JSON.stringify(settings), organizationId]);

  if (result.rows.length === 0) {
    throw createError('Organization not found', 404);
  }

  logger.info('Organization settings updated', { organizationId });

  res.json({ settings: result.rows[0].settings });
}));

// Get API integrations
router.get('/api-integrations', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT 
      id,
      gemini_rate_limit,
      serp_rate_limit,
      openai_rate_limit,
      monthly_requests,
      last_used_at,
      updated_at
    FROM api_integrations
    WHERE organization_id = $1
  `, [organizationId]);

  // Mask API keys - only show if configured
  const maskedResult = await pool.query(`
    SELECT 
      CASE WHEN gemini_api_key IS NOT NULL THEN true ELSE false END as gemini_configured,
      CASE WHEN serp_api_key IS NOT NULL THEN true ELSE false END as serp_configured,
      CASE WHEN openai_api_key IS NOT NULL THEN true ELSE false END as openai_configured,
      CASE WHEN perplexity_api_key IS NOT NULL THEN true ELSE false END as perplexity_configured
    FROM api_integrations
    WHERE organization_id = $1
  `, [organizationId]);

  res.json({
    integrations: result.rows[0] || null,
    configured: maskedResult.rows[0] || {
      gemini_configured: false,
      serp_configured: false,
      openai_configured: false,
      perplexity_configured: false
    }
  });
}));

// Update API integrations
router.patch('/api-integrations', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const { 
    gemini_api_key, 
    serp_api_key, 
    openai_api_key, 
    perplexity_api_key,
    gemini_rate_limit,
    serp_rate_limit,
    openai_rate_limit
  } = req.body;

  // Build update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (gemini_api_key !== undefined) {
    updates.push(`gemini_api_key = $${paramIndex++}`);
    values.push(gemini_api_key || null);
  }
  if (serp_api_key !== undefined) {
    updates.push(`serp_api_key = $${paramIndex++}`);
    values.push(serp_api_key || null);
  }
  if (openai_api_key !== undefined) {
    updates.push(`openai_api_key = $${paramIndex++}`);
    values.push(openai_api_key || null);
  }
  if (perplexity_api_key !== undefined) {
    updates.push(`perplexity_api_key = $${paramIndex++}`);
    values.push(perplexity_api_key || null);
  }
  if (gemini_rate_limit !== undefined) {
    updates.push(`gemini_rate_limit = $${paramIndex++}`);
    values.push(gemini_rate_limit);
  }
  if (serp_rate_limit !== undefined) {
    updates.push(`serp_rate_limit = $${paramIndex++}`);
    values.push(serp_rate_limit);
  }
  if (openai_rate_limit !== undefined) {
    updates.push(`openai_rate_limit = $${paramIndex++}`);
    values.push(openai_rate_limit);
  }

  if (updates.length === 0) {
    throw createError('No fields to update', 400);
  }

  updates.push(`updated_at = NOW()`);
  values.push(organizationId);

  const result = await pool.query(`
    INSERT INTO api_integrations (organization_id, gemini_api_key, serp_api_key, openai_api_key, perplexity_api_key)
    VALUES ($1, NULL, NULL, NULL, NULL)
    ON CONFLICT (organization_id) DO UPDATE SET
      ${updates.join(', ')}
    RETURNING id
  `, [organizationId, ...values.slice(0, -1)]);

  logger.info('API integrations updated', { organizationId });

  res.json({ message: 'API integrations updated successfully' });
}));

// Get tracking settings
router.get('/tracking', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT settings->'tracking_interval_hours' as tracking_interval_hours,
           settings->'max_keywords' as max_keywords,
           settings->'max_competitors' as max_competitors
    FROM organizations
    WHERE id = $1
  `, [organizationId]);

  res.json({
    trackingSettings: {
      trackingIntervalHours: result.rows[0]?.tracking_interval_hours || 24,
      maxKeywords: result.rows[0]?.max_keywords || 1000,
      maxCompetitors: result.rows[0]?.max_competitors || 10
    }
  });
}));

// Update tracking settings
router.patch('/tracking', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const { tracking_interval_hours, max_keywords, max_competitors } = req.body;

  const settings: any = {};
  if (tracking_interval_hours !== undefined) settings.tracking_interval_hours = tracking_interval_hours;
  if (max_keywords !== undefined) settings.max_keywords = max_keywords;
  if (max_competitors !== undefined) settings.max_competitors = max_competitors;

  const result = await pool.query(`
    UPDATE organizations
    SET settings = settings || $1::jsonb,
        updated_at = NOW()
    WHERE id = $2
    RETURNING settings
  `, [JSON.stringify(settings), organizationId]);

  if (result.rows.length === 0) {
    throw createError('Organization not found', 404);
  }

  logger.info('Tracking settings updated', { organizationId, settings });

  res.json({ settings: result.rows[0].settings });
}));

// Get notification settings
router.get('/notifications', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT settings->'alert_email_enabled' as alert_email_enabled,
           settings->'alert_webhook_url' as alert_webhook_url
    FROM organizations
    WHERE id = $1
  `, [organizationId]);

  res.json({
    notifications: {
      emailEnabled: result.rows[0]?.alert_email_enabled ?? true,
      webhookUrl: result.rows[0]?.alert_webhook_url || null
    }
  });
}));

// Update notification settings
router.patch('/notifications', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const { alert_email_enabled, alert_webhook_url } = req.body;

  const settings: any = {};
  if (alert_email_enabled !== undefined) settings.alert_email_enabled = alert_email_enabled;
  if (alert_webhook_url !== undefined) settings.alert_webhook_url = alert_webhook_url;

  const result = await pool.query(`
    UPDATE organizations
    SET settings = settings || $1::jsonb,
        updated_at = NOW()
    WHERE id = $2
    RETURNING settings
  `, [JSON.stringify(settings), organizationId]);

  if (result.rows.length === 0) {
    throw createError('Organization not found', 404);
  }

  logger.info('Notification settings updated', { organizationId });

  res.json({ settings: result.rows[0].settings });
}));

// Test API connection
router.post('/test-api', asyncHandler(async (req, res) => {
  const { api_type, api_key } = req.body;

  if (!api_type || !api_key) {
    throw createError('API type and key are required', 400);
  }

  let testResult: { success: boolean; message: string };

  try {
    switch (api_type) {
      case 'gemini':
        testResult = await testGeminiApi(api_key);
        break;
      case 'serp':
        testResult = await testSerpApi(api_key);
        break;
      case 'openai':
        testResult = await testOpenAIApi(api_key);
        break;
      case 'perplexity':
        testResult = await testPerplexityApi(api_key);
        break;
      default:
        throw createError('Invalid API type', 400);
    }

    res.json(testResult);

  } catch (error) {
    res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Test failed'
    });
  }
}));

// API test functions
async function testGeminiApi(apiKey: string): Promise<{ success: boolean; message: string }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const result = await model.generateContent('Hello');
  
  return {
    success: true,
    message: 'Gemini API connection successful'
  };
}

async function testSerpApi(apiKey: string): Promise<{ success: boolean; message: string }> {
  const { getJson } = await import('serpapi');
  
  await getJson({
    q: 'test',
    api_key: apiKey,
    engine: 'google'
  });
  
  return {
    success: true,
    message: 'SERP API connection successful'
  };
}

async function testOpenAIApi(apiKey: string): Promise<{ success: boolean; message: string }> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  
  await client.models.list();
  
  return {
    success: true,
    message: 'OpenAI API connection successful'
  };
}

async function testPerplexityApi(apiKey: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }
  
  return {
    success: true,
    message: 'Perplexity API connection successful'
  };
}

export default router;
