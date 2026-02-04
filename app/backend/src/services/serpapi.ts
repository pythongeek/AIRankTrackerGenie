/**
 * SERP API Service
 * Handles Google Search and AI Overview tracking via SerpApi
 */

import { getJson } from 'serpapi';
import { AIPlatform, AIPlatformResponse, AICitation } from '../types';
import { logger } from '../utils/logger';

export interface SerpApiConfig {
  apiKey: string;
  rateLimitPerMonth?: number;
}

export interface AIOOverviewResult {
  text_block?: string;
  references?: SerpReference[];
  serpapi_link?: string;
}

export interface SerpReference {
  title: string;
  link: string;
  source: string;
  date?: string;
}

export class SerpApiService {
  private config: SerpApiConfig;
  private monthlyRequests: number = 0;
  private lastResetDate: Date = new Date();

  constructor(config: SerpApiConfig) {
    this.config = {
      rateLimitPerMonth: 250, // Free tier
      ...config
    };
  }

  /**
   * Search Google and extract AI Overview if present
   */
  async searchWithAIOOverview(keyword: string, options: {
    location?: string;
    hl?: string;
    gl?: string;
    async?: boolean;
  } = {}): Promise<AIPlatformResponse> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      
      const params: Record<string, any> = {
        q: keyword,
        api_key: this.config.apiKey,
        engine: 'google',
        location: options.location || 'United States',
        hl: options.hl || 'en',
        gl: options.gl || 'us',
        google_domain: 'google.com'
      };

      // Use async parameter for AI Overview extraction
      if (options.async) {
        params.async = true;
      }

      logger.info('SERP API request', { keyword: keyword.substring(0, 50) });
      
      const response = await getJson(params);
      
      // Extract AI Overview
      const aiOverview = this.extractAIOOverview(response);
      const citations = this.extractCitationsFromAIOOverview(aiOverview);
      
      const responseTime = Date.now() - startTime;
      
      logger.info('SERP API response received', {
        keyword: keyword.substring(0, 50),
        responseTime,
        hasAIOOverview: !!aiOverview,
        citationsFound: citations.length
      });

