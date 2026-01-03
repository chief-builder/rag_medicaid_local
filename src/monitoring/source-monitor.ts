import { Pool } from 'pg';
import { createChildLogger } from '../utils/logger.js';
import {
  SourceMonitor,
  SourceChangeLog,
  SourceType,
  CheckFrequency,
  MonitorRunOptions,
  MonitorRunResult,
  MonitorSourceResult,
  ScraperResult,
  ChangeDetection,
} from './types.js';
import { BaseScraper, ScraperOptions } from './scrapers/base-scraper.js';
import { createOIMScraper } from './scrapers/oim-scraper.js';
import { createPAScraper } from './scrapers/pa-bulletin-scraper.js';
import { createCHCScraper } from './scrapers/chc-scraper.js';
import { IngestionPipeline, createIngestionPipeline } from '../ingestion/pipeline.js';
import { Config, DocumentType, LegalWeight } from '../types/index.js';

const logger = createChildLogger('source-monitor');

/**
 * Service for monitoring source changes and triggering ingestion
 */
export class SourceMonitorService {
  private pool: Pool;
  private scrapers: Map<SourceType, BaseScraper> = new Map();
  private ingestionPipeline: IngestionPipeline | null = null;

  constructor(pool: Pool, config?: Config) {
    this.pool = pool;
    if (config) {
      this.ingestionPipeline = createIngestionPipeline(config);
    }
    this.initializeScrapers();
  }

  /**
   * Initialize scrapers for each source type
   */
  private initializeScrapers(): void {
    this.scrapers.set('oim_ops_memo', createOIMScraper('oim_ops_memo'));
    this.scrapers.set('oim_policy_clarification', createOIMScraper('oim_policy_clarification'));
    this.scrapers.set('oim_handbook', createOIMScraper('oim_handbook'));
    this.scrapers.set('pa_bulletin', createPAScraper('pa_bulletin'));
    this.scrapers.set('pa_code', createPAScraper('pa_code'));
    // Phase 3: CHC Managed Care scrapers
    this.scrapers.set('chc_publications', createCHCScraper('chc_publications'));
    this.scrapers.set('chc_handbook', createCHCScraper('chc_handbook'));
  }

