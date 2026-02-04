/**
 * AI Rank Tracker - Main API Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import routes
import projectsRouter from './routes/projects';
import keywordsRouter from './routes/keywords';
import citationsRouter from './routes/citations';
import dashboardRouter from './routes/dashboard';
import trackingRouter from './routes/tracking';
import alertsRouter from './routes/alerts';
import competitorsRouter from './routes/competitors';
import settingsRouter from './routes/settings';

// Import services
import { initGeminiService } from './services/gemini';
import { initSerpApiService } from './services/serpapi';
import { initPerplexityService } from './services/perplexity';
import { initOpenAIService } from './services/openai';
import { initTrackingEngine } from './services/trackingEngine';
import { initScoringService } from './services/scoring';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ai_rank_tracker',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize AI platform services
    if (process.env.GEMINI_API_KEY) {
      initGeminiService({ apiKey: process.env.GEMINI_API_KEY });
      logger.info('Gemini service initialized');
    }

    if (process.env.SERP_API_KEY) {
      initSerpApiService({ apiKey: process.env.SERP_API_KEY });
      logger.info('SerpAPI service initialized');
    }

    if (process.env.PERPLEXITY_API_KEY) {
      initPerplexityService({ apiKey: process.env.PERPLEXITY_API_KEY });
      logger.info('Perplexity service initialized');
    }

    if (process.env.OPENAI_API_KEY) {
      initOpenAIService({ apiKey: process.env.OPENAI_API_KEY });
      logger.info('OpenAI service initialized');
    }

    // Initialize core services
    initTrackingEngine({ 
      db: pool,
      geminiApiKey: process.env.GEMINI_API_KEY,
      serpApiKey: process.env.SERP_API_KEY,
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY
    });
    logger.info('Tracking engine initialized');

    initScoringService({ db: pool });
    logger.info('Scoring service initialized');

  } catch (error) {
    logger.error('Failed to initialize services', { error });
    process.exit(1);
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/keywords', authMiddleware, keywordsRouter);
app.use('/api/citations', authMiddleware, citationsRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/tracking', authMiddleware, trackingRouter);
app.use('/api/alerts', authMiddleware, alertsRouter);
app.use('/api/competitors', authMiddleware, competitorsRouter);
app.use('/api/settings', authMiddleware, settingsRouter);

// Public routes (no auth required)
app.use('/api/public', require('./routes/public'));

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    logger.info(`AI Rank Tracker API server running on port ${PORT}`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

export { pool };
