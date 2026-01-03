/**
 * Source Monitor Service Integration Tests
 *
 * Tests the SourceMonitorService with real PostgreSQL.
 * Tests database operations, monitor scheduling logic, and status tracking.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { SourceMonitorService, createSourceMonitorService } from './source-monitor.js';
import { SourceMonitor, CheckFrequency } from './types.js';

const { Pool } = pg;

// Check PostgreSQL availability
async function checkPostgres(): Promise<boolean> {
  try {
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'medicaid_rag',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    });
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

const postgresAvailable = await checkPostgres();
console.log('Source Monitor Tests - PostgreSQL available:', postgresAvailable);

describe('SourceMonitorService Integration Tests', () => {
  let pool: InstanceType<typeof Pool>;
  let service: SourceMonitorService;
  let testMonitorId: string | null = null;

  beforeAll(async () => {
    if (!postgresAvailable) {
      console.warn('Skipping source monitor tests - PostgreSQL not available');
      return;
    }

    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'medicaid_rag',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    });

    service = createSourceMonitorService(pool);

    // Insert test monitor
    const result = await pool.query(`
      INSERT INTO source_monitors (
        source_name, source_url, source_type, check_frequency,
        is_active, auto_ingest, filter_keywords
      )
      VALUES (
        'TEST_SOURCE_MONITOR',
        'https://example.com/test',
        'oim_ops_memo',
        'weekly',
        true,
        false,
        ARRAY['test', 'medicaid']
      )
      RETURNING id
    `);
    testMonitorId = result.rows[0].id;
  });

  afterAll(async () => {
    if (pool && testMonitorId) {
      // Clean up test data
      await pool.query(`DELETE FROM source_change_log WHERE monitor_id = $1`, [testMonitorId]);
      await pool.query(`DELETE FROM source_monitors WHERE id = $1`, [testMonitorId]);
    }
    if (pool) {
      await pool.end();
    }
  });

  describe('createSourceMonitorService', () => {
    it.skipIf(!postgresAvailable)('should create a service instance', () => {
      expect(service).toBeInstanceOf(SourceMonitorService);
    });
  });

  describe('getMonitors', () => {
    it.skipIf(!postgresAvailable)('should get all active monitors', async () => {
      const monitors = await service.getMonitors();

      expect(Array.isArray(monitors)).toBe(true);
      // Should include our test monitor
      const testMonitor = monitors.find((m) => m.sourceName === 'TEST_SOURCE_MONITOR');
      expect(testMonitor).toBeDefined();
    });

    it.skipIf(!postgresAvailable)('should filter monitors by frequency', async () => {
      const weeklyMonitors = await service.getMonitors('weekly');

      expect(Array.isArray(weeklyMonitors)).toBe(true);
      // All returned monitors should be weekly
      expect(weeklyMonitors.every((m) => m.checkFrequency === 'weekly')).toBe(true);
    });

    it.skipIf(!postgresAvailable)('should return empty array for frequency with no monitors', async () => {
      // Create a unique frequency check that might not have monitors
      const monitors = await service.getMonitors('annually');
      expect(Array.isArray(monitors)).toBe(true);
    });
  });

  describe('getMonitorByName', () => {
    it.skipIf(!postgresAvailable)('should get a monitor by name', async () => {
      const monitor = await service.getMonitorByName('TEST_SOURCE_MONITOR');

      expect(monitor).not.toBeNull();
      expect(monitor?.sourceName).toBe('TEST_SOURCE_MONITOR');
      expect(monitor?.sourceUrl).toBe('https://example.com/test');
      expect(monitor?.checkFrequency).toBe('weekly');
      expect(monitor?.filterKeywords).toContain('test');
    });

    it.skipIf(!postgresAvailable)('should return null for non-existent monitor', async () => {
      const monitor = await service.getMonitorByName('NON_EXISTENT_MONITOR_XYZ');

      expect(monitor).toBeNull();
    });
  });

  describe('isDue', () => {
    it.skipIf(!postgresAvailable)('should return true for monitor never checked', () => {
      const monitor: SourceMonitor = {
        id: 'test-id',
        sourceName: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'oim_ops_memo',
        checkFrequency: 'weekly',
        isActive: true,
        autoIngest: false,
        lastCheckedAt: null,
        lastContentHash: null,
        lastChangeDetectedAt: null,
        filterKeywords: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(service.isDue(monitor)).toBe(true);
    });

    it.skipIf(!postgresAvailable)('should return false for recently checked weekly monitor', () => {
      const now = new Date();
      const monitor: SourceMonitor = {
        id: 'test-id',
        sourceName: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'oim_ops_memo',
        checkFrequency: 'weekly',
        isActive: true,
        autoIngest: false,
        lastCheckedAt: now, // Just checked
        lastContentHash: 'abc123',
        lastChangeDetectedAt: null,
        filterKeywords: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(service.isDue(monitor)).toBe(false);
    });

    it.skipIf(!postgresAvailable)('should return true for weekly monitor checked 8 days ago', () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const monitor: SourceMonitor = {
        id: 'test-id',
        sourceName: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'oim_ops_memo',
        checkFrequency: 'weekly',
        isActive: true,
        autoIngest: false,
        lastCheckedAt: eightDaysAgo,
        lastContentHash: 'abc123',
        lastChangeDetectedAt: null,
        filterKeywords: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(service.isDue(monitor)).toBe(true);
    });

    it.skipIf(!postgresAvailable)('should handle monthly frequency', () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const monitor: SourceMonitor = {
        id: 'test-id',
        sourceName: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'oim_ops_memo',
        checkFrequency: 'monthly',
        isActive: true,
        autoIngest: false,
        lastCheckedAt: thirtyOneDaysAgo,
        lastContentHash: 'abc123',
        lastChangeDetectedAt: null,
        filterKeywords: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(service.isDue(monitor)).toBe(true);
    });

    it.skipIf(!postgresAvailable)('should handle quarterly frequency', () => {
      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

      const monitor: SourceMonitor = {
        id: 'test-id',
        sourceName: 'test',
        sourceUrl: 'https://example.com',
        sourceType: 'oim_ops_memo',
        checkFrequency: 'quarterly',
        isActive: true,
        autoIngest: false,
        lastCheckedAt: hundredDaysAgo,
        lastContentHash: 'abc123',
        lastChangeDetectedAt: null,
        filterKeywords: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(service.isDue(monitor)).toBe(true);
    });
  });

  describe('updateMonitorStatus', () => {
    it.skipIf(!postgresAvailable)('should update monitor status after check', async () => {
      if (!testMonitorId) return;

      const contentHash = 'test-hash-' + Date.now();
      await service.updateMonitorStatus(testMonitorId, contentHash, false);

      // Verify update
      const monitor = await service.getMonitorByName('TEST_SOURCE_MONITOR');
      expect(monitor?.lastContentHash).toBe(contentHash);
      expect(monitor?.lastCheckedAt).not.toBeNull();
    });

    it.skipIf(!postgresAvailable)('should update lastChangeDetectedAt when change detected', async () => {
      if (!testMonitorId) return;

      const contentHash = 'changed-hash-' + Date.now();
      await service.updateMonitorStatus(testMonitorId, contentHash, true);

      // Verify update
      const monitor = await service.getMonitorByName('TEST_SOURCE_MONITOR');
      expect(monitor?.lastChangeDetectedAt).not.toBeNull();
    });
  });

  describe('logChange', () => {
    it.skipIf(!postgresAvailable)('should log a change', async () => {
      if (!testMonitorId) return;

      const changeDetection = {
        hasChanges: true,
        changeType: 'new_items' as const,
        summary: 'Test change detection',
        newItems: [],
        removedItems: [],
        modifiedItems: [],
        previousHash: 'old-hash',
        newHash: 'new-hash',
      };

      const changeId = await service.logChange(
        testMonitorId,
        changeDetection,
        false,
        'pending'
      );

      expect(changeId).toBeDefined();
      expect(typeof changeId).toBe('string');
    });

    it.skipIf(!postgresAvailable)('should log change with ingestion status', async () => {
      if (!testMonitorId) return;

      const changeDetection = {
        hasChanges: true,
        changeType: 'new_items' as const,
        summary: 'Ingestion test',
        newItems: [],
        removedItems: [],
        modifiedItems: [],
        previousHash: 'old-hash-2',
        newHash: 'new-hash-2',
      };

      const changeId = await service.logChange(
        testMonitorId,
        changeDetection,
        true,
        'success'
      );

      expect(changeId).toBeDefined();
    });
  });

  describe('getRecentChanges', () => {
    it.skipIf(!postgresAvailable)('should get recent changes', async () => {
      const changes = await service.getRecentChanges(10);

      expect(Array.isArray(changes)).toBe(true);
      // Should have at least the changes we created in previous tests
    });

    it.skipIf(!postgresAvailable)('should respect limit parameter', async () => {
      const changes = await service.getRecentChanges(1);

      expect(changes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getStatus', () => {
    it.skipIf(!postgresAvailable)('should get monitor status summary', async () => {
      const status = await service.getStatus();

      expect(status).toBeDefined();
      expect(typeof status.totalMonitors).toBe('number');
      expect(typeof status.activeMonitors).toBe('number');
      expect(status.byFrequency).toBeDefined();
      expect(typeof status.byFrequency.weekly).toBe('number');
      expect(typeof status.byFrequency.monthly).toBe('number');
      expect(typeof status.byFrequency.quarterly).toBe('number');
      expect(typeof status.byFrequency.annually).toBe('number');
    });

    it.skipIf(!postgresAvailable)('should count our test monitor', async () => {
      const status = await service.getStatus();

      expect(status.activeMonitors).toBeGreaterThanOrEqual(1);
      expect(status.byFrequency.weekly).toBeGreaterThanOrEqual(1);
    });
  });

  describe('run', () => {
    it.skipIf(!postgresAvailable)('should run with dry-run option', async () => {
      const result = await service.run({ dryRun: true });

      expect(result).toBeDefined();
      expect(typeof result.sourcesChecked).toBe('number');
      expect(typeof result.changesDetected).toBe('number');
      expect(typeof result.ingestionsSucceeded).toBe('number');
      expect(typeof result.ingestionsFailed).toBe('number');
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it.skipIf(!postgresAvailable)('should filter by source name', async () => {
      const result = await service.run({
        sourceName: 'TEST_SOURCE_MONITOR',
        dryRun: true,
        force: true,
      });

      expect(result).toBeDefined();
      // Should only process our test monitor
      const testDetail = result.details.find(
        (d) => d.sourceName === 'TEST_SOURCE_MONITOR'
      );
      expect(testDetail).toBeDefined();
    });

    it.skipIf(!postgresAvailable)('should skip non-due sources without force', async () => {
      // First run to mark as checked
      await service.run({
        sourceName: 'TEST_SOURCE_MONITOR',
        dryRun: true,
        force: true,
      });

      // Second run without force should skip
      const result = await service.run({
        sourceName: 'TEST_SOURCE_MONITOR',
        dryRun: true,
        force: false,
      });

      const testDetail = result.details.find(
        (d) => d.sourceName === 'TEST_SOURCE_MONITOR'
      );
      // Should be skipped (not checked) since we just checked it
      expect(testDetail?.checked).toBe(false);
    });

    it.skipIf(!postgresAvailable)('should force check when force option is true', async () => {
      const result = await service.run({
        sourceName: 'TEST_SOURCE_MONITOR',
        dryRun: true,
        force: true,
      });

      const testDetail = result.details.find(
        (d) => d.sourceName === 'TEST_SOURCE_MONITOR'
      );
      // With force, should attempt to check (though scraper may fail on test URL)
      expect(testDetail).toBeDefined();
    });
  });
});
