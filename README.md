# AI Rank Tracker

A comprehensive, production-ready AI rank tracking and brand citation monitoring system that tracks your brand's visibility across Google AI Overviews, Gemini, ChatGPT, Perplexity, Microsoft Copilot, and other AI platforms.

## Features

### Core Tracking
- **Multi-Platform Monitoring**: Track citations across Google AI Overviews, Gemini, ChatGPT, Perplexity, Copilot, Claude, Grok, and DeepSeek
- **Real-time Tracking**: Automated tracking with configurable intervals
- **Citation Detection**: Advanced algorithms to detect brand mentions and URL citations
- **Position Tracking**: Monitor your ranking position in AI responses

### Analytics & Scoring
- **Visibility Score**: Composite scoring based on frequency, position, diversity, context, and momentum
- **Share of Voice**: Compare your citations vs competitors
- **Trend Analysis**: Track performance over time with detailed metrics
- **Sentiment Analysis**: Understand how your brand is portrayed

### Competitive Intelligence
- **Competitor Tracking**: Monitor competitor domains alongside your own
- **Gap Analysis**: Identify keywords where competitors rank but you don't
- **Content Comparison**: Analyze what content wins citations

### Alerts & Notifications
- **Real-time Alerts**: Get notified of new citations, lost citations, position changes
- **Competitive Alerts**: Track when competitors gain citations
- **Customizable Thresholds**: Set alert sensitivity per project

### Content Optimization
- **GEO Recommendations**: Get AI-powered suggestions to improve citation likelihood
- **Content Scoring**: Evaluate pages for AI-friendliness
- **Structured Data Analysis**: Check schema markup completeness

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│                  Port: 5173 (dev) / 3000 (prod)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                    │
│                    Port: 3000                               │
├─────────────────────────────────────────────────────────────┤
│  Routes: /api/projects, /api/keywords, /api/citations,      │
│          /api/tracking, /api/dashboard, /api/alerts         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│   PostgreSQL    │  │    Redis     │  │  AI Services │
│   (Supabase)    │  │   (BullMQ)   │  │  - Gemini    │
│   Port: 5432    │  │  Port: 6379  │  │  - SerpAPI   │
└─────────────────┘  └──────────────┘  │  - Perplexity│
                                       │  - OpenAI    │
                                       └──────────────┘
```

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- React Query (data fetching)
- Recharts (visualizations)

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL (via Supabase)
- Redis (BullMQ for job queue)
- Winston (logging)

### AI Platform APIs
- Google Gemini API
- SerpAPI (Google AI Overview)
- Perplexity API
- OpenAI API

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- API keys for Gemini, SerpAPI, Perplexity, OpenAI (optional)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ai-rank-tracker
```

### 2. Configure Environment

```bash
cp docker/.env.example docker/.env
```

Edit `docker/.env` with your API keys:
```env
# Required
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-min-32-chars

# AI Platform APIs (at least one recommended)
GEMINI_API_KEY=your-gemini-api-key
SERP_API_KEY=your-serpapi-key
PERPLEXITY_API_KEY=your-perplexity-key
OPENAI_API_KEY=your-openai-key
```

### 3. Start with Docker Compose

```bash
cd docker
docker-compose up -d
```

This starts:
- PostgreSQL database (port 5432)
- Supabase Auth (port 9999)
- PostgREST API (port 3001)
- Redis (port 6379)
- Backend API (port 3000)
- Frontend dev server (port 5173)

### 4. Initialize Database

```bash
docker-compose exec api npm run db:migrate
```

### 5. Access the Application

- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Docs: http://localhost:3000/health

## Development

### Local Development (without Docker)

1. **Start PostgreSQL and Redis**
```bash
# Using Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
docker run -d -p 6379:6379 redis:7-alpine
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. **Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```

### API Keys Setup

#### Gemini API
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `.env`: `GEMINI_API_KEY=your-key`

