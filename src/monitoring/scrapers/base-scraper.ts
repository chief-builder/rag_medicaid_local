import { createHash } from 'crypto';
import { createChildLogger } from '../../utils/logger.js';
import {
  ScraperResult,
  ScrapedItem,
  ChangeDetection,
  SourceType,
} from '../types.js';

const logger = createChildLogger('base-scraper');

/**
 * Configuration options for scrapers
 */
export interface ScraperOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Retry count on failure */
  retries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Filter keywords for content filtering */
  filterKeywords?: string[];
}

/**
 * Default scraper options
 */
const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  timeout: 30000,
  userAgent: 'RAG-Medicaid-Local/1.0 (+https://github.com/chief-builder/rag_medicaid_local)',
  retries: 3,
  retryDelay: 1000,
  filterKeywords: [],
};

/**
 * Abstract base class for source scrapers
 */
export abstract class BaseScraper {
  protected options: Required<ScraperOptions>;
  protected sourceType: SourceType;

  constructor(sourceType: SourceType, options: ScraperOptions = {}) {
    this.sourceType = sourceType;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Scrape content from a URL
   */
  abstract scrape(url: string): Promise<ScraperResult>;

  /**
   * Extract individual items from a list page (for list-type sources)
   */
  abstract extractItems(content: string, baseUrl: string): ScrapedItem[];

  /**
   * Fetch content from a URL with retry logic
   */
  protected async fetchWithRetry(url: string): Promise<{ content: string; status: number; contentType?: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.retries; attempt++) {
      try {
        logger.debug({ url, attempt }, 'Fetching URL');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          headers: {
            'User-Agent': this.options.userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        const contentType = response.headers.get('content-type') || undefined;

        logger.debug({ url, status: response.status, contentLength: content.length }, 'Fetch successful');

        return {
          content,
          status: response.status,
          contentType,
        };
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { url, attempt, error: lastError.message },
          'Fetch attempt failed'
        );

        if (attempt < this.options.retries) {
          await this.sleep(this.options.retryDelay * attempt);
        }
      }
    }

    throw new Error(`Failed to fetch ${url} after ${this.options.retries} attempts: ${lastError?.message}`);
  }

  /**
   * Calculate SHA-256 hash of content
   */
  protected hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Detect changes between previous and current scraper results
   */
  detectChanges(previous: ScraperResult | null, current: ScraperResult): ChangeDetection {
    // No previous result - treat as new content
    if (!previous) {
      return {
        hasChanges: true,
        changeType: 'content_modified',
        summary: 'Initial scrape - no previous content to compare',
        newItems: current.items || [],
        removedItems: [],
        previousHash: undefined,
        newHash: current.contentHash,
      };
    }

    // Compare hashes for content-based detection
    if (previous.contentHash === current.contentHash) {
      return {
        hasChanges: false,
        changeType: 'no_change',
        summary: 'No changes detected',
        newItems: [],
        removedItems: [],
        previousHash: previous.contentHash,
        newHash: current.contentHash,
      };
    }

    // If we have items, do item-based comparison
    if (previous.items && current.items) {
      const previousUrls = new Set(previous.items.map((i) => i.url));
      const currentUrls = new Set(current.items.map((i) => i.url));

      const newItems = current.items.filter((i) => !previousUrls.has(i.url));
      const removedItems = previous.items.filter((i) => !currentUrls.has(i.url));

      if (newItems.length > 0 || removedItems.length > 0) {
        const changes: string[] = [];
        if (newItems.length > 0) {
          changes.push(`${newItems.length} new item(s)`);
        }
        if (removedItems.length > 0) {
          changes.push(`${removedItems.length} removed item(s)`);
        }

        return {
          hasChanges: true,
          changeType: newItems.length > 0 ? 'items_added' : 'items_removed',
          summary: changes.join(', '),
          newItems,
          removedItems,
          previousHash: previous.contentHash,
          newHash: current.contentHash,
        };
      }
    }

    // Hash changed but no item changes - content was modified
    return {
      hasChanges: true,
      changeType: 'content_modified',
      summary: 'Content was modified',
      newItems: [],
      removedItems: [],
      previousHash: previous.contentHash,
      newHash: current.contentHash,
    };
  }

  /**
   * Filter items by keywords
   */
  protected filterByKeywords(items: ScrapedItem[], keywords: string[]): ScrapedItem[] {
    if (keywords.length === 0) {
      return items;
    }

    const lowerKeywords = keywords.map((k) => k.toLowerCase());

    return items.filter((item) => {
      const text = `${item.title} ${item.description || ''}`.toLowerCase();
      return lowerKeywords.some((keyword) => text.includes(keyword));
    });
  }

  /**
   * Parse a date string from various formats
   */
  protected parseDate(dateStr: string): Date | undefined {
    try {
      // Try common date formats
      const formats = [
        // MM/DD/YYYY
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        // Month DD, YYYY
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
        // YYYY-MM-DD
        /(\d{4})-(\d{2})-(\d{2})/,
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }

      // Try native parsing as fallback
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract text content from HTML
   */
  protected extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode HTML entities
    text = this.decodeHtmlEntities(text);
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  /**
   * Decode common HTML entities
   */
  protected decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&ndash;': '–',
      '&mdash;': '—',
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    // Handle numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

    return decoded;
  }

  /**
   * Resolve a relative URL to absolute
   */
  protected resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      // If URL parsing fails, try simple concatenation
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const rel = relativeUrl.startsWith('/') ? relativeUrl : '/' + relativeUrl;
      return base + rel;
    }
  }

  /**
   * Sleep for a specified duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
