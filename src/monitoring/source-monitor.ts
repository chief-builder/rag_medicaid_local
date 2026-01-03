import { Pool } from 'pg';
import { createChildLogger } from '../utils/logger.js';
import {
  SourceMonitor,
  SourceType,
  CheckFrequency,
  MonitorRunOptions,
  MonitorRunResult,
  MonitorSourceResult,
  ScraperResult,
  ChangeDetection,
  SourceChangeLog,
} from './types.js';
import { ScraperOptions } from './scrapers/base-scraper.js';
import { MonitorRepository, createMonitorRepository } from './monitor-repository.js';
import { ScraperRegistry, createScraperRegistry } from './scraper-registry.js';
import { IngestionPipeline, createIngestionPipeline } from '../ingestion/pipeline.js';
import { Config } from '../types/index.js';

const logger = createChildLogger('source-monitor');

/**
 * Service for monitoring source changes and triggering ingestion
 */
export class SourceMonitorService {
  private repository: MonitorRepository;
  private scraperRegistry: ScraperRegistry;
  private ingestionPipeline: IngestionPipeline | null = null;

  constructor(pool: Pool, config?: Config) {
    this.repository = createMonitorRepository(pool);
    this.scraperRegistry = createScraperRegistry();
    if (config) {
      this.ingestionPipeline = createIngestionPipeline(config);
    }
  }

  /**
   * Get all active monitors
   */
  async getMonitors(frequency?: CheckFrequency): Promise<SourceMonitor[]> {
    return this.repository.getMonitors(frequency);
  }

  /**
   * Get a specific monitor by name
   */
  async getMonitorByName(sourceName: string): Promise<SourceMonitor | null> {
    return this.repository.getMonitorByName(sourceName);
  }

  /**
   * Check if a monitor is due for checking based on its frequency
   */
  isDue(monitor: SourceMonitor): boolean {
    if (!monitor.lastCheckedAt) {
      return true;
    }

    const now = new Date();
    const lastChecked = new Date(monitor.lastCheckedAt);
    const hoursSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);

    switch (monitor.checkFrequency) {
      case 'weekly':
        return hoursSinceCheck >= 7 * 24;
      case 'monthly':
        return hoursSinceCheck >= 30 * 24;
      case 'quarterly':
        return hoursSinceCheck >= 90 * 24;
      case 'annually':
        return hoursSinceCheck >= 365 * 24;
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

    const scraperOptions: ScraperOptions = {};
    if (monitor.filterKeywords) {
      scraperOptions.filterKeywords = monitor.filterKeywords;
    }

    const scraper = this.scraperRegistry.getScraper(
      monitor.sourceType as SourceType,
      scraperOptions
    );
    const result = await scraper.scrape(monitor.sourceUrl);

    const previousResult: ScraperResult | null = monitor.lastContentHash
      ? {
          contentHash: monitor.lastContentHash,
          content: '',
          items: [],
          metadata: {
            scrapedAt: monitor.lastCheckedAt || new Date(),
            sourceUrl: monitor.sourceUrl,
            httpStatus: 200,
          },
        }
      : null;

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
    return this.repository.updateMonitorStatus(monitorId, contentHash, changeDetected);
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
    return this.repository.logChange(
      monitorId,
      changeDetection,
      autoIngested,
      ingestionStatus,
      ingestionError
    );
  }

  /**
   * Get recent change logs
   */
  async getRecentChanges(limit: number = 20): Promise<SourceChangeLog[]> {
    return this.repository.getRecentChanges(limit);
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

    let monitors = await this.getMonitors(options.frequency);

    if (options.sourceName) {
      monitors = monitors.filter((m) => m.sourceName === options.sourceName);
    }

    logger.info({ monitorCount: monitors.length, options }, 'Starting monitor run');

    for (const monitor of monitors) {
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
        const { result, changeDetection } = await this.checkSource(monitor);
        sourcesChecked++;

        await this.updateMonitorStatus(monitor.id, result.contentHash, changeDetection.hasChanges);

        if (changeDetection.hasChanges) {
          changesDetected++;
          const ingestionResult = await this.handleIngestion(monitor, changeDetection, options);

          await this.logChange(
            monitor.id,
            changeDetection,
            ingestionResult.ingested,
            ingestionResult.status,
            ingestionResult.error
          );

          if (ingestionResult.status === 'success') ingestionsSucceeded++;
          if (ingestionResult.status === 'failed') ingestionsFailed++;

          details.push({
            sourceName: monitor.sourceName,
            sourceUrl: monitor.sourceUrl,
            checked: true,
            hasChanges: true,
            changeDetection,
            ingested: ingestionResult.ingested,
            ingestionStatus: ingestionResult.status as 'pending' | 'success' | 'failed' | 'skipped',
            error: ingestionResult.error,
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
        logger.error({ sourceName: monitor.sourceName, error: errorMessage }, 'Error checking source');

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
   * Handle ingestion of new items from a change detection
   */
  private async handleIngestion(
    monitor: SourceMonitor,
    changeDetection: ChangeDetection,
    options: MonitorRunOptions
  ): Promise<{ ingested: boolean; status: string; error?: string }> {
    if (!monitor.autoIngest || options.dryRun) {
      return { ingested: false, status: 'pending' };
    }

    if (!this.ingestionPipeline) {
      logger.warn({ sourceName: monitor.sourceName }, 'Ingestion pipeline not configured');
      return { ingested: false, status: 'skipped' };
    }

    if (changeDetection.newItems.length === 0) {
      logger.debug({ sourceName: monitor.sourceName }, 'No new items to ingest');
      return { ingested: false, status: 'skipped' };
    }

    try {
      const { documentType, legalWeight } = ScraperRegistry.mapSourceTypeToDocumentType(
        monitor.sourceType as SourceType
      );

      const ingestionStats = await this.ingestionPipeline.ingestScrapedItems(
        changeDetection.newItems,
        documentType,
        'primary',
        legalWeight
      );

      if (ingestionStats.errors.length > 0) {
        return {
          ingested: false,
          status: 'failed',
          error: ingestionStats.errors.join('; '),
        };
      }

      logger.info(
        {
          sourceName: monitor.sourceName,
          processed: ingestionStats.documentsProcessed,
          skipped: ingestionStats.documentsSkipped,
          chunks: ingestionStats.chunksCreated,
        },
        'Ingested new items from source'
      );

      return { ingested: true, status: 'success' };
    } catch (error) {
      return {
        ingested: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    return this.repository.getStatus();
  }
}

/**
 * Create a source monitor service instance
 */
export function createSourceMonitorService(pool: Pool, config?: Config): SourceMonitorService {
  return new SourceMonitorService(pool, config);
}
