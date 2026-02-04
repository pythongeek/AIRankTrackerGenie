/**
 * Alerts API Routes
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get alerts for organization
router.get('/', asyncHandler(async (req, res) => {
  const { 
    project_id, 
    is_read, 
    severity, 
    alert_type,
    limit = 50,
    offset = 0
  } = req.query;
  
  const organizationId = req.user?.organizationId;

  let query = `
    SELECT a.*, k.keyword_text, p.name as project_name
    FROM alerts a
    LEFT JOIN keywords k ON a.keyword_id = k.id
    JOIN projects p ON a.project_id = p.id
    WHERE a.organization_id = $1
  `;
  const params: any[] = [organizationId];
  let paramIndex = 2;

  if (project_id) {
    query += ` AND a.project_id = $${paramIndex++}`;
    params.push(project_id);
  }

  if (is_read !== undefined) {
    query += ` AND a.is_read = $${paramIndex++}`;
    params.push(is_read === 'true');
  }

  if (severity) {
    query += ` AND a.severity = $${paramIndex++}`;
    params.push(severity);
  }

  if (alert_type) {
    query += ` AND a.alert_type = $${paramIndex++}`;
    params.push(alert_type);
  }

  // Get total count
  const countResult = await pool.query(
    query.replace('SELECT a.*, k.keyword_text, p.name as project_name', 'SELECT COUNT(*)'),
    params
  );
  const totalCount = parseInt(countResult.rows[0].count);

  // Add pagination
  query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  res.json({
    alerts: result.rows,
    pagination: {
      total: totalCount,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
    }
  });
}));

// Get unread alert count
router.get('/unread-count', asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_unread,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical_unread,
      COUNT(*) FILTER (WHERE severity = 'warning') as warning_unread
    FROM alerts
    WHERE organization_id = $1
    AND is_read = false
  `, [organizationId]);

  res.json({
    unreadCount: parseInt(result.rows[0].total_unread),
    criticalUnread: parseInt(result.rows[0].critical_unread),
    warningUnread: parseInt(result.rows[0].warning_unread)
  });
}));

// Get single alert
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    SELECT a.*, k.keyword_text, p.name as project_name
    FROM alerts a
    LEFT JOIN keywords k ON a.keyword_id = k.id
    JOIN projects p ON a.project_id = p.id
    WHERE a.id = $1 AND a.organization_id = $2
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Alert not found', 404);
  }

  res.json({ alert: result.rows[0] });
}));

// Mark alert as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  const result = await pool.query(`
    UPDATE alerts
    SET is_read = true, read_at = NOW(), read_by = $3
    WHERE id = $1 AND organization_id = $2
    RETURNING *
  `, [id, organizationId, userId]);

  if (result.rows.length === 0) {
    throw createError('Alert not found', 404);
  }

  res.json({ alert: result.rows[0] });
}));

// Mark all alerts as read
router.post('/mark-all-read', asyncHandler(async (req, res) => {
  const { project_id } = req.body;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  let query = `
    UPDATE alerts
    SET is_read = true, read_at = NOW(), read_by = $2
    WHERE organization_id = $1 AND is_read = false
  `;
  const params: any[] = [organizationId, userId];

  if (project_id) {
    query += ` AND project_id = $3`;
    params.push(project_id);
  }

  query += ` RETURNING id`;

  const result = await pool.query(query, params);

  logger.info('Alerts marked as read', { 
    count: result.rows.length,
    userId,
    projectId: project_id
  });

  res.json({ 
    message: 'Alerts marked as read',
    count: result.rows.length
  });
}));

// Delete alert
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await pool.query(`
    DELETE FROM alerts
    WHERE id = $1 AND organization_id = $2
    RETURNING id
  `, [id, organizationId]);

  if (result.rows.length === 0) {
    throw createError('Alert not found', 404);
  }

  res.json({ message: 'Alert deleted successfully' });
}));

// Create alert (internal use)
export async function createAlert(data: {
  project_id: string;
  organization_id: string;
  alert_type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  keyword_id?: string;
  keyword_text?: string;
  platform?: string;
  competitor_domain?: string;
  previous_value?: string;
  current_value?: string;
  change_percent?: number;
}): Promise<void> {
  try {
    await pool.query(`
      INSERT INTO alerts (
        project_id, organization_id, alert_type, title, description, severity,
        keyword_id, keyword_text, platform, competitor_domain,
        previous_value, current_value, change_percent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      data.project_id,
      data.organization_id,
      data.alert_type,
      data.title,
      data.description,
      data.severity,
      data.keyword_id,
      data.keyword_text,
      data.platform,
      data.competitor_domain,
      data.previous_value,
      data.current_value,
      data.change_percent
    ]);

    logger.info('Alert created', { 
      alertType: data.alert_type,
      projectId: data.project_id,
      severity: data.severity
    });

  } catch (error) {
    logger.error('Failed to create alert', { error, data });
  }
}

export default router;
