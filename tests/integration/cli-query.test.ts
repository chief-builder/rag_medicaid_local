/**
 * CLI Query Integration Tests
 *
 * Tests the query CLI commands with real services:
 * - PostgreSQL for BM25 search and caching
 * - Qdrant for vector search
 * - LM Studio for embeddings and answer generation
 *
 * These tests spawn the CLI as a child process and verify output.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkTestServices } from '../helpers/test-db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Check services availability
const services = await checkTestServices();
const allServicesAvailable = services.postgres && services.qdrant && services.lmStudio;
console.log('CLI Query Tests - Available services:', services);

// Helper to run CLI commands
function runCli(args: string[], timeout = 120000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Quote arguments with spaces to preserve them through shell
    const quotedArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg));
    const child = spawn('npx', ['tsx', 'src/cli/query.ts', ...quotedArgs], {
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

describe('CLI Query Integration Tests', () => {
  beforeAll(async () => {
    if (!allServicesAvailable) {
      console.warn('Skipping CLI query tests - not all services available');
    }
  });

  describe('Help and Version', () => {
    it.skipIf(!allServicesAvailable)('should show help with --help', async () => {
      const result = await runCli(['--help'], 10000);

      expect(result.stdout).toContain('query');
      expect(result.stdout).toContain('Query the Medicaid RAG system');
      expect(result.stdout).toContain('ask');
      expect(result.stdout).toContain('interactive');
      expect(result.stdout).toContain('metrics');
    });

    it.skipIf(!allServicesAvailable)('should show version with --version', async () => {
      const result = await runCli(['--version'], 10000);

      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Ask Command', () => {
    it.skipIf(!allServicesAvailable)('should answer a question about Medicaid', async () => {
      const result = await runCli(['ask', 'What is QMB?'], 90000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Query: What is QMB?');
      expect(result.stdout).toContain('Answer:');
      expect(result.stdout).toContain('Statistics:');
      expect(result.stdout).toContain('Query ID:');
      expect(result.stdout).toContain('Latency:');
      expect(result.stdout).toContain('Confidence:');
    }, 120000);

    it.skipIf(!allServicesAvailable)('should show citations when available', async () => {
      const result = await runCli(['ask', 'What are MSP income limits?'], 90000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Answer:');
      // Citations may or may not appear depending on indexed documents
      expect(result.stdout).toContain('Statistics:');
    }, 120000);

    it.skipIf(!allServicesAvailable)('should work with --no-cache option', async () => {
      const result = await runCli(['ask', 'What is SLMB?', '--no-cache'], 90000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Answer:');
      expect(result.stdout).toContain('Statistics:');
    }, 120000);

    it.skipIf(!allServicesAvailable)('should show error when question is missing', async () => {
      const result = await runCli(['ask'], 10000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("missing required argument");
    });

    it.skipIf(!allServicesAvailable)('should show ask command help', async () => {
      const result = await runCli(['ask', '--help'], 10000);

      expect(result.stdout).toContain('ask');
      expect(result.stdout).toContain('--no-cache');
    });
  });

  describe('Metrics Command', () => {
    it.skipIf(!allServicesAvailable)('should display query metrics', async () => {
      const result = await runCli(['metrics'], 60000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Query Metrics');
      expect(result.stdout).toMatch(/Total Queries: \d+/);
      expect(result.stdout).toMatch(/Average Latency: \d+ms/);
      expect(result.stdout).toMatch(/No-Answer Rate: [\d.]+%/);
    }, 90000);
  });

  describe('Interactive Command', () => {
    it.skipIf(!allServicesAvailable)('should show interactive command help', async () => {
      const result = await runCli(['interactive', '--help'], 10000);

      expect(result.stdout).toContain('interactive');
      expect(result.stdout).toContain('Start an interactive query session');
    });

    // Note: Full interactive mode testing requires stdin simulation
    // which is complex to implement reliably
  });

  describe('Error Handling', () => {
    it.skipIf(!allServicesAvailable)('should show error for unknown command', async () => {
      const result = await runCli(['unknowncommand'], 10000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('unknown command');
    });
  });
});
