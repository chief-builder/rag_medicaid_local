import { SourceType } from './types.js';
import { BaseScraper, ScraperOptions } from './scrapers/base-scraper.js';
import { createOIMScraper } from './scrapers/oim-scraper.js';
import { createPAScraper } from './scrapers/pa-bulletin-scraper.js';
import { createCHCScraper } from './scrapers/chc-scraper.js';
import { DocumentType, LegalWeight } from '../types/index.js';

/**
 * Registry for managing scrapers by source type
 */
export class ScraperRegistry {
  private scrapers: Map<SourceType, BaseScraper> = new Map();

  constructor() {
    this.initializeScrapers();
  }

  /**
   * Initialize default scrapers for each source type
   */
  private initializeScrapers(): void {
    this.scrapers.set('oim_ops_memo', createOIMScraper('oim_ops_memo'));
    this.scrapers.set('oim_policy_clarification', createOIMScraper('oim_policy_clarification'));
    this.scrapers.set('oim_handbook', createOIMScraper('oim_handbook'));
    this.scrapers.set('pa_bulletin', createPAScraper('pa_bulletin'));
    this.scrapers.set('pa_code', createPAScraper('pa_code'));
    this.scrapers.set('chc_publications', createCHCScraper('chc_publications'));
    this.scrapers.set('chc_handbook', createCHCScraper('chc_handbook'));
  }

  /**
   * Get a scraper for a source type, optionally with custom options
   */
  getScraper(sourceType: SourceType, options?: ScraperOptions): BaseScraper {
    if (options) {
      return this.createScraperWithOptions(sourceType, options);
    }

    const scraper = this.scrapers.get(sourceType);
    if (!scraper) {
      throw new Error(`No scraper found for source type: ${sourceType}`);
    }
    return scraper;
  }

  /**
   * Create a new scraper instance with custom options
   */
  private createScraperWithOptions(sourceType: SourceType, options: ScraperOptions): BaseScraper {
    switch (sourceType) {
      case 'oim_ops_memo':
      case 'oim_policy_clarification':
      case 'oim_handbook':
        return createOIMScraper(sourceType, options);
      case 'pa_bulletin':
      case 'pa_code':
        return createPAScraper(sourceType as 'pa_bulletin' | 'pa_code', options);
      case 'chc_publications':
      case 'chc_handbook':
        return createCHCScraper(sourceType as 'chc_publications' | 'chc_handbook', options);
      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  /**
   * Map source type to document type and legal weight for ingestion
   */
  static mapSourceTypeToDocumentType(sourceType: SourceType): {
    documentType: DocumentType;
    legalWeight: LegalWeight;
  } {
    switch (sourceType) {
      case 'oim_ops_memo':
        return { documentType: 'oim_ops_memo', legalWeight: 'guidance' };
      case 'oim_policy_clarification':
        return { documentType: 'oim_policy_clarification', legalWeight: 'guidance' };
      case 'oim_handbook':
        return { documentType: 'oim_ltc_handbook', legalWeight: 'guidance' };
      case 'pa_bulletin':
        return { documentType: 'pa_bulletin', legalWeight: 'regulatory' };
      case 'pa_code':
        return { documentType: 'pa_code', legalWeight: 'regulatory' };
      case 'chc_publications':
        return { documentType: 'chc_waiver', legalWeight: 'informational' };
      case 'chc_handbook':
        return { documentType: 'chc_waiver', legalWeight: 'guidance' };
      case 'dhs_page':
        return { documentType: 'general_eligibility', legalWeight: 'informational' };
      default:
        return { documentType: 'general_eligibility', legalWeight: 'informational' };
    }
  }
}

/**
 * Create a scraper registry instance
 */
export function createScraperRegistry(): ScraperRegistry {
  return new ScraperRegistry();
}
