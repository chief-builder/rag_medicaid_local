/**
 * CLI Monitor Integration Tests
 *
 * Tests the monitor CLI commands with real services:
 * - PostgreSQL for monitor state storage
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
// Monitor CLI only requires PostgreSQL
const postgresAvailable = services.postgres;
console.log('CLI Monitor Tests - Available services:', services);

// Helper to run CLI commands
function runCli(args: string[], timeout = 120000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Quote arguments with spaces to preserve them through shell
    const quotedArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg));
    const child = spawn('npx', ['tsx', 'src/cli/monitor.ts', ...quotedArgs], {
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

describe('CLI Monitor Integration Tests', () => {
  beforeAll(async () => {
    if (!postgresAvailable) {
      console.warn('Skipping CLI monitor tests - PostgreSQL not available');
    }
  });

  describe('Help and Version', () => {
    it.skipIf(!postgresAvailable)('should show help with --help', async () => {
      const result = await runCli(['--help'], 10000);

      expect(result.stdout).toContain('monitor');
      expect(result.stdout).toContain('Pennsylvania Medicaid source monitoring');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('check');
      expect(result.stdout).toContain('changes');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('test-scrape');
    });

    it.skipIf(!postgresAvailable)('should show version with --version', async () => {
      const result = await runCli(['--version'], 10000);

      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('List Command', () => {
    it.skipIf(!postgresAvailable)('should list source monitors', async () => {
      const result = await runCli(['list'], 30000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Source Monitors');
    }, 60000);

    it.skipIf(!postgresAvailable)('should show help for list command', async () => {
      const result = await runCli(['list', '--help'], 10000);

      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('-f, --frequency');
    });

    it.skipIf(!postgresAvailable)('should filter by frequency', async () => {
      const result = await runCli(['list', '-f', 'weekly'], 30000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Source Monitors');
    }, 60000);
  });

  describe('Status Command', () => {
    it.skipIf(!postgresAvailable)('should show monitor status summary', async () => {
      const result = await runCli(['status'], 30000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Monitor Status');
      expect(result.stdout).toMatch(/Total monitors: \d+/);
      expect(result.stdout).toMatch(/Active monitors: \d+/);
      expect(result.stdout).toContain('By frequency:');
      expect(result.stdout).toMatch(/Weekly: \d+/);
      expect(result.stdout).toMatch(/Monthly: \d+/);
    }, 60000);
  });

  describe('Changes Command', () => {
    it.skipIf(!postgresAvailable)('should show recent changes', async () => {
      const result = await runCli(['changes'], 30000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Recent Source Changes');
    }, 60000);

    it.skipIf(!postgresAvailable)('should accept limit option', async () => {
      const result = await runCli(['changes', '-n', '5'], 30000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Recent Source Changes');
    }, 60000);
  });

  describe('Check Command', () => {
    it.skipIf(!postgresAvailable)('should show help for check command', async () => {
      const result = await runCli(['check', '--help'], 10000);

      expect(result.stdout).toContain('check');
      expect(result.stdout).toContain('-f, --frequency');
      expect(result.stdout).toContain('-s, --source');
      expect(result.stdout).toContain('--force');
      expect(result.stdout).toContain('--dry-run');
    });

    it.skipIf(!postgresAvailable)('should run check in dry-run mode', async () => {
      const result = await runCli(['check', '--dry-run'], 60000);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Checking sources for changes');
      expect(result.stdout).toContain('Results:');
      expect(result.stdout).toMatch(/Sources checked: \d+/);
    }, 90000);
  });

  describe('Test-Scrape Command', () => {
    it.skipIf(!postgresAvailable)('should show help for test-scrape command', async () => {
      const result = await runCli(['test-scrape', '--help'], 10000);

      expect(result.stdout).toContain('test-scrape');
      expect(result.stdout).toContain('-t, --type');
    });

    it.skipIf(!postgresAvailable)('should show error for unknown source type', async () => {
      const result = await runCli(['test-scrape', 'https://example.com', '-t', 'unknown_type'], 30000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Unknown source type');
    }, 60000);
  });

  describe('Error Handling', () => {
    it.skipIf(!postgresAvailable)('should show error for unknown command', async () => {
      const result = await runCli(['unknowncommand'], 10000);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('unknown command');
    });
  });
});
