import { createChildLogger } from '../../utils/logger.js';
import { ScraperResult, ScrapedItem, SourceType } from '../types.js';
import { BaseScraper, ScraperOptions } from './base-scraper.js';

const logger = createChildLogger('chc-scraper');

/**
 * Scraper for PA DHS Community HealthChoices Publications Hub
 *
 * This page lists CHC publications including participant guides, fair hearing
 * information, and plan contacts. Publications are typically PDFs or HTML pages.
 *
 * URL: https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/community-healthchoices/publications
 */
export class CHCPublicationsScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    super('chc_publications', options);
  }

  /**
   * Scrape the CHC Publications Hub page
   */
  async scrape(url: string): Promise<ScraperResult> {
    const { content, status, contentType } = await this.fetchWithRetry(url);

    // Extract publication items from the page
    const items = this.extractItems(content, url);

    // Apply keyword filter if set
    const filteredItems = this.filterByKeywords(items, this.options.filterKeywords);

    logger.info(
      { url, totalItems: items.length, filteredItems: filteredItems.length },
      'Scraped CHC Publications Hub'
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
   * Extract publication items from the CHC Publications Hub HTML
   *
   * The PA.gov site typically has publications in:
   * - Card layouts with links
   * - List layouts with PDF/document links
   * - Accordion sections with nested links
   */
  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Pattern 1: PDF and document links
    // <a href="/content/dam/.../document.pdf">Document Title</a>
    const pdfPattern = /<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = pdfPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      if (this.isNavigationLink(href, title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);

      items.push({
        title,
        url,
        description: this.extractDocumentType(title),
      });
    }

    // Pattern 2: HTML page links on PA.gov
    const htmlPattern = /<a[^>]+href=["'](\/agencies\/dhs[^"']+|https:\/\/www\.pa\.gov\/agencies\/dhs[^"']+)["'][^>]*>([^<]+)<\/a>/gi;

    while ((match = htmlPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      if (this.isNavigationLink(href, title)) {
        continue;
      }

      // Skip if already captured as PDF
      const url = this.resolveUrl(href, baseUrl);
      if (items.some((i) => i.url === url)) {
        continue;
      }

      items.push({
        title,
        url,
        description: this.extractDocumentType(title),
      });
    }

    // Pattern 3: General content links that might contain publications
    const contentPattern = /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*(?:card|link|document|resource)[^"']*["'][^>]*>([^<]+)<\/a>/gi;

    while ((match = contentPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      if (this.isNavigationLink(href, title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);
      if (items.some((i) => i.url === url)) {
        continue;
      }

      items.push({
        title,
        url,
        description: this.extractDocumentType(title),
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

    // Sort alphabetically by title
    uniqueItems.sort((a, b) => a.title.localeCompare(b.title));

    logger.debug({ itemCount: uniqueItems.length }, 'Extracted CHC publication items');

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
      'home', 'back', 'next', 'previous', 'top', 'menu',
      'navigation', 'skip to', 'main content', 'footer',
      'contact', 'sign in', 'login', 'register',
    ];

    if (skipPatterns.some((p) => lowerTitle.includes(p))) {
      return true;
    }

    // Skip anchor-only links
    if (href.startsWith('#')) {
      return true;
    }

    // Skip external non-PA.gov links (except MCO sites)
    if (href.startsWith('http') && !lowerHref.includes('pa.gov')) {
      // Allow MCO handbook links
      const allowedDomains = ['upmchealthplan.com', 'amerihealthcaritas', 'pahealthwellness.com'];
      if (!allowedDomains.some((d) => lowerHref.includes(d))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract document type from title for description
   */
  private extractDocumentType(title: string): string | undefined {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('handbook') || lowerTitle.includes('member guide')) {
      return 'Handbook';
    }
    if (lowerTitle.includes('fair hearing') || lowerTitle.includes('appeal')) {
      return 'Fair Hearing';
    }
    if (lowerTitle.includes('grievance')) {
      return 'Grievance';
    }
    if (lowerTitle.includes('contact') || lowerTitle.includes('phone')) {
      return 'Contact Info';
    }
    if (lowerTitle.includes('service') && lowerTitle.includes('coordinator')) {
      return 'Service Coordinator';
    }

    return undefined;
  }
}

/**
 * Scraper for CHC MCO Participant Handbooks
 *
 * Scrapes handbook pages from:
 * - UPMC: https://www.upmchealthplan.com/chc/member-handbook
 * - AmeriHealth: https://www.amerihealthcaritaschc.com/member/resources/handbooks
 * - PA Health & Wellness: https://www.pahealthwellness.com/members/chc/resources
 */
export class CHCHandbookScraper extends BaseScraper {
  private mcoName?: string;

  constructor(options: ScraperOptions = {}, mcoName?: string) {
    super('chc_handbook', options);
    this.mcoName = mcoName;
  }

  /**
   * Scrape an MCO handbook page
   */
  async scrape(url: string): Promise<ScraperResult> {
    const { content, status, contentType } = await this.fetchWithRetry(url);

    // Extract handbook items (PDFs, sections)
    const items = this.extractItems(content, url);

    logger.info(
      { url, mco: this.mcoName, itemCount: items.length },
      'Scraped CHC MCO handbook page'
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
   * Extract handbook items from MCO page
   */
  extractItems(content: string, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Pattern 1: PDF links (most common for handbooks)
    const pdfPattern = /<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = pdfPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      if (this.isNavigationLink(title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);

      items.push({
        title,
        url,
        description: this.detectMCO(baseUrl),
      });
    }

    // Pattern 2: Links with "handbook", "guide", or "member" in text
    const handbookPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:handbook|guide|member)[^<]*)<\/a>/gi;

    while ((match = handbookPattern.exec(content)) !== null) {
      const href = match[1];
      const title = this.extractTextFromHtml(match[2]).trim();

      if (this.isNavigationLink(title)) {
        continue;
      }

      const url = this.resolveUrl(href, baseUrl);
      if (items.some((i) => i.url === url)) {
        continue;
      }

      items.push({
        title,
        url,
        description: this.detectMCO(baseUrl),
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

    // Sort alphabetically
    uniqueItems.sort((a, b) => a.title.localeCompare(b.title));

    return uniqueItems;
  }

  /**
   * Check if a link title is navigation
   */
  private isNavigationLink(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    const skipPatterns = ['home', 'back', 'menu', 'navigation', 'login', 'sign in'];
    return skipPatterns.some((p) => lowerTitle.includes(p));
  }

  /**
   * Detect MCO from URL
   */
  private detectMCO(url: string): string | undefined {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('upmc')) {
      return 'UPMC';
    }
    if (lowerUrl.includes('amerihealth')) {
      return 'AmeriHealth Caritas';
    }
    if (lowerUrl.includes('pahealthwellness')) {
      return 'PA Health & Wellness';
    }

    return this.mcoName;
  }
}

/**
 * Factory function to create the appropriate CHC scraper
 */
export function createCHCScraper(
  sourceType: SourceType,
  options: ScraperOptions = {},
  mcoName?: string
): BaseScraper {
  switch (sourceType) {
    case 'chc_publications':
      return new CHCPublicationsScraper(options);
    case 'chc_handbook':
      return new CHCHandbookScraper(options, mcoName);
    default:
      throw new Error(`Unsupported CHC source type: ${sourceType}`);
  }
}
