import { createChildLogger } from '../../utils/logger.js';
import { ScraperResult, ScrapedItem, SourceType } from '../types.js';
import { BaseScraper, ScraperOptions } from './base-scraper.js';

const logger = createChildLogger('oim-scraper');

/**
 * Scraper for OIM Operations Memoranda and Policy Clarifications
 *
 * These are list pages that link to individual memos/clarifications.
 * The scraper extracts the list of items and their URLs for change detection.
 *
 * URL patterns:
 * - Operations Memoranda: http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm
 * - Policy Clarifications: http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm
 */
export class OIMOpsMemoScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    super('oim_ops_memo', options);
  }

  /**
   * Scrape the OIM ops memo or policy clarification list page
   */
  async scrape(url: string): Promise<ScraperResult> {
    const { content, status, contentType } = await this.fetchWithRetry(url);

    // Extract items from the list page
    const items = this.extractItems(content, url);

    // Apply keyword filter if set
    const filteredItems = this.filterByKeywords(items, this.options.filterKeywords);

    logger.info(
      { url, totalItems: items.length, filteredItems: filteredItems.length },
      'Scraped OIM list page'
    );

    return {
      contentHash: this.hashContent(content),
      content,
      items: filteredItems,
      metadata: {
        scrapedAt: new Date(),
        sourceUrl: url,
        itemCount: filteredItems.length,
        httpStatus: status,
        contentType,
      },
    };
  }

  /**
   * Extract memo/clarification items from the list page HTML
   *
   * OIM list pages typically have links in a table or list format:
   * - Operations Memoranda are numbered (e.g., "25-01-01 - Title")
   * - Policy Clarifications may have dates and titles
   */
  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Pattern 1: Links with href containing .htm or .pdf
    // <a href="some_memo.htm">Memo Title</a>
    const linkPattern = /<a[^>]+href=["']([^"']+\.(?:htm|html|pdf))["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      // Skip navigation and non-content links
      if (this.isNavigationLink(href, title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);
      const date = this.extractDateFromTitle(title);

      items.push({
        title,
        url,
        date,
        description: this.extractMemoNumber(title),
      });
    }

    // Pattern 2: Table rows with memo information
    // Some OIM pages use tables to list memos
    const tableRowPattern = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>[\s\S]*?<\/td>[\s\S]*?<\/tr>/gi;

    while ((match = tableRowPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      if (this.isNavigationLink(href, title)) {
        continue;
      }

      // Avoid duplicates
      const url = this.resolveUrl(href, baseUrl);
      if (items.some((i) => i.url === url)) {
        continue;
      }

      const date = this.extractDateFromTitle(title);

      items.push({
        title,
        url,
        date,
        description: this.extractMemoNumber(title),
      });
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });

    // Sort by date (newest first) or by title
    uniqueItems.sort((a, b) => {
      if (a.date && b.date) {
        return b.date.getTime() - a.date.getTime();
      }
      return a.title.localeCompare(b.title);
    });

    logger.debug({ itemCount: uniqueItems.length }, 'Extracted OIM items');

    return uniqueItems;
  }

  /**
   * Check if a link is a navigation link (skip these)
   */
  private isNavigationLink(href: string, title: string): boolean {
    const lowerTitle = title.toLowerCase();
    const lowerHref = href.toLowerCase();

    // Skip common navigation patterns
    const skipPatterns = [
      'home', 'back', 'next', 'previous', 'top', 'index',
      'table of contents', 'toc', 'menu', 'navigation',
    ];

    if (skipPatterns.some((p) => lowerTitle.includes(p) || lowerHref.includes(p))) {
      return true;
    }

    // Skip parent directory links
    if (href === '..' || href === '../' || href.startsWith('../') && !href.includes('.htm')) {
      return true;
    }

    // Skip anchor-only links
    if (href.startsWith('#')) {
      return true;
    }

    return false;
  }

  /**
   * Extract memo number from title (e.g., "25-01-01" from "25-01-01 - Some Title")
   */
  private extractMemoNumber(title: string): string | undefined {
    // Pattern: YY-MM-## or similar
    const memoPattern = /^(\d{2}-\d{2}-\d{2,3})/;
    const match = title.match(memoPattern);
    return match ? match[1] : undefined;
  }

  /**
   * Extract date from title or memo number
   */
  private extractDateFromTitle(title: string): Date | undefined {
    // Try to extract from memo number format: YY-MM-##
    const memoPattern = /^(\d{2})-(\d{2})-(\d{2,3})/;
    const memoMatch = title.match(memoPattern);
    if (memoMatch) {
      const year = parseInt(memoMatch[1], 10);
      const month = parseInt(memoMatch[2], 10) - 1; // 0-indexed
      // Assume 20xx for years < 50, 19xx otherwise
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return new Date(fullYear, month, 1);
    }

    // Try standard date extraction
    return this.parseDate(title);
  }
}

