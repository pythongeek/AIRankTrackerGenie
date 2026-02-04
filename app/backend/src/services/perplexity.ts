/**
 * Perplexity API Service
 * Handles direct Perplexity API integration for citation tracking
 */

import { AIPlatform, AIPlatformResponse, AICitation } from '../types';
import { logger } from '../utils/logger';

export interface PerplexityConfig {
  apiKey: string;
  rateLimitPerMinute?: number;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityCitation {
  url: string;
  title?: string;
  snippet?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations?: string[];
  choices: {
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta?: {
      role: string;
      content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityService {
  private config: PerplexityConfig;
  private baseUrl: string = 'https://api.perplexity.ai';
  private requestTimestamps: number[] = [];

  constructor(config: PerplexityConfig) {
    this.config = {
      rateLimitPerMinute: 20,
      ...config
    };
  }

  /**
   * Query Perplexity and extract citations
   */
  async query(keyword: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    searchRecency?: 'day' | 'week' | 'month';
  } = {}): Promise<AIPlatformResponse> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      
      const messages: PerplexityMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant. Provide accurate, well-sourced information.'
        },
        {
          role: 'user',
          content: keyword
        }
      ];

      const requestBody = {
        model: options.model || 'llama-3.1-sonar-large-128k-online',
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
        top_p: 0.9,
        search_domain_filter: [],
        return_images: false,
        return_related_questions: false,
        search_recency_filter: options.searchRecency || 'month',
        top_k: 0,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 1
      };

      logger.info('Perplexity API request', { keyword: keyword.substring(0, 50) });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data: PerplexityResponse = await response.json();
      
      // Extract citations from response
      const citations = this.extractCitations(data);
      
      const responseTime = Date.now() - startTime;
      
      logger.info('Perplexity query completed', {
        keyword: keyword.substring(0, 50),
        responseTime,
        citationsFound: citations.length,
        tokensUsed: data.usage?.total_tokens
      });

      return {
        platform: AIPlatform.PERPLEXITY,
        query: keyword,
        response_text: data.choices[0]?.message?.content || '',
        citations,
        response_time_ms: responseTime
      };

    } catch (error) {
      logger.error('Perplexity query failed', { error, keyword });
      
      return {
        platform: AIPlatform.PERPLEXITY,
        query: keyword,
        response_text: '',
        citations: [],
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract citations from Perplexity response
   */
  private extractCitations(response: PerplexityResponse): AICitation[] {
    const citations: AICitation[] = [];
    
    try {
      // Perplexity returns citations as an array of URLs
      const citationUrls = response.citations || [];
      
      citationUrls.forEach((url, index) => {
        if (url) {
          citations.push({
            url,
            title: '', // Perplexity doesn't provide titles in the API
            snippet: '',
            position: index + 1,
            domain: this.extractDomain(url),
            is_you: false
          });
        }
      });

    } catch (error) {
      logger.error('Error extracting Perplexity citations', { error });
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
   * Check and enforce rate limit
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    // Check if we've hit the limit
    if (this.requestTimestamps.length >= (this.config.rateLimitPerMinute || 20)) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);
      
      logger.warn(`Perplexity rate limit reached, waiting ${waitTime}ms`);
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
    delayMs?: number;
    searchRecency?: 'day' | 'week' | 'month';
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
   * Query with specific domain focus
   * Useful for checking if a specific domain is cited
   */
  async queryWithDomainFocus(keyword: string, targetDomain: string, options?: {
    model?: string;
  }): Promise<AIPlatformResponse & {
    targetDomainMentioned: boolean;
    targetDomainPosition?: number;
  }> {
    const response = await this.query(keyword, options);
    
    // Find if target domain is mentioned
    const targetCitation = response.citations.find(c => 
      c.domain.toLowerCase().includes(targetDomain.toLowerCase())
    );
    
    return {
      ...response,
      targetDomainMentioned: !!targetCitation,
      targetDomainPosition: targetCitation?.position
    };
  }

  /**
   * Compare domain citations across multiple queries
   */
  async compareDomains(
    keyword: string, 
    domains: string[]
  ): Promise<Record<string, { mentioned: boolean; position?: number }>> {
    const response = await this.query(keyword);
    
    const comparison: Record<string, { mentioned: boolean; position?: number }> = {};
    
    for (const domain of domains) {
      const citation = response.citations.find(c => 
        c.domain.toLowerCase().includes(domain.toLowerCase())
      );
      
      comparison[domain] = {
        mentioned: !!citation,
        position: citation?.position
      };
    }
    
    return comparison;
  }

  /**
   * Get related questions for a keyword
   * Useful for content gap analysis
   */
  async getRelatedQuestions(keyword: string): Promise<string[]> {
    try {
      await this.checkRateLimit();
      
      const messages: PerplexityMessage[] = [
        {
          role: 'system',
          content: 'Generate a list of related questions that people commonly ask about this topic.'
        },
        {
          role: 'user',
          content: `What are the most common questions people ask about: ${keyword}? List 10 questions.`
        }
      ];

      const requestBody = {
        model: 'llama-3.1-sonar-large-128k-online',
        messages,
        temperature: 0.3,
        max_tokens: 1024,
        return_related_questions: true,
        stream: false
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        return [];
      }

      const data: PerplexityResponse = await response.json();
      const content = data.choices[0]?.message?.content || '';
      
      // Extract questions from response
      const questionPattern = /\d+\.\s*([^?]+\?)/g;
      const questions: string[] = [];
      let match;
      
      while ((match = questionPattern.exec(content)) !== null) {
        questions.push(match[1].trim());
      }
      
      return questions;

    } catch (error) {
      logger.error('Failed to get related questions', { error, keyword });
      return [];
    }
  }
}

// Singleton instance
let perplexityService: PerplexityService | null = null;

export function getPerplexityService(config?: PerplexityConfig): PerplexityService {
  if (!perplexityService && config) {
    perplexityService = new PerplexityService(config);
  }
  if (!perplexityService) {
    throw new Error('Perplexity service not initialized');
  }
  return perplexityService;
}

export function initPerplexityService(config: PerplexityConfig): void {
  perplexityService = new PerplexityService(config);
}
