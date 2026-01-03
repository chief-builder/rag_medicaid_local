/**
 * Source Monitoring Module
 *
 * Provides automated change detection for Pennsylvania Medicaid sources:
 * - OIM Operations Memoranda (weekly)
 * - OIM Policy Clarifications (weekly)
 * - PA Bulletin DHS notices (weekly)
 * - OIM Handbooks (monthly)
 * - PA Code chapters (as-needed)
 */

// Types
export * from './types.js';

// Scrapers
export { BaseScraper } from './scrapers/base-scraper.js';
export type { ScraperOptions } from './scrapers/base-scraper.js';
export {
  OIMOpsMemoScraper,
  OIMPolicyClarificationScraper,
  OIMHandbookScraper,
  createOIMScraper,
} from './scrapers/oim-scraper.js';
export {
  PABulletinScraper,
  PACodeScraper,
  createPAScraper,
} from './scrapers/pa-bulletin-scraper.js';
export {
  CHCPublicationsScraper,
  CHCHandbookScraper,
  createCHCScraper,
} from './scrapers/chc-scraper.js';

// Repository
export { MonitorRepository, createMonitorRepository } from './monitor-repository.js';

// Registry
export { ScraperRegistry, createScraperRegistry } from './scraper-registry.js';

// Service
export { SourceMonitorService, createSourceMonitorService } from './source-monitor.js';
