/**
 * Database Migration Integration Tests
 *
 * Tests the database migration script with real PostgreSQL.
 * These tests spawn the migrate script and verify it runs correctly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { checkTestServices, createTestConfig } from '../helpers/test-db.js';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Check services availability
const services = await checkTestServices();
console.log('DB Migrate Tests - Available services:', services);

// Helper to run the migration script
function runMigrate(timeout = 60000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'src/db/migrate.ts'], {
      cwd: projectRoot,
      env: { ...process.env },
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Migration timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('Database Migration Integration Tests', () => {
  let pool: InstanceType<typeof Pool>;

  beforeAll(async () => {
    if (!services.postgres) {
      console.warn('Skipping DB migration tests - PostgreSQL not available');
      return;
    }

    const config = createTestConfig();
    pool = new Pool(config.postgres);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('Migration Execution', () => {
    it.skipIf(!services.postgres)('should run migrations successfully', async () => {
      const result = await runMigrate();

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Running database migrations');
      expect(result.stdout).toContain('Migrations completed successfully');
    }, 90000);

    it.skipIf(!services.postgres)('should show created tables', async () => {
      const result = await runMigrate();

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Created tables:');
      expect(result.stdout).toContain('documents');
      expect(result.stdout).toContain('chunks');
    }, 90000);
  });

  describe('Table Verification', () => {
    it.skipIf(!services.postgres)('should create documents table with correct columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'documents'
        ORDER BY ordinal_position;
      `);

      const columnNames = result.rows.map((r) => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('filename');
      expect(columnNames).toContain('filepath');
      expect(columnNames).toContain('file_hash');
      expect(columnNames).toContain('title');
    });

    it.skipIf(!services.postgres)('should create chunks table with correct columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'chunks'
        ORDER BY ordinal_position;
      `);

      const columnNames = result.rows.map((r) => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('document_id');
      expect(columnNames).toContain('chunk_index');
      expect(columnNames).toContain('content');
    });

    it.skipIf(!services.postgres)('should create query_cache table', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'query_cache'
        ORDER BY ordinal_position;
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      const columnNames = result.rows.map((r) => r.column_name);
      expect(columnNames).toContain('query_text');
    });

    it.skipIf(!services.postgres)('should create query_logs table', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'query_logs'
        ORDER BY ordinal_position;
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it.skipIf(!services.postgres)('should create source_monitors table', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'source_monitors'
        ORDER BY ordinal_position;
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      const columnNames = result.rows.map((r) => r.column_name);
      expect(columnNames).toContain('source_name');
      expect(columnNames).toContain('source_url');
    });
  });

  describe('Idempotency', () => {
    it.skipIf(!services.postgres)('should be idempotent (can run multiple times)', async () => {
      // Run migration twice
      const result1 = await runMigrate();
      const result2 = await runMigrate();

      expect(result1.code).toBe(0);
      expect(result2.code).toBe(0);
      expect(result2.stdout).toContain('Migrations completed successfully');
    }, 120000);
  });
});
