/**
 * AI Visibility Scoring Service
 * Calculates composite visibility scores based on citation data
 */

import { Pool } from 'pg';
import { AIPlatform, VisibilityScore, PlatformScore, Citation, DailyMetric } from '../types';
import { logger } from '../utils/logger';

export interface ScoringConfig {
  db: Pool;
}

export class ScoringService {
  private db: Pool;

  constructor(config: ScoringConfig) {
    this.db = config.db;
  }

  /**
   * Calculate visibility score for a project
   */
  async calculateVisibilityScore(projectId: string): Promise<VisibilityScore> {
    // Get citation data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const citationsResult = await this.db.query(`
      SELECT 
        platform,
        COUNT(*) FILTER (WHERE domain_mentioned = true) as citation_count,
        COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_ranked,
        AVG(citation_position) FILTER (WHERE domain_mentioned = true AND citation_position IS NOT NULL) as avg_position,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_mentions,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_mentions
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= $2
      GROUP BY platform
    `, [projectId, thirtyDaysAgo.toISOString()]);

    // Get total keywords
    const keywordsResult = await this.db.query(`
      SELECT COUNT(*) as total
      FROM keywords
      WHERE project_id = $1 AND is_active = true
    `, [projectId]);

    const totalKeywords = parseInt(keywordsResult.rows[0]?.total || '0');

    // Calculate platform scores
    const platformScores: Record<AIPlatform, PlatformScore> = {} as Record<AIPlatform, PlatformScore>;
    
    for (const row of citationsResult.rows) {
      const platform = row.platform as AIPlatform;
      const citationCount = parseInt(row.citation_count);
      const keywordsRanked = parseInt(row.keywords_ranked);
      const avgPosition = parseFloat(row.avg_position) || 99;
      
      // Calculate share of voice for this platform
      const sov = totalKeywords > 0 ? (keywordsRanked / totalKeywords) * 100 : 0;

      platformScores[platform] = {
        score: this.calculatePlatformScore(citationCount, avgPosition, keywordsRanked, totalKeywords),
        citations_count: citationCount,
        keywords_ranked: keywordsRanked,
        avg_position: avgPosition,
        share_of_voice: sov
      };
    }

    // Calculate component scores
    const frequencyScore = this.calculateFrequencyScore(citationsResult.rows, totalKeywords);
    const positionScore = this.calculatePositionScore(citationsResult.rows);
    const diversityScore = this.calculateDiversityScore(citationsResult.rows);
    const contextScore = this.calculateContextScore(citationsResult.rows);
    const momentumScore = await this.calculateMomentumScore(projectId);

    // Calculate overall weighted score
    const overallScore = 
      (frequencyScore * 0.40) +
      (positionScore * 0.30) +
      (diversityScore * 0.15) +
      (contextScore * 0.10) +
      (momentumScore * 0.05);

    const visibilityScore: VisibilityScore = {
      id: '', // Will be set by database
      project_id: projectId,
      calculated_at: new Date().toISOString(),
      platform_scores: platformScores,
      overall_score: Math.round(overallScore * 100) / 100,
      overall_grade: this.assignGrade(overallScore),
      frequency_score: Math.round(frequencyScore * 100) / 100,
      position_score: Math.round(positionScore * 100) / 100,
      diversity_score: Math.round(diversityScore * 100) / 100,
      context_score: Math.round(contextScore * 100) / 100,
      momentum_score: Math.round(momentumScore * 100) / 100,
      week_over_week_change: 0, // Calculated separately
      month_over_month_change: 0 // Calculated separately
    };

    // Store the score
    await this.storeVisibilityScore(visibilityScore);

    return visibilityScore;
  }

  /**
   * Calculate individual platform score
   */
  private calculatePlatformScore(
    citationCount: number,
    avgPosition: number,
    keywordsRanked: number,
    totalKeywords: number
  ): number {
    // Frequency component (0-40)
    const frequencyComponent = Math.min(40, citationCount / 5 * 40);
    
    // Position component (0-35) - lower position = higher score
    const positionComponent = avgPosition <= 5 
      ? (6 - avgPosition) / 5 * 35 
      : 0;
    
    // Coverage component (0-25)
    const coverageComponent = totalKeywords > 0 
      ? (keywordsRanked / totalKeywords) * 25 
      : 0;
    
    return Math.round((frequencyComponent + positionComponent + coverageComponent) * 100) / 100;
  }

  /**
   * Calculate frequency score (40% weight)
   */
  private calculateFrequencyScore(rows: any[], totalKeywords: number): number {
    if (totalKeywords === 0) return 0;
    
    const totalCitations = rows.reduce((sum, row) => 
      sum + parseInt(row.citation_count), 0
    );
    
    // Score based on citations per keyword
    const citationsPerKeyword = totalCitations / totalKeywords;
    return Math.min(100, citationsPerKeyword * 20);
  }

  /**
   * Calculate position score (30% weight)
   */
  private calculatePositionScore(rows: any[]): number {
    if (rows.length === 0) return 0;
    
    const totalCitations = rows.reduce((sum, row) => 
      sum + parseInt(row.citation_count), 0
    );
    
    if (totalCitations === 0) return 0;
    
    // Weighted average position
    const weightedPositionSum = rows.reduce((sum, row) => {
      const citations = parseInt(row.citation_count);
      const position = parseFloat(row.avg_position) || 99;
      return sum + (citations * position);
    }, 0);
    
    const avgPosition = weightedPositionSum / totalCitations;
    
    // Convert to score (position 1 = 100, position 10 = 0)
    return Math.max(0, 100 - ((avgPosition - 1) * 11));
  }

  /**
   * Calculate platform diversity score (15% weight)
   */
  private calculateDiversityScore(rows: any[]): number {
    const platformsWithCitations = rows.filter(r => parseInt(r.citation_count) > 0).length;
    const totalPlatforms = Object.keys(AIPlatform).length;
    
    return (platformsWithCitations / totalPlatforms) * 100;
  }

  /**
   * Calculate context/sentiment score (10% weight)
   */
  private calculateContextScore(rows: any[]): number {
    let totalMentions = 0;
    let positiveMentions = 0;
    
    rows.forEach(row => {
      const positive = parseInt(row.positive_mentions) || 0;
      const negative = parseInt(row.negative_mentions) || 0;
      
      totalMentions += positive + negative;
      positiveMentions += positive;
    });
    
    if (totalMentions === 0) return 50; // Neutral if no sentiment data
    
    return (positiveMentions / totalMentions) * 100;
  }

  /**
   * Calculate momentum score (5% weight)
   * Based on week-over-week growth
   */
  private async calculateMomentumScore(projectId: string): Promise<number> {
    // Get this week's citations
    const thisWeekResult = await this.db.query(`
      SELECT COUNT(*) as count
      FROM citations
      WHERE project_id = $1
      AND domain_mentioned = true
      AND tracked_at >= DATE_TRUNC('week', NOW())
    `, [projectId]);

    // Get last week's citations
    const lastWeekResult = await this.db.query(`
      SELECT COUNT(*) as count
      FROM citations
      WHERE project_id = $1
      AND domain_mentioned = true
      AND tracked_at >= DATE_TRUNC('week', NOW() - INTERVAL '1 week')
      AND tracked_at < DATE_TRUNC('week', NOW())
    `, [projectId]);

    const thisWeek = parseInt(thisWeekResult.rows[0]?.count || '0');
    const lastWeek = parseInt(lastWeekResult.rows[0]?.count || '0');

    if (lastWeek === 0) {
      return thisWeek > 0 ? 100 : 0; // If no citations last week, any new ones = max momentum
    }

    const growth = ((thisWeek - lastWeek) / lastWeek) * 100;
    
    // Cap at -100 to +100, then normalize to 0-100 scale
    const normalizedGrowth = Math.max(-100, Math.min(100, growth));
    return (normalizedGrowth + 100) / 2;
  }

  /**
   * Assign letter grade based on score
   */
  private assignGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Store visibility score in database
   */
  private async storeVisibilityScore(score: VisibilityScore): Promise<void> {
    const query = `
      INSERT INTO visibility_scores (
        project_id, calculated_at, platform_scores,
        overall_score, overall_grade,
        frequency_score, position_score, diversity_score,
        context_score, momentum_score,
        week_over_week_change, month_over_month_change
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    await this.db.query(query, [
      score.project_id,
      score.calculated_at,
      JSON.stringify(score.platform_scores),
      score.overall_score,
      score.overall_grade,
      score.frequency_score,
      score.position_score,
      score.diversity_score,
      score.context_score,
      score.momentum_score,
      score.week_over_week_change,
      score.month_over_month_change
    ]);
  }

  /**
   * Calculate share of voice for a project
   */
  async calculateShareOfVoice(
    projectId: string,
    competitorDomains: string[]
  ): Promise<{
    yourShare: number;
    competitorShares: Record<string, number>;
    totalMentions: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get project domain
    const projectResult = await this.db.query(
      'SELECT primary_domain FROM projects WHERE id = $1',
      [projectId]
    );
    
    const yourDomain = projectResult.rows[0]?.primary_domain || '';

    // Get citation counts by domain
    const citationsResult = await this.db.query(`
      SELECT 
        competitor_citations,
        domain_mentioned
      FROM citations
      WHERE project_id = $1
      AND tracked_at >= $2
    `, [projectId, thirtyDaysAgo.toISOString()]);

    const domainCounts: Record<string, number> = {};
    let totalMentions = 0;

    citationsResult.rows.forEach(row => {
      // Count your domain mentions
      if (row.domain_mentioned) {
        domainCounts[yourDomain] = (domainCounts[yourDomain] || 0) + 1;
        totalMentions++;
      }

      // Count competitor mentions
      const competitorCitations = row.competitor_citations || [];
      competitorCitations.forEach((c: any) => {
        if (c.domain) {
          domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1;
          totalMentions++;
        }
      });
    });

    // Calculate shares
    const yourShare = totalMentions > 0 
      ? ((domainCounts[yourDomain] || 0) / totalMentions) * 100 
      : 0;

    const competitorShares: Record<string, number> = {};
    competitorDomains.forEach(domain => {
      competitorShares[domain] = totalMentions > 0
        ? ((domainCounts[domain] || 0) / totalMentions) * 100
        : 0;
    });

    return {
      yourShare: Math.round(yourShare * 100) / 100,
      competitorShares,
      totalMentions
    };
  }

  /**
   * Get trending keywords for a project
   */
  async getTrendingKeywords(projectId: string, limit: number = 10): Promise<{
    keywordId: string;
    keywordText: string;
    citationChange: number;
    positionChange: number;
    trendDirection: 'up' | 'down' | 'stable';
  }[]> {
    // Compare this week vs last week
    const result = await this.db.query(`
      WITH this_week AS (
        SELECT 
          keyword_id,
          COUNT(*) FILTER (WHERE domain_mentioned = true) as citations,
          AVG(citation_position) as avg_position
        FROM citations
        WHERE project_id = $1
        AND tracked_at >= DATE_TRUNC('week', NOW())
        GROUP BY keyword_id
      ),
      last_week AS (
        SELECT 
          keyword_id,
          COUNT(*) FILTER (WHERE domain_mentioned = true) as citations,
          AVG(citation_position) as avg_position
        FROM citations
        WHERE project_id = $1
        AND tracked_at >= DATE_TRUNC('week', NOW() - INTERVAL '1 week')
        AND tracked_at < DATE_TRUNC('week', NOW())
        GROUP BY keyword_id
      )
      SELECT 
        k.id as keyword_id,
        k.keyword_text,
        COALESCE(tw.citations, 0) as this_week_citations,
        COALESCE(lw.citations, 0) as last_week_citations,
        COALESCE(tw.avg_position, 99) as this_week_position,
        COALESCE(lw.avg_position, 99) as last_week_position
      FROM keywords k
      LEFT JOIN this_week tw ON k.id = tw.keyword_id
      LEFT JOIN last_week lw ON k.id = lw.keyword_id
      WHERE k.project_id = $1
      AND k.is_active = true
      ORDER BY (COALESCE(tw.citations, 0) - COALESCE(lw.citations, 0)) DESC
      LIMIT $2
    `, [projectId, limit]);

    return result.rows.map(row => {
      const citationChange = row.this_week_citations - row.last_week_citations;
      const positionChange = row.last_week_position - row.this_week_position;
      
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      if (citationChange > 0 || positionChange > 0) trendDirection = 'up';
      else if (citationChange < 0 || positionChange < 0) trendDirection = 'down';

      return {
        keywordId: row.keyword_id,
        keywordText: row.keyword_text,
        citationChange,
        positionChange: Math.round(positionChange * 100) / 100,
        trendDirection
      };
    });
  }

  /**
   * Generate daily metrics for a project
   */
  async generateDailyMetrics(projectId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    // Calculate metrics for each platform
    await this.db.query(`
      INSERT INTO daily_metrics (
        project_id, date, platform,
        total_keywords_tracked,
        keywords_with_citations,
        total_citations,
        avg_citation_position,
        first_position_citations,
        top3_citations,
        share_of_voice_percent,
        positive_mentions,
        neutral_mentions,
        negative_mentions
      )
      SELECT 
        $1 as project_id,
        $2::date as date,
        platform,
        COUNT(DISTINCT keyword_id) as total_keywords,
        COUNT(DISTINCT keyword_id) FILTER (WHERE domain_mentioned = true) as keywords_with_citations,
        COUNT(*) FILTER (WHERE domain_mentioned = true) as total_citations,
        AVG(citation_position) FILTER (WHERE domain_mentioned = true AND citation_position IS NOT NULL) as avg_position,
        COUNT(*) FILTER (WHERE domain_mentioned = true AND citation_position = 1) as first_position,
        COUNT(*) FILTER (WHERE domain_mentioned = true AND citation_position <= 3) as top3,
        0 as sov, -- Calculated separately
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative
      FROM citations
      WHERE project_id = $1
      AND DATE(tracked_at) = $2::date
      GROUP BY platform
      ON CONFLICT (project_id, date, platform) DO UPDATE SET
        total_keywords_tracked = EXCLUDED.total_keywords_tracked,
        keywords_with_citations = EXCLUDED.keywords_with_citations,
        total_citations = EXCLUDED.total_citations,
        avg_citation_position = EXCLUDED.avg_citation_position,
        first_position_citations = EXCLUDED.first_position_citations,
        top3_citations = EXCLUDED.top3_citations,
        positive_mentions = EXCLUDED.positive_mentions,
        neutral_mentions = EXCLUDED.neutral_mentions,
        negative_mentions = EXCLUDED.negative_mentions
    `, [projectId, dateStr]);
  }
}

// Singleton instance
let scoringService: ScoringService | null = null;

export function getScoringService(config?: ScoringConfig): ScoringService {
  if (!scoringService && config) {
    scoringService = new ScoringService(config);
  }
  if (!scoringService) {
    throw new Error('Scoring service not initialized');
  }
  return scoringService;
}

export function initScoringService(config: ScoringConfig): void {
  scoringService = new ScoringService(config);
}
