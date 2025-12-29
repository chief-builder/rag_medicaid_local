#!/usr/bin/env node

import { Command } from 'commander';
import { Pool } from 'pg';
import { getConfig } from '../config/index.js';
import { createSourceMonitorService } from '../monitoring/index.js';
import { CheckFrequency } from '../monitoring/types.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('monitor-cli');

const program = new Command();

program
  .name('monitor')
  .description('Pennsylvania Medicaid source monitoring CLI')
  .version('1.0.0');

/**
 * List all monitors
 */
program
  .command('list')
  .description('List all source monitors')
  .option('-f, --frequency <freq>', 'Filter by frequency (weekly, monthly, quarterly, annually)')
  .action(async (options) => {
    const config = getConfig();
    const pool = new Pool(config.postgres);

    try {
      const service = createSourceMonitorService(pool);
      const monitors = await service.getMonitors(options.frequency as CheckFrequency);

      console.log('\n📋 Source Monitors\n');
      console.log('━'.repeat(80));

      if (monitors.length === 0) {
        console.log('No monitors found.');
      } else {
        for (const monitor of monitors) {
          const lastChecked = monitor.lastCheckedAt
            ? new Date(monitor.lastCheckedAt).toLocaleString()
            : 'Never';
          const isDue = service.isDue(monitor) ? '⚠️  Due' : '✓ Current';

          console.log(`\n📡 ${monitor.sourceName}`);
          console.log(`   Type: ${monitor.sourceType}`);
          console.log(`   URL: ${monitor.sourceUrl}`);
          console.log(`   Frequency: ${monitor.checkFrequency}`);
          console.log(`   Last checked: ${lastChecked}`);
          console.log(`   Status: ${isDue}`);
          if (monitor.filterKeywords?.length) {
            console.log(`   Filters: ${monitor.filterKeywords.join(', ')}`);
          }
        }
      }

      console.log('\n' + '━'.repeat(80));
    } catch (error) {
      logger.error({ error }, 'Failed to list monitors');
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

/**
 * Check sources for changes
 */
program
  .command('check')
  .description('Check sources for changes')
  .option('-f, --frequency <freq>', 'Only check sources with this frequency')
  .option('-s, --source <name>', 'Only check a specific source by name')
  .option('--force', 'Force check even if not due', false)
  .option('--dry-run', 'Don\'t actually ingest changes', false)
  .action(async (options) => {
    const config = getConfig();
    const pool = new Pool(config.postgres);

    try {
      const service = createSourceMonitorService(pool);

      console.log('\n🔍 Checking sources for changes...\n');

      const result = await service.run({
        frequency: options.frequency as CheckFrequency,
        sourceName: options.source,
        force: options.force,
        dryRun: options.dryRun,
      });

      console.log('━'.repeat(60));
      console.log('Results:');
      console.log(`  Sources checked: ${result.sourcesChecked}`);
      console.log(`  Changes detected: ${result.changesDetected}`);
      console.log(`  Ingestions succeeded: ${result.ingestionsSucceeded}`);
      console.log(`  Ingestions failed: ${result.ingestionsFailed}`);
      console.log(
        `  Duration: ${result.completedAt.getTime() - result.startedAt.getTime()}ms`
      );
      console.log('━'.repeat(60));

      if (result.details.length > 0) {
        console.log('\nDetails:\n');

        for (const detail of result.details) {
          const icon = detail.hasChanges ? '🔄' : detail.checked ? '✓' : '⏭️';
          const status = detail.error
            ? `❌ ${detail.error}`
            : detail.hasChanges
            ? `Changes: ${detail.changeDetection?.summary || 'detected'}`
            : detail.checked
            ? 'No changes'
            : 'Skipped (not due)';

          console.log(`${icon} ${detail.sourceName}`);
          console.log(`   ${status}`);

          if (detail.changeDetection?.newItems.length) {
            console.log(`   New items: ${detail.changeDetection.newItems.length}`);
            for (const item of detail.changeDetection.newItems.slice(0, 3)) {
              console.log(`     - ${item.title}`);
            }
            if (detail.changeDetection.newItems.length > 3) {
              console.log(`     ... and ${detail.changeDetection.newItems.length - 3} more`);
            }
          }
        }
      }

      console.log('');
    } catch (error) {
      logger.error({ error }, 'Failed to check sources');
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

/**
 * Show recent changes
 */
program
  .command('changes')
  .description('Show recent source changes')
  .option('-n, --limit <number>', 'Number of changes to show', '20')
  .action(async (options) => {
    const config = getConfig();
    const pool = new Pool(config.postgres);

    try {
      const service = createSourceMonitorService(pool);
      const changes = await service.getRecentChanges(parseInt(options.limit, 10));

      console.log('\n📝 Recent Source Changes\n');
      console.log('━'.repeat(80));

      if (changes.length === 0) {
        console.log('No changes recorded.');
      } else {
        for (const change of changes) {
          const date = new Date(change.detectedAt).toLocaleString();
          const status =
            change.ingestionStatus === 'success'
              ? '✓'
              : change.ingestionStatus === 'failed'
              ? '❌'
              : '⏳';

          console.log(`\n${status} ${(change as unknown as { sourceName: string }).sourceName}`);
          console.log(`   Date: ${date}`);
          console.log(`   Summary: ${change.changeSummary}`);
          console.log(`   Items added: ${change.itemsAdded}, removed: ${change.itemsRemoved}`);
          console.log(`   Ingestion: ${change.ingestionStatus}`);
          if (change.ingestionError) {
            console.log(`   Error: ${change.ingestionError}`);
          }
        }
      }

      console.log('\n' + '━'.repeat(80));
    } catch (error) {
      logger.error({ error }, 'Failed to get changes');
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

/**
 * Show monitor status summary
 */
program
  .command('status')
  .description('Show monitor status summary')
  .action(async () => {
    const config = getConfig();
    const pool = new Pool(config.postgres);

    try {
      const service = createSourceMonitorService(pool);
      const status = await service.getStatus();

      console.log('\n📊 Monitor Status\n');
      console.log('━'.repeat(40));
      console.log(`Total monitors: ${status.totalMonitors}`);
      console.log(`Active monitors: ${status.activeMonitors}`);
      console.log('\nBy frequency:');
      console.log(`  Weekly: ${status.byFrequency.weekly}`);
      console.log(`  Monthly: ${status.byFrequency.monthly}`);
      console.log(`  Quarterly: ${status.byFrequency.quarterly}`);
      console.log(`  Annually: ${status.byFrequency.annually}`);
      console.log('━'.repeat(40));
      console.log('');
    } catch (error) {
      logger.error({ error }, 'Failed to get status');
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

/**
 * Test scraping a source (without saving)
 */
program
  .command('test-scrape <url>')
  .description('Test scraping a URL (does not save results)')
  .option('-t, --type <type>', 'Source type (oim_ops_memo, pa_bulletin, etc.)', 'oim_ops_memo')
  .action(async (url, options) => {
    try {
      const { createOIMScraper, createPAScraper } = await import('../monitoring/index.js');

      let scraper;
      const sourceType = options.type;

      switch (sourceType) {
        case 'oim_ops_memo':
        case 'oim_policy_clarification':
        case 'oim_handbook':
          scraper = createOIMScraper(sourceType);
          break;
        case 'pa_bulletin':
        case 'pa_code':
          scraper = createPAScraper(sourceType);
          break;
        case 'chc_publications':
        case 'chc_handbook': {
          const { createCHCScraper } = await import('../monitoring/index.js');
          scraper = createCHCScraper(sourceType);
          break;
        }
        default:
          console.error(`Unknown source type: ${sourceType}`);
          process.exit(1);
      }

      console.log(`\n🔍 Test scraping ${url}...\n`);
      console.log(`   Source type: ${sourceType}`);
      console.log('━'.repeat(60));

      const result = await scraper.scrape(url);

      console.log(`\n✓ Scrape successful`);
      console.log(`   Content hash: ${result.contentHash.substring(0, 16)}...`);
      console.log(`   Content length: ${result.content.length} chars`);
      console.log(`   Items found: ${result.items?.length || 0}`);
      console.log(`   HTTP status: ${result.metadata.httpStatus}`);

      if (result.items && result.items.length > 0) {
        console.log('\nItems extracted:');
        for (const item of result.items.slice(0, 10)) {
          console.log(`  - ${item.title}`);
          console.log(`    URL: ${item.url}`);
          if (item.date) {
            console.log(`    Date: ${item.date.toLocaleDateString()}`);
          }
        }
        if (result.items.length > 10) {
          console.log(`  ... and ${result.items.length - 10} more items`);
        }
      }

      console.log('\n' + '━'.repeat(60));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
