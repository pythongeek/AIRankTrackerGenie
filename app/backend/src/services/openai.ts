/**
 * OpenAI / ChatGPT Service
 * Handles ChatGPT and GPT-4 based tracking
 */

import OpenAI from 'openai';
import { AIPlatform, AIPlatformResponse, AICitation } from '../types';
import { logger } from '../utils/logger';

export interface OpenAIConfig {
  apiKey: string;
  rateLimitPerMinute?: number;
}

export class OpenAIService {
  private client: OpenAI;
  private config: OpenAIConfig;
  private requestTimestamps: number[] = [];

  constructor(config: OpenAIConfig) {
    this.config = {
      rateLimitPerMinute: 60,
      ...config
    };
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  /**
   * Query ChatGPT and extract citations
   * Note: ChatGPT with browsing will include sources when available
   */
  async query(keyword: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableBrowsing?: boolean;
  } = {}): Promise<AIPlatformResponse> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      
      const model = options.model || 'gpt-4o';
      
      // For browsing-enabled queries, we need to use a specific approach
      // Note: Direct API access to ChatGPT with browsing is limited
      // This implementation uses the standard completion API
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: 'You are a helpful research assistant. Provide comprehensive, well-sourced answers. When citing sources, include the URL and a brief description.'
        },
        {
          role: 'user',
          content: keyword
        }
      ];

      logger.info('OpenAI API request', { 
        keyword: keyword.substring(0, 50),
        model 
      });

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        top_p: 0.9
      });

      const responseText = completion.choices[0]?.message?.content || '';
      
      // Extract citations from response text
      const citations = this.extractCitations(responseText);
      
      const responseTime = Date.now() - startTime;
      
      logger.info('OpenAI query completed', {
        keyword: keyword.substring(0, 50),
        responseTime,
        citationsFound: citations.length,
        tokensUsed: completion.usage?.total_tokens
      });

      return {
        platform: AIPlatform.CHATGPT,
        query: keyword,
        response_text: responseText,
        citations,
        response_time_ms: responseTime
      };

    } catch (error) {
      logger.error('OpenAI query failed', { error, keyword });
      
      return {
        platform: AIPlatform.CHATGPT,
        query: keyword,
        response_text: '',
        citations: [],
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract citations from OpenAI response text
   * Looks for URL patterns and citation formats
   */
  private extractCitations(text: string): AICitation[] {
    const citations: AICitation[] = [];
    
    try {
      // Pattern 1: Markdown links [text](url)
      const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
      let match;
      let position = 1;
      
      while ((match = markdownLinkPattern.exec(text)) !== null) {
        citations.push({
          url: match[2],
          title: match[1],
          snippet: '',
          position: position++,
          domain: this.extractDomain(match[2]),
          is_you: false
        });
      }

      // Pattern 2: Bare URLs
      const urlPattern = /(https?:\/\/[^\s\]\)]+)/g;
      const seenUrls = new Set(citations.map(c => c.url));
      
      while ((match = urlPattern.exec(text)) !== null) {
        if (!seenUrls.has(match[1])) {
          citations.push({
            url: match[1],
            title: '',
            snippet: '',
            position: position++,
            domain: this.extractDomain(match[1]),
            is_you: false
          });
          seenUrls.add(match[1]);
        }
      }

      // Pattern 3: Numbered citations like [1], [2] with URLs nearby
      const numberedCitationPattern = /\[(\d+)\][^\n]*?(https?:\/\/[^\s\]]+)/g;
      
      while ((match = numberedCitationPattern.exec(text)) !== null) {
        const url = match[2];
        if (!seenUrls.has(url)) {
          citations.push({
            url,
            title: '',
            snippet: '',
            position: parseInt(match[1]),
            domain: this.extractDomain(url),
            is_you: false
          });
          seenUrls.add(url);
        }
      }

    } catch (error) {
      logger.error('Error extracting citations', { error });
    }

    return this.deduplicateCitations(citations);
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
    const seen = new Map<string, AICitation>();
    
    citations.forEach(c => {
      const existing = seen.get(c.url);
      if (!existing || (c.title && !existing.title)) {
        seen.set(c.url, c);
      }
    });
    
    return Array.from(seen.values()).map((c, i) => ({
      ...c,
      position: i + 1
    }));
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
      
      logger.warn(`OpenAI rate limit reached, waiting ${waitTime}ms`);
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
    model?: string;
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
   * Analyze content for citation potential
   * Uses GPT to evaluate how likely content is to be cited
   */
  async analyzeCitationPotential(content: string, query: string): Promise<{
    score: number;
    analysis: string;
    improvements: string[];
  }> {
    try {
      await this.checkRateLimit();
      
      const prompt = `Analyze the following content for its potential to be cited by AI assistants like ChatGPT for the query: "${query}"

Content:
${content.substring(0, 3000)}

Provide your analysis in this format:
1. Citation Potential Score (0-100):
2. Brief Analysis:
3. Top 3 Improvements:
- 
- 
- `;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in AI search optimization. Evaluate content objectively.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1024
      });

      const analysis = completion.choices[0]?.message?.content || '';
      
      // Extract score
      const scoreMatch = analysis.match(/Citation Potential Score.*?[:\s]*(\d+)/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      
      // Extract improvements
      const improvements: string[] = [];
      const improvementPattern = /^-\s*(.+)$/gm;
      let match;
      while ((match = improvementPattern.exec(analysis)) !== null) {
        improvements.push(match[1].trim());
      }

      return {
        score: Math.min(100, Math.max(0, score)),
        analysis,
        improvements: improvements.slice(0, 3)
      };

    } catch (error) {
      logger.error('Citation potential analysis failed', { error });
      return {
        score: 0,
        analysis: 'Analysis failed',
        improvements: []
      };
    }
  }

  /**
   * Generate content optimization recommendations
   */
  async generateRecommendations(content: string, targetQuery: string): Promise<{
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
  }> {
    try {
      await this.checkRateLimit();
      
      const prompt = `Given this content and target query, provide specific optimization recommendations to increase the likelihood of being cited by AI assistants.

Target Query: ${targetQuery}

Content (first 2000 chars):
${content.substring(0, 2000)}

Provide:
1. Priority Level (High/Medium/Low):
2. Top 5 Specific Recommendations:
- 
- 
- 
- 
- 
3. Expected Impact:`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in Generative Engine Optimization (GEO). Provide actionable, specific recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 1200
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Extract priority
      const priorityMatch = response.match(/Priority Level.*?[:\s]*(High|Medium|Low)/i);
      const priority = (priorityMatch?.[1].toLowerCase() as 'high' | 'medium' | 'low') || 'medium';
      
      // Extract recommendations
      const recommendations: string[] = [];
      const recPattern = /^-\s*(.+)$/gm;
      let match;
      while ((match = recPattern.exec(response)) !== null) {
        recommendations.push(match[1].trim());
      }
      
      // Extract expected impact
      const impactMatch = response.match(/Expected Impact[:\s]*(.+?)(?:\n|$)/is);
      const expectedImpact = impactMatch?.[1].trim() || 'Moderate improvement in citation likelihood';

      return {
        recommendations: recommendations.slice(0, 5),
        priority,
        expectedImpact
      };

    } catch (error) {
      logger.error('Recommendation generation failed', { error });
      return {
        recommendations: [],
        priority: 'medium',
        expectedImpact: 'Unable to determine'
      };
    }
  }
}

// Singleton instance
let openaiService: OpenAIService | null = null;

export function getOpenAIService(config?: OpenAIConfig): OpenAIService {
  if (!openaiService && config) {
    openaiService = new OpenAIService(config);
  }
  if (!openaiService) {
    throw new Error('OpenAI service not initialized');
  }
  return openaiService;
}

export function initOpenAIService(config: OpenAIConfig): void {
  openaiService = new OpenAIService(config);
}
