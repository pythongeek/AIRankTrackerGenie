# AI Rank Tracker - Deployment Guide

This guide covers deploying the AI Rank Tracker application to various platforms.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Vercel Deployment (Frontend)](#vercel-deployment-frontend)
5. [Railway/Render Deployment (Backend)](#railwayrender-deployment-backend)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Environment Variables](#environment-variables)
8. [Post-Deployment Setup](#post-deployment-setup)

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for containerized deployment)
- Git
- API keys for at least one AI platform (Gemini, SerpAPI, Perplexity, or OpenAI)

## Local Development

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ai-rank-tracker
```

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Configure Environment Variables

```bash
cp docker/.env.example docker/.env
```

Edit `docker/.env` with your API keys and configuration.

### 4. Start with Docker Compose

```bash
cd docker
docker-compose up -d
```

### 5. Initialize Database

```bash
docker-compose exec db psql -U postgres -d ai_rank_tracker -f /docker-entrypoint-initdb.d/init.sql
```

### 6. Access the Application

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Health Check: http://localhost:3000/health

## Docker Deployment

### Production Docker Compose

```bash
cd docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

This configuration:
- Runs services with restart policies
- Includes Nginx reverse proxy
- Optimizes resource limits
- Enables production logging

### Building Custom Images

```bash
# Build backend image
cd backend
docker build -t ai-rank-tracker-backend .

# Build frontend image
cd ../frontend
docker build -t ai-rank-tracker-frontend .
```

## Vercel Deployment (Frontend)

### 1. Prepare for Deployment

```bash
# Build the frontend
cd frontend
npm run build
```

### 2. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: GitHub Integration

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure build settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables in Vercel dashboard
5. Deploy

### 3. Configure Environment Variables

In Vercel dashboard, add:

```
VITE_API_URL=https://your-api-domain.com
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Railway/Render Deployment (Backend)

### Railway Deployment

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)

2. **Create New Project**
   - Connect your GitHub repository
   - Select the backend directory

3. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"

4. **Add Redis**
   - Click "New" → "Database" → "Add Redis"

5. **Configure Environment Variables**
   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   JWT_SECRET=your-jwt-secret
   GEMINI_API_KEY=your-gemini-key
   SERP_API_KEY=your-serpapi-key
   ```

6. **Deploy**
   - Railway will automatically deploy on push

### Render Deployment

1. **Create Render Account**
   - Sign up at [render.com](https://render.com)

2. **Create Web Service**
   - Connect your GitHub repository
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

3. **Create PostgreSQL Database**
   - New → PostgreSQL
   - Note the connection string

4. **Create Redis Instance**
   - New → Redis
   - Note the connection string

5. **Add Environment Variables**
   Add all required variables in the Render dashboard

6. **Deploy**
   - Render will automatically deploy

## Kubernetes Deployment

### 1. Build and Push Images

```bash
# Build images
docker build -t your-registry/ai-rank-tracker-backend:latest ./backend
docker build -t your-registry/ai-rank-tracker-frontend:latest ./frontend

# Push to registry
docker push your-registry/ai-rank-tracker-backend:latest
docker push your-registry/ai-rank-tracker-frontend:latest
```

### 2. Create Kubernetes Manifests

Create `k8s/` directory with deployment files:

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-rank-tracker
```

```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: ai-rank-tracker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        ports:
        - containerPort: 5432
```

```yaml
# k8s/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: ai-rank-tracker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/ai-rank-tracker-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
```

### 3. Deploy to Kubernetes

```bash
kubectl apply -f k8s/
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `JWT_SECRET` | Secret for JWT signing | `min-32-char-secret-key` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |

### AI Platform API Keys (at least one recommended)

| Variable | Description | Free Tier |
|----------|-------------|-----------|
| `GEMINI_API_KEY` | Google Gemini API | 60 requests/min |
| `SERP_API_KEY` | SerpAPI key | 100 searches/month |
| `PERPLEXITY_API_KEY` | Perplexity API | Varies |
| `OPENAI_API_KEY` | OpenAI API | Pay per use |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging level | `info` |
| `PORT` | API server port | `3000` |
| `TRACKING_INTERVAL_HOURS` | Auto-tracking interval | `24` |

## Post-Deployment Setup

### 1. Initialize Database

```bash
# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 2. Create Admin User

Use Supabase dashboard or API to create the first user:

```bash
curl -X POST https://your-supabase-url.supabase.co/auth/v1/signup \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure-password"
  }'
```

### 3. Configure API Keys

1. Log in to the application
2. Go to Settings → API Integrations
3. Add your API keys for each platform
4. Test connections

### 4. Create First Project

1. Go to Projects page
2. Click "New Project"
3. Enter project details:
   - Name: Your brand name
   - Primary Domain: Your website domain
   - Competitor Domains: Competitors to track
4. Save

### 5. Add Keywords

1. Go to Keywords page
2. Click "Add Keyword"
3. Enter keywords to track
4. Set priority and funnel stage

### 6. Start Tracking

1. Go to Tracking page
2. Select your project
3. Click "Track Project" or use Quick Test
4. Monitor results in Dashboard

## Monitoring & Maintenance

### Health Checks

- API Health: `GET /health`
- Database: Check PostgreSQL logs
- Redis: `redis-cli ping`

### Logs

```bash
# Docker logs
docker-compose logs -f api
docker-compose logs -f worker

# Kubernetes logs
kubectl logs -f deployment/backend -n ai-rank-tracker
```

### Backup Database

```bash
# PostgreSQL backup
docker-compose exec db pg_dump -U postgres ai_rank_tracker > backup.sql

# Restore
docker-compose exec -T db psql -U postgres ai_rank_tracker < backup.sql
```

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs db
```

**API rate limits exceeded**
- Check your API key quotas
- Adjust rate limits in settings
- Consider upgrading your API plan

**Frontend can't connect to API**
- Check `VITE_API_URL` environment variable
- Ensure CORS is configured correctly
- Check network connectivity

**Tracking jobs failing**
```bash
# Check worker logs
docker-compose logs worker

# Restart worker
docker-compose restart worker
```

## Security Considerations

1. **Use HTTPS in production**
2. **Keep API keys secure** - never commit to git
3. **Enable authentication** - Supabase Auth
4. **Set up firewall rules**
5. **Regular security updates**
6. **Monitor for suspicious activity**

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
  worker:
    deploy:
      replicas: 2
```

### Database Scaling

- Use connection pooling (PgBouncer)
- Consider read replicas
- Monitor query performance

### Caching

- Redis for session storage
- Cache frequently accessed data
- Use CDN for static assets

## Support

For deployment issues:
- Check logs: `docker-compose logs`
- Review documentation
- Open an issue on GitHub

## License

MIT License - see LICENSE file for details
