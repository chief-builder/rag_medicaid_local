import { Pool } from 'pg';
import {
  SourceMonitor,
  SourceChangeLog,
  CheckFrequency,
  ChangeDetection,
} from './types.js';

/**
 * Repository for source monitor database operations
 */
export class MonitorRepository {
  constructor(private pool: Pool) {}

  /**
   * Get all active monitors, optionally filtered by frequency
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
   * Get monitor status summary
   */
  async getStatus(): Promise<{
    totalMonitors: number;
    activeMonitors: number;
    byFrequency: Record<CheckFrequency, number>;
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
}

/**
 * Create a monitor repository instance
 */
export function createMonitorRepository(pool: Pool): MonitorRepository {
  return new MonitorRepository(pool);
}