  /**
   * Get a scraper for a source type, optionally with custom options
   */
  private getScraper(sourceType: SourceType, options?: ScraperOptions): BaseScraper {
    if (options) {
      // Create a new scraper with custom options
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

    const scraper = this.scrapers.get(sourceType);
    if (!scraper) {
      throw new Error(`No scraper found for source type: ${sourceType}`);
    }
    return scraper;
  }

  /**
   * Get all active monitors
   */
  async getMonitors(frequency?: CheckFrequency): Promise<SourceMonitor[]> {
    let query = `
      SELECT
        id, source_name as "sourceName", source_url as "sourceUrl",
        source_type as "sourceType", check_frequency as "checkFrequency",
        last_checked_at as "lastCheckedAt", last_content_hash as "lastContentHash",
        last_change_detected_at as "lastChangeDetectedAt", is_active as "isActive",
        auto_ingest as "autoIngest", filter_keywords as "filterKeywords",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM source_monitors
      WHERE is_active = true
    `;
    const params: (string | CheckFrequency)[] = [];

    if (frequency) {
      query += ` AND check_frequency = $1`;
      params.push(frequency);
    }

    query += ` ORDER BY source_name`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get a specific monitor by name
   */
  async getMonitorByName(sourceName: string): Promise<SourceMonitor | null> {
    const result = await this.pool.query(
      `
      SELECT
        id, source_name as "sourceName", source_url as "sourceUrl",
        source_type as "sourceType", check_frequency as "checkFrequency",
        last_checked_at as "lastCheckedAt", last_content_hash as "lastContentHash",
        last_change_detected_at as "lastChangeDetectedAt", is_active as "isActive",
        auto_ingest as "autoIngest", filter_keywords as "filterKeywords",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM source_monitors
      WHERE source_name = $1
      `,
      [sourceName]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if a monitor is due for checking based on its frequency
   */
  isDue(monitor: SourceMonitor): boolean {
    if (!monitor.lastCheckedAt) {
      return true; // Never checked
    }

    const now = new Date();
    const lastChecked = new Date(monitor.lastCheckedAt);
    const hoursSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);

    switch (monitor.checkFrequency) {
      case 'weekly':
        return hoursSinceCheck >= 7 * 24; // 7 days
      case 'monthly':
        return hoursSinceCheck >= 30 * 24; // 30 days
      case 'quarterly':
        return hoursSinceCheck >= 90 * 24; // 90 days
      case 'annually':
        return hoursSinceCheck >= 365 * 24; // 365 days
      default:
        return true;
    }
  }

  /**
   * Check a single source for changes
   */
  async checkSource(monitor: SourceMonitor): Promise<{
    result: ScraperResult;
    changeDetection: ChangeDetection;
  }> {
    logger.info(
      { sourceName: monitor.sourceName, sourceUrl: monitor.sourceUrl },
      'Checking source for changes'
    );

    // Get the appropriate scraper
    const scraperOptions: ScraperOptions = {};
    if (monitor.filterKeywords) {
      scraperOptions.filterKeywords = monitor.filterKeywords;
    }

    const scraper = this.getScraper(monitor.sourceType as SourceType, scraperOptions);

    // Scrape the current content
    const result = await scraper.scrape(monitor.sourceUrl);

    // Create a "previous" result from stored data for comparison
    const previousResult: ScraperResult | null = monitor.lastContentHash
      ? {
          contentHash: monitor.lastContentHash,
          content: '', // We don't store full content
          items: [], // We could store previous items in DB if needed
          metadata: {
            scrapedAt: monitor.lastCheckedAt || new Date(),
            sourceUrl: monitor.sourceUrl,
            httpStatus: 200,
          },
        }
      : null;

    // Detect changes
    const changeDetection = scraper.detectChanges(previousResult, result);

    logger.info(
      {
        sourceName: monitor.sourceName,
        hasChanges: changeDetection.hasChanges,
        changeType: changeDetection.changeType,
        newItems: changeDetection.newItems.length,
      },
      'Change detection complete'
    );

    return { result, changeDetection };
  }

  /**
   * Update monitor status after checking
   */
  async updateMonitorStatus(
    monitorId: string,
    contentHash: string,
    changeDetected: boolean
  ): Promise<void> {
    const now = new Date();

    await this.pool.query(
      `
      UPDATE source_monitors
      SET
        last_checked_at = $2,
        last_content_hash = $3,
        last_change_detected_at = CASE WHEN $4 THEN $2 ELSE last_change_detected_at END,
        updated_at = $2
      WHERE id = $1
      `,
      [monitorId, now, contentHash, changeDetected]
    );
  }

  /**
   * Log a detected change
   */
  async logChange(
    monitorId: string,
    changeDetection: ChangeDetection,
    autoIngested: boolean = false,
    ingestionStatus: string = 'pending',
    ingestionError?: string
  ): Promise<string> {
    const result = await this.pool.query(
      `
      INSERT INTO source_change_log (
        monitor_id, previous_hash, new_hash, change_summary,
        items_added, items_removed, auto_ingested, ingestion_status, ingestion_error
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
      `,
      [
        monitorId,
        changeDetection.previousHash,
        changeDetection.newHash,
        changeDetection.summary,
        changeDetection.newItems.length,
        changeDetection.removedItems.length,
        autoIngested,
        ingestionStatus,
        ingestionError,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get recent change logs
   */
  async getRecentChanges(limit: number = 20): Promise<SourceChangeLog[]> {
    const result = await this.pool.query(
      `
      SELECT
        cl.id, cl.monitor_id as "monitorId", cl.detected_at as "detectedAt",
        cl.previous_hash as "previousHash", cl.new_hash as "newHash",
        cl.change_summary as "changeSummary", cl.items_added as "itemsAdded",
        cl.items_removed as "itemsRemoved", cl.auto_ingested as "autoIngested",
        cl.ingestion_status as "ingestionStatus", cl.ingestion_error as "ingestionError",
        sm.source_name as "sourceName"
      FROM source_change_log cl
      JOIN source_monitors sm ON sm.id = cl.monitor_id
      ORDER BY cl.detected_at DESC
      LIMIT $1
      `,
      [limit]
    );
    return result.rows;
  }

  /**
   * Run the monitor check on all due sources
   */
  async run(options: MonitorRunOptions = {}): Promise<MonitorRunResult> {
    const startedAt = new Date();
    const details: MonitorSourceResult[] = [];

    let sourcesChecked = 0;
    let changesDetected = 0;
    let ingestionsSucceeded = 0;
    let ingestionsFailed = 0;

    // Get monitors to check
    let monitors = await this.getMonitors(options.frequency);

    // Filter to specific source if requested
    if (options.sourceName) {
      monitors = monitors.filter((m) => m.sourceName === options.sourceName);
    }

    logger.info(
      { monitorCount: monitors.length, options },
      'Starting monitor run'
    );

    for (const monitor of monitors) {
      // Check if due (unless forced)
      if (!options.force && !this.isDue(monitor)) {
        logger.debug(
          { sourceName: monitor.sourceName, lastChecked: monitor.lastCheckedAt },
          'Skipping - not due for check'
        );
        details.push({
          sourceName: monitor.sourceName,
          sourceUrl: monitor.sourceUrl,
          checked: false,
          hasChanges: false,
          ingested: false,
        });
        continue;
      }

      try {
        // Check the source
        const { result, changeDetection } = await this.checkSource(monitor);
        sourcesChecked++;

        // Update monitor status
        await this.updateMonitorStatus(
          monitor.id,
          result.contentHash,
          changeDetection.hasChanges
        );

        if (changeDetection.hasChanges) {
          changesDetected++;

          // Log the change
          let ingestionStatus = 'pending';
          let ingestionError: string | undefined;
          let ingested = false;

          // Auto-ingest if enabled and not a dry run
          if (monitor.autoIngest && !options.dryRun) {
            try {
              if (!this.ingestionPipeline) {
                logger.warn(
                  { sourceName: monitor.sourceName },
                  'Ingestion pipeline not configured, skipping auto-ingest'
                );
                ingestionStatus = 'skipped';
              } else if (changeDetection.newItems.length > 0) {
                // Map source type to document type and legal weight
                const { documentType, legalWeight } = this.mapSourceTypeToDocumentType(
                  monitor.sourceType
                );

                // Ingest the new items
                const ingestionStats = await this.ingestionPipeline.ingestScrapedItems(
                  changeDetection.newItems,
                  documentType,
                  'primary',
                  legalWeight
                );

                if (ingestionStats.errors.length > 0) {
                  ingestionStatus = 'failed';
                  ingestionError = ingestionStats.errors.join('; ');
                  ingestionsFailed++;
                } else {
                  ingestionStatus = 'success';
                  ingested = true;
                  ingestionsSucceeded++;
                }

                logger.info(
                  {
                    sourceName: monitor.sourceName,
                    processed: ingestionStats.documentsProcessed,
                    skipped: ingestionStats.documentsSkipped,
                    chunks: ingestionStats.chunksCreated,
                    errors: ingestionStats.errors.length,
                  },
                  'Ingested new items from source'
                );
              } else {
                ingestionStatus = 'skipped';
                logger.debug(
                  { sourceName: monitor.sourceName },
                  'No new items to ingest'
                );
              }
            } catch (error) {
              ingestionStatus = 'failed';
              ingestionError = error instanceof Error ? error.message : String(error);
              ingestionsFailed++;
            }
          }

          await this.logChange(
            monitor.id,
            changeDetection,
            ingested,
            ingestionStatus,
            ingestionError
          );

          details.push({
            sourceName: monitor.sourceName,
            sourceUrl: monitor.sourceUrl,
            checked: true,
            hasChanges: true,
            changeDetection,
            ingested,
            ingestionStatus: ingestionStatus as 'pending' | 'success' | 'failed' | 'skipped',
            error: ingestionError,
          });
        } else {
          details.push({
            sourceName: monitor.sourceName,
            sourceUrl: monitor.sourceUrl,
            checked: true,
            hasChanges: false,
            changeDetection,
            ingested: false,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          { sourceName: monitor.sourceName, error: errorMessage },
          'Error checking source'
        );

        details.push({
          sourceName: monitor.sourceName,
          sourceUrl: monitor.sourceUrl,
          checked: false,
          hasChanges: false,
          ingested: false,
          error: errorMessage,
        });
      }
    }

    const completedAt = new Date();

    logger.info(
      {
        sourcesChecked,
        changesDetected,
        ingestionsSucceeded,
        ingestionsFailed,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
      'Monitor run complete'
    );

    return {
      sourcesChecked,
      changesDetected,
      ingestionsSucceeded,
      ingestionsFailed,
      details,
      startedAt,
      completedAt,
    };
  }

  /**
   * Get monitor status summary
   */
  async getStatus(): Promise<{
    totalMonitors: number;
    activeMonitors: number;
    byFrequency: Record<CheckFrequency, number>;
    lastRunResults?: MonitorRunResult;
  }> {
    const countResult = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) as total
      FROM source_monitors
    `);

    const freqResult = await this.pool.query(`
      SELECT check_frequency, COUNT(*) as count
      FROM source_monitors
      WHERE is_active = true
      GROUP BY check_frequency
    `);

    const byFrequency: Record<CheckFrequency, number> = {
      weekly: 0,
      monthly: 0,
      quarterly: 0,
      annually: 0,
    };

    for (const row of freqResult.rows) {
      byFrequency[row.check_frequency as CheckFrequency] = parseInt(row.count, 10);
    }

    return {
      totalMonitors: parseInt(countResult.rows[0].total, 10),
      activeMonitors: parseInt(countResult.rows[0].active, 10),
      byFrequency,
    };
  }

  /**
   * Map source type to document type and legal weight for ingestion
   */
  private mapSourceTypeToDocumentType(sourceType: SourceType): {
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
 * Create a source monitor service instance
 */
export function createSourceMonitorService(
  pool: Pool,
  config?: Config
): SourceMonitorService {
  return new SourceMonitorService(pool, config);
}