#### SerpAPI
1. Sign up at [SerpApi](https://serpapi.com/)
2. Get your API key from dashboard
3. Add to `.env`: `SERP_API_KEY=your-key`
- Free tier: 100 searches/month
- Paid plans available

#### Perplexity API
1. Get API key from [Perplexity](https://www.perplexity.ai/settings/api)
2. Add to `.env`: `PERPLEXITY_API_KEY=your-key`

#### OpenAI API (optional)
1. Get API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add to `.env`: `OPENAI_API_KEY=your-key`

## Deployment

### Vercel (Frontend)

1. **Build Frontend**
```bash
cd frontend
npm run build
```

2. **Deploy to Vercel**
```bash
vercel --prod
```

Or connect your GitHub repo to Vercel for auto-deployment.

### Railway/Render (Backend)

1. **Push to GitHub**
```bash
git add .
git commit -m "Production build"
git push origin main
```

2. **Create New Project on Railway/Render**
- Connect your GitHub repository
- Set environment variables from `.env`
- Deploy

### Docker Production

```bash
cd docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## API Documentation

### Authentication
All API endpoints (except `/health` and `/public/*`) require a Bearer token:
```
Authorization: Bearer <supabase-jwt-token>
```

### Core Endpoints

#### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

#### Keywords
- `GET /api/keywords?project_id=:id` - List keywords
- `POST /api/keywords` - Add keyword
- `POST /api/keywords/bulk` - Bulk add keywords
- `DELETE /api/keywords/:id` - Remove keyword

#### Tracking
- `POST /api/tracking/keyword/:id` - Track single keyword
- `POST /api/tracking/project/:id` - Track entire project
- `GET /api/tracking/status/:id` - Get tracking status
- `POST /api/tracking/quick-test` - Test tracking (no storage)

#### Dashboard
- `GET /api/dashboard/:projectId` - Get dashboard data
- `GET /api/dashboard/:projectId/scores` - Visibility score history
- `GET /api/dashboard/:projectId/metrics` - Daily metrics

#### Citations
- `GET /api/citations?project_id=:id` - List citations
- `GET /api/citations/stats/overview` - Citation statistics
- `GET /api/citations/stats/top-keywords` - Top cited keywords

#### Alerts
- `GET /api/alerts` - List alerts
- `GET /api/alerts/unread-count` - Unread alert count
- `PATCH /api/alerts/:id/read` - Mark as read

## Scoring Algorithm

The visibility score is calculated using a weighted composite:

```
Overall Score = 
  (Frequency Score × 0.40) +
  (Position Score × 0.30) +
  (Diversity Score × 0.15) +
  (Context Score × 0.10) +
  (Momentum Score × 0.05)
```

### Component Breakdown

**Frequency Score (40%)**
- Measures how often your domain is cited
- Based on citations per keyword tracked
- Scale: 0-100

**Position Score (30%)**
- Average citation position (1st, 2nd, 3rd, etc.)
- Lower position = higher score
- Scale: 0-100

**Diversity Score (15%)**
- Percentage of platforms where you're cited
- More platforms = higher score
- Scale: 0-100

**Context Score (10%)**
- Sentiment analysis of citations
- Positive mentions increase score
- Scale: 0-100

**Momentum Score (5%)**
- Week-over-week growth rate
- Growing citations = higher score
- Scale: 0-100

### Grade Scale
- A+ (90-100): Excellent visibility
- A (80-89): Strong visibility
- B (70-79): Good visibility
- C (60-69): Moderate visibility
- D (50-59): Low visibility
- F (<50): Poor visibility

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `GEMINI_API_KEY` | Recommended | Google Gemini API key |
| `SERP_API_KEY` | Recommended | SerpAPI key |
| `PERPLEXITY_API_KEY` | Optional | Perplexity API key |
| `OPENAI_API_KEY` | Optional | OpenAI API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |

### Organization Settings

Configure via `/api/settings/organization`:

```json
{
  "max_keywords": 1000,
  "max_competitors": 10,
  "tracking_interval_hours": 24,
  "alert_email_enabled": true
}
```

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs db
```

**API rate limits exceeded**
- Check your API key quotas
- Adjust rate limits in settings
- Consider upgrading your API plan

**Tracking jobs failing**
```bash
# Check worker logs
docker-compose logs worker

# Restart worker
docker-compose restart worker
```

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs.airanktracker.com](https://docs.airanktracker.com)
- Issues: [GitHub Issues](https://github.com/yourorg/ai-rank-tracker/issues)
- Email: support@airanktracker.com

## Roadmap

- [ ] Claude API integration
- [ ] Grok API integration
- [ ] DeepSeek API integration
- [ ] Advanced content analysis
- [ ] Machine learning predictions
- [ ] White-label options
- [ ] API webhooks
- [ ] Slack/Teams integrations