/**
 * Scraper for OIM Policy Clarifications
 * Same structure as Operations Memoranda but different content
 */
export class OIMPolicyClarificationScraper extends BaseScraper {
  private opsMemoScraper: OIMOpsMemoScraper;

  constructor(options: ScraperOptions = {}) {
    super('oim_policy_clarification', options);
    this.opsMemoScraper = new OIMOpsMemoScraper(options);
  }

  async scrape(url: string): Promise<ScraperResult> {
    // Reuse the ops memo scraper logic since structure is similar
    const result = await this.opsMemoScraper.scrape(url);
    return {
      ...result,
      metadata: {
        ...result.metadata,
        sourceUrl: url,
      },
    };
  }

  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    return this.opsMemoScraper.extractItems(content, baseUrl);
  }
}

/**
 * Scraper for OIM Handbooks (LTC and MA)
 *
 * These are multi-page HTML documents with navigation structure.
 * The scraper extracts the table of contents and individual section URLs.
 */
export class OIMHandbookScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    super('oim_handbook', options);
  }

  async scrape(url: string): Promise<ScraperResult> {
    const { content, status, contentType } = await this.fetchWithRetry(url);

    // Extract section links from the handbook TOC
    const items = this.extractItems(content, url);

    logger.info(
      { url, sectionCount: items.length },
      'Scraped OIM handbook index'
    );

    return {
      contentHash: this.hashContent(content),
      content,
      items,
      metadata: {
        scrapedAt: new Date(),
        sourceUrl: url,
        itemCount: items.length,
        httpStatus: status,
        contentType,
      },
    };
  }

  /**
   * Extract section links from handbook table of contents
   */
  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Pattern for handbook section links
    // Format: <a href="403_General_Information/403_1_General_Policy.htm">403.1 General Policy</a>
    const sectionPattern = /<a[^>]+href=["']([^"']+\.htm(?:l)?)["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = sectionPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      // Skip non-content links
      if (this.isNavigationLink(href, title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);
      const sectionNumber = this.extractSectionNumber(title);

      items.push({
        title,
        url,
        description: sectionNumber,
      });
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });

    // Sort by section number if available
    uniqueItems.sort((a, b) => {
      if (a.description && b.description) {
        return a.description.localeCompare(b.description, undefined, { numeric: true });
      }
      return a.title.localeCompare(b.title);
    });

    logger.debug({ sectionCount: uniqueItems.length }, 'Extracted handbook sections');

    return uniqueItems;
  }

  /**
   * Check if a link is a navigation link
   */
  private isNavigationLink(href: string, title: string): boolean {
    const lowerTitle = title.toLowerCase();
    const skipPatterns = ['home', 'back', 'index', 'contents', 'top'];
    return skipPatterns.some((p) => lowerTitle.includes(p));
  }

  /**
   * Extract section number from title (e.g., "403.1" from "403.1 General Policy")
   */
  private extractSectionNumber(title: string): string | undefined {
    const pattern = /^(\d{3}(?:\.\d+)*)/;
    const match = title.match(pattern);
    return match ? match[1] : undefined;
  }
}

/**
 * Factory function to create the appropriate OIM scraper
 */
export function createOIMScraper(
  sourceType: SourceType,
  options: ScraperOptions = {}
): BaseScraper {
  switch (sourceType) {
    case 'oim_ops_memo':
      return new OIMOpsMemoScraper(options);
    case 'oim_policy_clarification':
      return new OIMPolicyClarificationScraper(options);
    case 'oim_handbook':
      return new OIMHandbookScraper(options);
    default:
      throw new Error(`Unsupported OIM source type: ${sourceType}`);
  }
}
