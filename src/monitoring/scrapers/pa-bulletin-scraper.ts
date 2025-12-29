import { createChildLogger } from '../../utils/logger.js';
import { ScraperResult, ScrapedItem } from '../types.js';
import { BaseScraper, ScraperOptions } from './base-scraper.js';

const logger = createChildLogger('pa-bulletin-scraper');

/**
 * Default DHS-related filter keywords for PA Bulletin
 */
const DEFAULT_DHS_KEYWORDS = [
  'Department of Human Services',
  'DHS',
  'Medical Assistance',
  'Medicaid',
  'LIFE',
  'CHC',
  'Community HealthChoices',
  'Long-Term Care',
  'Long Term Care',
  'LTSS',
  'Nursing Home',
  'Estate Recovery',
  'PACE',
  'PACENET',
  'MAWD',
];

/**
 * Scraper for Pennsylvania Bulletin notices
 *
 * The PA Bulletin is published weekly (Saturday) and contains
 * official notices from state agencies. This scraper filters
 * for DHS-related notices only.
 *
 * URL: https://www.pacodeandbulletin.gov/Display/pabull
 */
export class PABulletinScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    // Set default DHS keywords if not provided
    const effectiveOptions = {
      ...options,
      filterKeywords: options.filterKeywords?.length
        ? options.filterKeywords
        : DEFAULT_DHS_KEYWORDS,
    };
    super('pa_bulletin', effectiveOptions);
  }

  /**
   * Scrape the PA Bulletin page
   */
  async scrape(url: string): Promise<ScraperResult> {
    const { content, status, contentType } = await this.fetchWithRetry(url);

    // Extract notices from the bulletin
    const allItems = this.extractItems(content, url);

    // Filter to DHS-related notices only
    const filteredItems = this.filterByKeywords(allItems, this.options.filterKeywords);

    logger.info(
      {
        url,
        totalNotices: allItems.length,
        dhsNotices: filteredItems.length,
      },
      'Scraped PA Bulletin'
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
   * Extract notices from PA Bulletin HTML
   *
   * The bulletin typically has notices organized by agency with
   * links to individual notices. Format varies by bulletin issue.
   */
  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Pattern 1: Standard notice links
    // <a href="/Display/pabull?doc=XX_XX_XXXX.htm">Notice Title</a>
    const noticePattern = /<a[^>]+href=["']([^"']*(?:pabull|bulletin)[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = noticePattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      // Skip navigation links
      if (this.isNavigationLink(href, title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);
      const citation = this.extractBulletinCitation(title);
      const date = this.extractDateFromNotice(content, title);

      items.push({
        title,
        url,
        date,
        description: citation,
      });
    }

    // Pattern 2: Table-based notice listing
    // Some bulletin pages use tables with agency, title, and link columns
    const tablePattern = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>[\s\S]*?<\/td>[\s\S]*?<\/tr>/gi;

    while ((match = tablePattern.exec(content)) !== null) {
      const agency = this.extractTextFromHtml(match[1]).trim();
      const href = match[2];
      const title = this.extractTextFromHtml(match[3]).trim();

      // Skip navigation
      if (this.isNavigationLink(href, title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);
      const fullTitle = agency ? `${agency}: ${title}` : title;

      // Check if already added
      if (items.some((i) => i.url === url)) {
        continue;
      }

      items.push({
        title: fullTitle,
        url,
        description: agency,
      });
    }

    // Pattern 3: Look for DHS/Human Services section headers
    // The bulletin often groups notices by agency
    const dhsSectionPattern = /(?:Department of Human Services|DHS)[:\s]*[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/gi;

    while ((match = dhsSectionPattern.exec(content)) !== null) {
      const sectionContent = match[1];
      const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      let linkMatch;

      while ((linkMatch = linkPattern.exec(sectionContent)) !== null) {
        const href = linkMatch[1];
        const title = this.extractTextFromHtml(linkMatch[2]).trim();

        if (this.isNavigationLink(href, title)) {
          continue;
        }

        const url = this.resolveUrl(href, baseUrl);

        // Check if already added
        if (items.some((i) => i.url === url)) {
          continue;
        }

        items.push({
          title: `DHS: ${title}`,
          url,
          description: 'Department of Human Services',
        });
      }
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

    logger.debug({ noticeCount: uniqueItems.length }, 'Extracted PA Bulletin notices');

    return uniqueItems;
  }

  /**
   * Check if link is a navigation link
   */
  private isNavigationLink(href: string, title: string): boolean {
    const lowerTitle = title.toLowerCase();
    const lowerHref = href.toLowerCase();

    const skipPatterns = [
      'home', 'back', 'next', 'previous', 'top', 'index',
      'table of contents', 'search', 'subscribe', 'about',
    ];

    return skipPatterns.some((p) => lowerTitle.includes(p) || lowerHref.includes(p));
  }

  /**
   * Extract PA Bulletin citation (e.g., "52 Pa.B. 1234")
   */
  private extractBulletinCitation(text: string): string | undefined {
    // Pattern: XX Pa.B. XXXX
    const citationPattern = /(\d+\s*Pa\.B\.\s*\d+)/i;
    const match = text.match(citationPattern);
    return match ? match[1] : undefined;
  }

  /**
   * Extract date from notice content or surrounding text
   */
  private extractDateFromNotice(fullContent: string, title: string): Date | undefined {
    // Try to find date near the title in the full content
    const titleIndex = fullContent.indexOf(title);
    if (titleIndex > -1) {
      // Look for date patterns near the title (within 200 chars before/after)
      const start = Math.max(0, titleIndex - 200);
      const end = Math.min(fullContent.length, titleIndex + title.length + 200);
      const nearbyContent = fullContent.substring(start, end);

      // Pattern: Month DD, YYYY or MM/DD/YYYY
      const datePatterns = [
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
        /\d{1,2}\/\d{1,2}\/\d{4}/,
      ];

      for (const pattern of datePatterns) {
        const match = nearbyContent.match(pattern);
        if (match) {
          return this.parseDate(match[0]);
        }
      }
    }

    // Try parsing from title directly
    return this.parseDate(title);
  }
}

/**
 * Scraper for PA Code sections
 *
 * Used for monitoring changes to regulatory text like Chapter 258.
 * This is a page-based scraper (not list-based).
 */
export class PACodeScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    super('pa_code', options);
  }

  async scrape(url: string): Promise<ScraperResult> {
    const { content, status, contentType } = await this.fetchWithRetry(url);

    // For PA Code, we track the entire page content for changes
    // Extract section links for navigation
    const items = this.extractItems(content, url);

    logger.info(
      { url, sectionCount: items.length },
      'Scraped PA Code page'
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
   * Extract section links from PA Code table of contents
   */
  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Pattern: Links to individual sections
    // <a href="...s258.1.html">§ 258.1. Definitions.</a>
    const sectionPattern = /<a[^>]+href=["']([^"']+s\d+\.\d+[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = sectionPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

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

    // Sort by section number
    uniqueItems.sort((a, b) => {
      if (a.description && b.description) {
        return a.description.localeCompare(b.description, undefined, { numeric: true });
      }
      return a.title.localeCompare(b.title);
    });

    return uniqueItems;
  }

  /**
   * Extract section number from title
   */
  private extractSectionNumber(title: string): string | undefined {
    // Pattern: § XXX.X or just XXX.X
    const pattern = /§?\s*(\d+\.\d+)/;
    const match = title.match(pattern);
    return match ? match[1] : undefined;
  }
}

/**
 * Factory to create PA-related scrapers
 */
export function createPAScraper(
  sourceType: 'pa_bulletin' | 'pa_code',
  options: ScraperOptions = {}
): BaseScraper {
  switch (sourceType) {
    case 'pa_bulletin':
      return new PABulletinScraper(options);
    case 'pa_code':
      return new PACodeScraper(options);
    default:
      throw new Error(`Unsupported PA source type: ${sourceType}`);
  }
}
