/**
 * CLI Ingest Integration Tests
 *
 * Tests the ingest CLI commands with real services:
 * - PostgreSQL for document storage
 * - Qdrant for vector storage
 * - LM Studio for embeddings
 *
 * These tests spawn the CLI as a child process and verify output.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkTestServices, createTestConfig } from '../helpers/test-db.js';
import { PostgresStore } from '../../src/clients/postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Check services availability
const services = await checkTestServices();
const allServicesAvailable = services.postgres && services.qdrant && services.lmStudio;
console.log('CLI Ingest Tests - Available services:', services);

// Helper to run CLI commands
function runCli(args: string[], timeout = 120000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Quote arguments with spaces to preserve them through shell
    const quotedArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg));
    const child = spawn('npx', ['tsx', 'src/cli/ingest.ts', ...quotedArgs], {
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
      reject(new Error(`CLI command timed out after ${timeout}ms`));
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

describe('CLI Ingest Integration Tests', () => {
  let postgresStore: PostgresStore;
  let testDocumentId: string | null = null;

  beforeAll(async () => {
    if (!allServicesAvailable) {
      console.warn('Skipping CLI ingest tests - not all services available');
      return;
    }

    const config = createTestConfig();
    postgresStore = new PostgresStore(config.postgres);
  });

  afterAll(async () => {
    // Clean up test document if created
    if (testDocumentId && postgresStore) {
      try {
        await postgresStore.query(`DELETE FROM chunks WHERE document_id = $1`, [testDocumentId]);
        await postgresStore.query(`DELETE FROM documents WHERE id = $1`, [testDocumentId]);
      } catch {
        // Ignore cleanup errors
      }
    }

    if (postgresStore) {
      await postgresStore.close();
    }
  });

  describe('Help and Version', () => {
    it.skipIf(!allServicesAvailable)('should show help with --help', async () => {
      const result = await runCli(['--help'], 10000);

      expect(result.stdout).toContain('ingest');
      expect(result.stdout).toContain('Ingest PDF documents');
      expect(result.stdout).toContain('file');
      expect(result.stdout).toContain('directory');
      expect(result.stdout).toContain('stats');
    });

    it.skipIf(!allServicesAvailable)('should show version with --version', async () => {
      const result = await runCli(['--version'], 10000);

      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Stats Command', () => {
    it.skipIf(!allServicesAvailable)('should display ingestion statistics', async () => {
      const result = await runCli(['stats'], 60000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Ingestion Statistics');
      expect(result.stdout).toMatch(/Total Documents: \d+/);
      expect(result.stdout).toMatch(/Total Vectors: \d+/);
    }, 90000);
  });

  describe('File Command', () => {
    it.skipIf(!allServicesAvailable)('should show error for non-existent file', async () => {
      const result = await runCli(['file', '/nonexistent/path/test.pdf'], 30000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Ingestion failed');
    });

    it.skipIf(!allServicesAvailable)('should ingest a real PDF file', async () => {
      const pdfPath = join(projectRoot, 'data/raw/priority/PA-Aging-PACE-Overview.pdf');

      const result = await runCli(['file', pdfPath], 180000);

      // If file was already ingested, it might skip or succeed
      if (result.code === 0) {
        expect(result.stdout).toContain('Ingestion complete');
        expect(result.stdout).toContain('Document ID:');
        expect(result.stdout).toContain('Chunks Created:');

        // Extract document ID for cleanup
        const match = result.stdout.match(/Document ID: ([a-f0-9-]+)/);
        if (match) {
          testDocumentId = match[1];
        }
      } else {
        // Check if it's a duplicate detection (not an error)
        expect(result.stderr + result.stdout).toMatch(/already|duplicate|skip/i);
      }
    }, 180000);
  });

  describe('Directory Command', () => {
    it.skipIf(!allServicesAvailable)('should show error for non-existent directory', async () => {
      const result = await runCli(['directory', '/nonexistent/directory'], 30000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Ingestion failed');
    });

    it.skipIf(!allServicesAvailable)('should show help for directory command', async () => {
      const result = await runCli(['directory', '--help'], 10000);

      expect(result.stdout).toContain('directory');
      expect(result.stdout).toContain('-r, --recursive');
      expect(result.stdout).toContain('-m, --save-markdown');
    });
  });

  describe('Error Handling', () => {
    it.skipIf(!allServicesAvailable)('should show error for unknown command', async () => {
      const result = await runCli(['unknowncommand'], 10000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('unknown command');
    });

    it.skipIf(!allServicesAvailable)('should show error when file argument is missing', async () => {
      const result = await runCli(['file'], 10000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("missing required argument");
    });
  });
});