      return {
        platform: AIPlatform.GOOGLE_AI_OVERVIEW,
        query: keyword,
        response_text: aiOverview?.text_block || '',
        citations,
        response_time_ms: responseTime
      };

    } catch (error) {
      logger.error('SERP API request failed', { error, keyword });
      
      return {
        platform: AIPlatform.GOOGLE_AI_OVERVIEW,
        query: keyword,
        response_text: '',
        citations: [],
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract AI Overview from SERP response
   */
  private extractAIOOverview(response: any): AIOOverviewResult | null {
    // Check for AI Overview in various possible locations
    const aiOverview = response.ai_overview || 
                       response.aiOverview ||
                       response.answer_box?.ai_overview;
    
    if (!aiOverview) {
      return null;
    }

    return {
      text_block: aiOverview.text_block || aiOverview.snippet || aiOverview.text,
      references: this.parseReferences(aiOverview.references || aiOverview.links),
      serpapi_link: aiOverview.serpapi_link
    };
  }

  /**
   * Parse references from AI Overview
   */
  private parseReferences(refs: any[]): SerpReference[] {
    if (!Array.isArray(refs)) return [];
    
    return refs.map((ref, index) => ({
      title: ref.title || ref.name || `Source ${index + 1}`,
      link: ref.link || ref.url || '',
      source: ref.source || ref.displayed_link || this.extractDomain(ref.link || ref.url),
      date: ref.date || ref.date_published
    })).filter(ref => ref.link);
  }

  /**
   * Extract citations from AI Overview
   */
  private extractCitationsFromAIOOverview(aiOverview: AIOOverviewResult | null): AICitation[] {
    if (!aiOverview?.references) return [];

    return aiOverview.references.map((ref, index) => ({
      url: ref.link,
      title: ref.title,
      snippet: '',
      position: index + 1,
      domain: this.extractDomain(ref.link),
      is_you: false
    }));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Check and enforce rate limit
   */
  private async checkRateLimit(): Promise<void> {
    // Reset counter if it's a new month
    const now = new Date();
    if (now.getMonth() !== this.lastResetDate.getMonth()) {
      this.monthlyRequests = 0;
      this.lastResetDate = now;
    }

    if (this.monthlyRequests >= (this.config.rateLimitPerMonth || 250)) {
      throw new Error('Monthly SERP API rate limit exceeded');
    }

    this.monthlyRequests++;
  }

  /**
   * Get remaining quota
   */
  getQuotaInfo(): {
    used: number;
    limit: number;
    remaining: number;
    resetDate: Date;
  } {
    return {
      used: this.monthlyRequests,
      limit: this.config.rateLimitPerMonth || 250,
      remaining: (this.config.rateLimitPerMonth || 250) - this.monthlyRequests,
      resetDate: this.lastResetDate
    };
  }

  /**
   * Batch search multiple keywords
   */
  async batchSearch(keywords: string[], options?: {
    delayMs?: number;
    location?: string;
  }): Promise<AIPlatformResponse[]> {
    const results: AIPlatformResponse[] = [];
    
    for (const keyword of keywords) {
      const result = await this.searchWithAIOOverview(keyword, options);
      results.push(result);
      
      // Add delay between requests to avoid rate limiting
      if (options?.delayMs) {
        await this.sleep(options.delayMs);
      }
    }
    
    return results;
  }

  /**
   * Search with async AI Overview extraction
   * For queries where AI Overview takes time to generate
   */
  async searchAsync(keyword: string, options: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
  } = {}): Promise<AIPlatformResponse> {
    const startTime = Date.now();
    const maxWait = options.maxWaitMs || 60000;
    const pollInterval = options.pollIntervalMs || 2000;
    
    try {
      // Initial async request
      const params: Record<string, any> = {
        q: keyword,
        api_key: this.config.apiKey,
        engine: 'google',
        async: true,
        hl: 'en',
        gl: 'us'
      };

      const initialResponse = await getJson(params);
      
      if (!initialResponse.search_metadata?.id) {
        throw new Error('No search ID returned for async query');
      }

      const searchId = initialResponse.search_metadata.id;
      
      // Poll for results
      let elapsed = 0;
      while (elapsed < maxWait) {
        await this.sleep(pollInterval);
        elapsed += pollInterval;
        
        const pollResponse = await getJson({
          api_key: this.config.apiKey,
          search_id: searchId
        });
        
        // Check if search is complete
        if (pollResponse.search_metadata?.status === 'Success') {
          const aiOverview = this.extractAIOOverview(pollResponse);
          const citations = this.extractCitationsFromAIOOverview(aiOverview);
          
          return {
            platform: AIPlatform.GOOGLE_AI_OVERVIEW,
            query: keyword,
            response_text: aiOverview?.text_block || '',
            citations,
            response_time_ms: Date.now() - startTime
          };
        }
      }
      
      throw new Error('Async search timeout');

    } catch (error) {
      logger.error('Async SERP search failed', { error, keyword });
      
      return {
        platform: AIPlatform.GOOGLE_AI_OVERVIEW,
        query: keyword,
        response_text: '',
        citations: [],
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get organic search results (for comparison)
   */
  async getOrganicResults(keyword: string, options: {
    num?: number;
    location?: string;
  } = {}): Promise<{
    position: number;
    title: string;
    link: string;
    snippet: string;
    domain: string;
  }[]> {
    try {
      await this.checkRateLimit();
      
      const params = {
        q: keyword,
        api_key: this.config.apiKey,
        engine: 'google',
        num: options.num || 10,
        location: options.location || 'United States',
        hl: 'en',
        gl: 'us'
      };

      const response = await getJson(params);
      
      const organicResults = response.organic_results || [];
      
      return organicResults.map((result: any, index: number) => ({
        position: result.position || index + 1,
        title: result.title || '',
        link: result.link || '',
        snippet: result.snippet || '',
        domain: this.extractDomain(result.link || '')
      }));

    } catch (error) {
      logger.error('Failed to get organic results', { error, keyword });
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let serpApiService: SerpApiService | null = null;

export function getSerpApiService(config?: SerpApiConfig): SerpApiService {
  if (!serpApiService && config) {
    serpApiService = new SerpApiService(config);
  }
  if (!serpApiService) {
    throw new Error('SerpApi service not initialized');
  }
  return serpApiService;
}

export function initSerpApiService(config: SerpApiConfig): void {
  serpApiService = new SerpApiService(config);
}
