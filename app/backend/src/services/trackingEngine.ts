/**
 * AI Rank Tracking Engine
 * Core service for tracking citations across all AI platforms
 */

import { Pool } from 'pg';
import { AIPlatform, AIPlatformResponse, Citation, Keyword, Project, TrackingJob, JobStatus } from '../types';
import { GeminiService, getGeminiService } from './gemini';
import { SerpApiService, getSerpApiService } from './serpapi';
import { PerplexityService, getPerplexityService } from './perplexity';
import { OpenAIService, getOpenAIService } from './openai';
import { logger } from '../utils/logger';

export interface TrackingEngineConfig {
  db: Pool;
  geminiApiKey?: string;
  serpApiKey?: string;
  perplexityApiKey?: string;
  openaiApiKey?: string;
}

export interface TrackResult {
  success: boolean;
  citation?: Partial<Citation>;
  error?: string;
  platform: AIPlatform;
  responseTimeMs: number;
}

export class TrackingEngine {
  private db: Pool;
  private geminiService?: GeminiService;
  private serpApiService?: SerpApiService;
  private perplexityService?: PerplexityService;
  private openaiService?: OpenAIService;

  constructor(config: TrackingEngineConfig) {
    this.db = config.db;
    
    // Initialize services if API keys provided
    if (config.geminiApiKey) {
      this.geminiService = getGeminiService({ apiKey: config.geminiApiKey });
    }
    if (config.serpApiKey) {
      this.serpApiService = getSerpApiService({ apiKey: config.serpApiKey });
    }
    if (config.perplexityApiKey) {
      this.perplexityService = getPerplexityService({ apiKey: config.perplexityApiKey });
    }
    if (config.openaiApiKey) {
      this.openaiService = getOpenAIService({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Track a single keyword across specified platforms
   */
  async trackKeyword(
    keyword: Keyword,
    project: Project,
    platforms: AIPlatform[] = Object.values(AIPlatform)
  ): Promise<TrackResult[]> {
    const results: TrackResult[] = [];

    for (const platform of platforms) {
      try {
        const result = await this.trackOnPlatform(keyword, project, platform);
        results.push(result);

        // Store citation if successful
        if (result.success && result.citation) {
          await this.storeCitation(result.citation as Citation);
        }

      } catch (error) {
        logger.error(`Tracking failed for ${platform}`, { 
          error, 
          keyword: keyword.keyword_text 
        });
        
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          platform,
          responseTimeMs: 0
        });
      }
    }

    // Update last tracked timestamp
    await this.updateKeywordTrackingTime(keyword.id);

    return results;
  }

  /**
   * Track keyword on a specific platform
   */
  private async trackOnPlatform(
    keyword: Keyword,
    project: Project,
    platform: AIPlatform
  ): Promise<TrackResult> {
    const startTime = Date.now();
    let response: AIPlatformResponse | null = null;

    // Query the appropriate platform
    switch (platform) {
      case AIPlatform.GEMINI:
        if (!this.geminiService) {
          return { success: false, error: 'Gemini not configured', platform, responseTimeMs: 0 };
        }
        response = await this.geminiService.query(keyword.keyword_text, { enableGrounding: true });
        break;

      case AIPlatform.GOOGLE_AI_OVERVIEW:
        if (!this.serpApiService) {
          return { success: false, error: 'SERP API not configured', platform, responseTimeMs: 0 };
        }
        response = await this.serpApiService.searchWithAIOOverview(keyword.keyword_text);
        break;

      case AIPlatform.PERPLEXITY:
        if (!this.perplexityService) {
          return { success: false, error: 'Perplexity not configured', platform, responseTimeMs: 0 };
        }
        response = await this.perplexityService.query(keyword.keyword_text);
        break;

      case AIPlatform.CHATGPT:
        if (!this.openaiService) {
          return { success: false, error: 'OpenAI not configured', platform, responseTimeMs: 0 };
        }
        response = await this.openaiService.query(keyword.keyword_text);
        break;

      default:
        return { success: false, error: `Platform ${platform} not supported`, platform, responseTimeMs: 0 };
    }

    const responseTimeMs = Date.now() - startTime;

    if (response.error) {
      return { 
        success: false, 
        error: response.error, 
        platform, 
        responseTimeMs 
      };
    }

    // Analyze citations
    const domainMentioned = this.isDomainMentioned(response, project.primary_domain);
    const yourCitation = domainMentioned 
      ? response.citations.find(c => this.domainMatches(c.domain, project.primary_domain))
      : undefined;

    // Build competitor citations
    const competitorCitations = response.citations
      .filter(c => !this.domainMatches(c.domain, project.primary_domain))
      .map(c => ({
        domain: c.domain,
        url: c.url,
        position: c.position,
        context: c.snippet
      }));

    // Determine sentiment
    const sentiment = this.analyzeSentiment(response.response_text, project.primary_domain);

    // Build citation record
    const citation: Partial<Citation> = {
      keyword_id: keyword.id,
      project_id: project.id,
      platform,
      tracked_at: new Date().toISOString(),
      domain_mentioned: domainMentioned,
      specific_url: yourCitation?.url,
      citation_position: yourCitation?.position,
      citation_context: yourCitation?.snippet,
      full_response_text: response.response_text,
      response_summary: this.generateSummary(response.response_text),
      sentiment,
      confidence_score: this.calculateConfidence(response),
      word_count: response.response_text.split(/\s+/).length,
      competitor_citations: competitorCitations,
      total_sources_cited: response.citations.length
    };

    return {
      success: true,
      citation,
      platform,
      responseTimeMs
    };
  }

  /**
   * Check if domain is mentioned in response
   */
  private isDomainMentioned(response: AIPlatformResponse, domain: string): boolean {
    return response.citations.some(c => this.domainMatches(c.domain, domain));
  }

  /**
   * Check if domains match (handles www and subdomains)
   */
  private domainMatches(citationDomain: string, targetDomain: string): boolean {
    const normalize = (d: string) => d.toLowerCase().replace(/^www\./, '').trim();
    const normalizedCitation = normalize(citationDomain);
    const normalizedTarget = normalize(targetDomain);
    
    return normalizedCitation === normalizedTarget ||
           normalizedCitation.endsWith('.' + normalizedTarget);
  }

  /**
   * Analyze sentiment of response regarding target domain
   */
  private analyzeSentiment(text: string, domain: string): 'positive' | 'neutral' | 'negative' {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['best', 'excellent', 'top', 'recommended', 'leading', 'outstanding', 'superior'];
    const negativeWords = ['worst', 'poor', 'avoid', 'bad', 'terrible', 'disappointing'];
    
    // Find sentences mentioning the domain
    const sentences = text.split(/[.!?]+/);
    const relevantSentences = sentences.filter(s => 
      s.toLowerCase().includes(domain.toLowerCase())
    );
    
    if (relevantSentences.length === 0) return 'neutral';
    
    const relevantText = relevantSentences.join(' ').toLowerCase();
    
    const positiveCount = positiveWords.filter(w => relevantText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => relevantText.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate confidence score for the citation
   */
  private calculateConfidence(response: AIPlatformResponse): number {
    let score = 0.5; // Base score
    
    // More citations = higher confidence
    if (response.citations.length >= 5) score += 0.2;
    else if (response.citations.length >= 3) score += 0.1;
    
    // Reasonable response time = higher confidence
    if (response.response_time_ms < 3000) score += 0.1;
    
    // Substantial response text = higher confidence
    if (response.response_text.length > 500) score += 0.1;
    
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Generate summary of response text
   */
  private generateSummary(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) return text;
    
    // Try to end at a sentence
    const truncated = text.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Store citation in database
   */
  private async storeCitation(citation: Citation): Promise<void> {
    const query = `
      INSERT INTO citations (
        keyword_id, project_id, platform, tracked_at,
        domain_mentioned, specific_url, citation_position, citation_context,
        full_response_text, response_summary, sentiment, confidence_score,
        word_count, competitor_citations, total_sources_cited
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    await this.db.query(query, [
      citation.keyword_id,
      citation.project_id,
      citation.platform,
      citation.tracked_at,
      citation.domain_mentioned,
      citation.specific_url,
      citation.citation_position,
      citation.citation_context,
      citation.full_response_text,
      citation.response_summary,
      citation.sentiment,
      citation.confidence_score,
      citation.word_count,
      JSON.stringify(citation.competitor_citations),
      citation.total_sources_cited
    ]);
  }

  /**
   * Update keyword's last tracked timestamp
   */
  private async updateKeywordTrackingTime(keywordId: string): Promise<void> {
    await this.db.query(
      'UPDATE keywords SET last_tracked_at = NOW() WHERE id = $1',
      [keywordId]
    );
  }

  /**
   * Track all active keywords for a project
   */
  async trackProject(projectId: string, options?: {
    platforms?: AIPlatform[];
    keywordFilter?: string[];
  }): Promise<{
    totalKeywords: number;
    successfulTracks: number;
    failedTracks: number;
    newCitations: number;
  }> {
    // Get project
    const projectResult = await this.db.query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const project: Project = projectResult.rows[0];
    
    // Get active keywords
    let keywordQuery = 'SELECT * FROM keywords WHERE project_id = $1 AND is_active = true';
    const queryParams: any[] = [projectId];
    
    if (options?.keywordFilter?.length) {
      keywordQuery += ' AND id = ANY($2)';
      queryParams.push(options.keywordFilter);
    }
    
    const keywordsResult = await this.db.query(keywordQuery, queryParams);
    const keywords: Keyword[] = keywordsResult.rows;
    
    let successfulTracks = 0;
    let failedTracks = 0;
    let newCitations = 0;

    for (const keyword of keywords) {
      try {
        const results = await this.trackKeyword(
          keyword, 
          project, 
          options?.platforms
        );
        
        results.forEach(result => {
          if (result.success) {
            successfulTracks++;
            if (result.citation?.domain_mentioned) newCitations++;
          } else {
            failedTracks++;
          }
        });

      } catch (error) {
        logger.error(`Failed to track keyword ${keyword.keyword_text}`, { error });
        failedTracks++;
      }
      
      // Add delay between keywords to avoid rate limiting
      await this.sleep(1000);
    }

    return {
      totalKeywords: keywords.length,
      successfulTracks,
      failedTracks,
      newCitations
    };
  }

  /**
   * Get tracking status for a project
   */
  async getProjectTrackingStatus(projectId: string): Promise<{
    totalKeywords: number;
    trackedKeywords: number;
    pendingKeywords: number;
    lastTrackTime?: Date;
  }> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE last_tracked_at IS NOT NULL) as tracked,
        COUNT(*) FILTER (WHERE last_tracked_at IS NULL) as pending,
        MAX(last_tracked_at) as last_track
      FROM keywords 
      WHERE project_id = $1 AND is_active = true
    `, [projectId]);

    return {
      totalKeywords: parseInt(result.rows[0].total),
      trackedKeywords: parseInt(result.rows[0].tracked),
      pendingKeywords: parseInt(result.rows[0].pending),
      lastTrackTime: result.rows[0].last_track
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let trackingEngine: TrackingEngine | null = null;

export function getTrackingEngine(config?: TrackingEngineConfig): TrackingEngine {
  if (!trackingEngine && config) {
    trackingEngine = new TrackingEngine(config);
  }
  if (!trackingEngine) {
    throw new Error('Tracking engine not initialized');
  }
  return trackingEngine;
}

export function initTrackingEngine(config: TrackingEngineConfig): void {
  trackingEngine = new TrackingEngine(config);
}
