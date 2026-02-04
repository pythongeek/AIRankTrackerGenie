/**
 * Public API Routes (no authentication required)
 */

import { Router } from 'express';
import { pool } from '../index';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Get public stats (for marketing/demo)
router.get('/stats', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT 
      COUNT(DISTINCT p.id) as total_projects,
      COUNT(DISTINCT k.id) as total_keywords,
      COUNT(DISTINCT c.id) FILTER (WHERE c.domain_mentioned = true) as total_citations
    FROM projects p
    LEFT JOIN keywords k ON p.id = k.project_id
    LEFT JOIN citations c ON p.id = c.project_id
  `);

  res.json({
    stats: {
      projects: parseInt(result.rows[0].total_projects),
      keywords: parseInt(result.rows[0].total_keywords),
      citations: parseInt(result.rows[0].total_citations)
    }
  });
}));

// Demo tracking endpoint (limited usage)
router.post('/demo-track', asyncHandler(async (req, res) => {
  const { keyword, domain } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  // Return mock data for demo
  res.json({
    demo: true,
    keyword,
    domain: domain || 'example.com',
    results: [
      {
        platform: 'google_ai_overview',
        cited: Math.random() > 0.5,
        position: Math.floor(Math.random() * 5) + 1,
        sources: [
          { domain: domain || 'example.com', position: 1 },
          { domain: 'competitor1.com', position: 2 },
          { domain: 'competitor2.com', position: 3 }
        ]
      },
      {
        platform: 'gemini',
        cited: Math.random() > 0.6,
        position: Math.floor(Math.random() * 5) + 1
      },
      {
        platform: 'perplexity',
        cited: Math.random() > 0.4,
        position: Math.floor(Math.random() * 5) + 1
      }
    ],
    message: 'This is demo data. Sign up for real tracking.'
  });
}));

export default router;
