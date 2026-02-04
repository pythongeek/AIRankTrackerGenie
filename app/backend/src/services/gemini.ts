/**
 * Gemini API Service
 * Handles direct integration with Google's Gemini API for AI response tracking
 */

import { GoogleGenerativeAI, GroundingMode } from '@google/generative-ai';
import { AIPlatform, AIPlatformResponse, AICitation } from '../types';
import { logger } from '../utils/logger';

export interface GeminiServiceConfig {
  apiKey: string;
  rateLimitPerMinute?: number;
}

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: string = 'gemini-2.0-flash-exp';
  private config: GeminiServiceConfig;
  private requestTimestamps: number[] = [];

  constructor(config: GeminiServiceConfig) {
    this.config = {
      rateLimitPerMinute: 60,
      ...config
    };
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Query Gemini and extract citations
   */
  async query(keyword: string, options: {
    enableGrounding?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
  } = {}): Promise<AIPlatformResponse> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
        }
      });

      // Enable grounding for web search capabilities
      const tools = options.enableGrounding !== false ? [{
        googleSearch: {}
      }] : undefined;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: keyword }] }],
        tools
      });

      const response = result.response;
      const responseText = response.text();
      
      // Extract citations from grounding metadata
      const citations = this.extractCitations(response);
      
      const responseTime = Date.now() - startTime;
      
      logger.info(`Gemini query completed`, {
        keyword: keyword.substring(0, 50),
        responseTime,
        citationsFound: citations.length
      });

      return {
        platform: AIPlatform.GEMINI,
        query: keyword,
        response_text: responseText,
        citations,
        response_time_ms: responseTime
      };

    } catch (error) {
      logger.error('Gemini query failed', { error, keyword });
      
      return {
        platform: AIPlatform.GEMINI,
        query: keyword,
        response_text: '',
        citations: [],
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract citations from Gemini response metadata
   */
  private extractCitations(response: any): AICitation[] {
    const citations: AICitation[] = [];
    
    try {
      // Access grounding metadata
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      
      if (groundingMetadata) {
        // Extract from groundingChunks
        const chunks = groundingMetadata.groundingChunks || [];
        const supports = groundingMetadata.groundingSupports || [];
        
        chunks.forEach((chunk: any, index: number) => {
          if (chunk.web?.uri) {
            citations.push({
              url: chunk.web.uri,
              title: chunk.web.title || '',
              snippet: '',
              position: index + 1,
              domain: this.extractDomain(chunk.web.uri),
              is_you: false // Will be determined by caller
            });
          }
        });

        // Extract from search entry point (if available)
        const searchEntryPoint = groundingMetadata.searchEntryPoint;
        if (searchEntryPoint?.renderedContent) {
          // Parse additional sources from rendered content if needed
          logger.debug('Search entry point available', { 
            content: searchEntryPoint.renderedContent.substring(0, 200) 
          });
        }
      }

      // Also check for citations in the response text
      const textCitations = this.extractInlineCitations(response.text());
      citations.push(...textCitations);

    } catch (error) {
      logger.error('Error extracting citations', { error });
    }

    return this.deduplicateCitations(citations);
  }

  /**
   * Extract inline citations from response text
   */
  private extractInlineCitations(text: string): AICitation[] {
    const citations: AICitation[] = [];
    
    // Pattern: [1], [2], etc. followed by URL
    const citationPattern = /\[(\d+)\][^\n]*?(https?:\/\/[^\s\]]+)/g;
    let match;
    
    while ((match = citationPattern.exec(text)) !== null) {
      citations.push({
        url: match[2],
        title: '',
        snippet: '',
        position: parseInt(match[1]),
        domain: this.extractDomain(match[2]),
        is_you: false
      });
    }

    return citations;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Deduplicate citations by URL
   */
  private deduplicateCitations(citations: AICitation[]): AICitation[] {
    const seen = new Set<string>();
    return citations.filter(c => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
  }

  /**
   * Check and enforce rate limit
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    // Check if we've hit the limit
    if (this.requestTimestamps.length >= (this.config.rateLimitPerMinute || 60)) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);
      
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
    
    this.requestTimestamps.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch query multiple keywords
   */
  async batchQuery(keywords: string[], options?: {
    enableGrounding?: boolean;
    delayMs?: number;
  }): Promise<AIPlatformResponse[]> {
    const results: AIPlatformResponse[] = [];
    
    for (const keyword of keywords) {
      const result = await this.query(keyword, options);
      results.push(result);
      
      // Add delay between requests
      if (options?.delayMs) {
        await this.sleep(options.delayMs);
      }
    }
    
    return results;
  }

  /**
   * Compare responses for competitive analysis
   */
  async compareResponses(keyword: string, domains: string[]): Promise<{
    response: AIPlatformResponse;
    domainAnalysis: Record<string, {
      mentioned: boolean;
      position?: number;
      context?: string;
    }>;
  }> {
    const response = await this.query(keyword, { enableGrounding: true });
    
    const domainAnalysis: Record<string, any> = {};
    
    for (const domain of domains) {
      const citation = response.citations.find(c => 
        c.domain.toLowerCase().includes(domain.toLowerCase())
      );
      
      domainAnalysis[domain] = {
        mentioned: !!citation,
        position: citation?.position,
        context: citation?.snippet
      };
    }
    
    return { response, domainAnalysis };
  }
}

// Singleton instance
let geminiService: GeminiService | null = null;

export function getGeminiService(config?: GeminiServiceConfig): GeminiService {
  if (!geminiService && config) {
    geminiService = new GeminiService(config);
  }
  if (!geminiService) {
    throw new Error('Gemini service not initialized');
  }
  return geminiService;
}

export function initGeminiService(config: GeminiServiceConfig): void {
  geminiService = new GeminiService(config);
}
