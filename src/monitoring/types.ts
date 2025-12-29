/**
 * Types for source monitoring infrastructure
 */

/**
 * Source types that can be monitored
 */
export type SourceType =
  | 'oim_ops_memo'
  | 'oim_policy_clarification'
  | 'oim_handbook'
  | 'pa_bulletin'
  | 'pa_code'
  | 'dhs_page';

/**
 * Frequency for checking sources
 */
export type CheckFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annually';

/**
 * Status of an ingestion attempt
 */
export type IngestionStatus = 'pending' | 'success' | 'failed' | 'skipped';

/**
 * Source monitor configuration from database
 */
export interface SourceMonitor {
  id: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  checkFrequency: CheckFrequency;
  lastCheckedAt?: Date;
  lastContentHash?: string;
  lastChangeDetectedAt?: Date;
  isActive: boolean;
  autoIngest: boolean;
  filterKeywords?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Log entry for source changes
 */
export interface SourceChangeLog {
  id: string;
  monitorId: string;
  detectedAt: Date;
  previousHash?: string;
  newHash: string;
  changeSummary: string;
  itemsAdded: number;
  itemsRemoved: number;
  autoIngested: boolean;
  ingestionStatus: IngestionStatus;
  ingestionError?: string;
}

/**
 * Result from scraping a source
 */
export interface ScraperResult {
  /** SHA-256 hash of the content for change detection */
  contentHash: string;
  /** Raw content (HTML or text) */
  content: string;
  /** For list pages, individual items found */
  items?: ScrapedItem[];
  /** Metadata about the scrape */
  metadata: {
    scrapedAt: Date;
    sourceUrl: string;
    itemCount?: number;
    /** HTTP response status */
    httpStatus: number;
    /** Content-Type header */
    contentType?: string;
  };
}

/**
 * Individual item from a list page (e.g., ops memo, bulletin notice)
 */
export interface ScrapedItem {
  /** Title or identifier of the item */
  title: string;
  /** URL to the full item */
  url: string;
  /** Date if extractable */
  date?: Date;
  /** Any description or summary */
  description?: string;
  /** Hash of this item's content */
  contentHash?: string;
}

/**
 * Result of comparing two scraper results
 */
export interface ChangeDetection {
  /** Whether changes were detected */
  hasChanges: boolean;
  /** Type of change */
  changeType: 'content_modified' | 'items_added' | 'items_removed' | 'no_change';
  /** Summary of what changed */
  summary: string;
  /** New items added (for list pages) */
  newItems: ScrapedItem[];
  /** Items removed (for list pages) */
  removedItems: ScrapedItem[];
  /** Previous content hash */
  previousHash?: string;
  /** New content hash */
  newHash: string;
}

/**
 * Options for running the monitor
 */
export interface MonitorRunOptions {
  /** Only check sources with this frequency */
  frequency?: CheckFrequency;
  /** Force check even if not due */
  force?: boolean;
  /** Dry run - don't actually ingest */
  dryRun?: boolean;
  /** Only check this specific source */
  sourceName?: string;
}

/**
 * Result of a monitor run
 */
export interface MonitorRunResult {
  /** Sources checked */
  sourcesChecked: number;
  /** Sources with changes detected */
  changesDetected: number;
  /** Sources successfully ingested */
  ingestionsSucceeded: number;
  /** Sources that failed to ingest */
  ingestionsFailed: number;
  /** Details for each source checked */
  details: MonitorSourceResult[];
  /** Time the run started */
  startedAt: Date;
  /** Time the run completed */
  completedAt: Date;
}

/**
 * Result for a single source in a monitor run
 */
export interface MonitorSourceResult {
  sourceName: string;
  sourceUrl: string;
  checked: boolean;
  hasChanges: boolean;
  changeDetection?: ChangeDetection;
  ingested: boolean;
  ingestionStatus?: IngestionStatus;
  error?: string;
}
