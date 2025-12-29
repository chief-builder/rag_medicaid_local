import { describe, it, expect, beforeEach } from 'vitest';
import {
  FreshnessDisplayService,
  getFreshnessDisplayService,
  resetFreshnessDisplayService,
  DocumentMetadata,
} from './display.js';
import { Citation } from '../types/index.js';

describe('FreshnessDisplayService', () => {
  let service: FreshnessDisplayService;

  beforeEach(() => {
    resetFreshnessDisplayService();
    service = new FreshnessDisplayService();
  });

  describe('setSystemIngestionDate', () => {
    it('should set and get system ingestion date', () => {
      const date = new Date('2025-01-15');
      service.setSystemIngestionDate(date);
      expect(service.getSystemIngestionDate()).toEqual(date);
    });

    it('should return null if not set', () => {
      expect(service.getSystemIngestionDate()).toBeNull();
    });
  });

  describe('generateFreshnessInfo', () => {
    it('should generate basic freshness info with no citations', () => {
      const citations: Citation[] = [];
      const documentMetadata = new Map<string, DocumentMetadata>();

      const result = service.generateFreshnessInfo(citations, documentMetadata);

      expect(result.lastRetrievedFormatted).toBeDefined();
      expect(result.hasStaleData).toBe(false);
    });

    it('should use system ingestion date when set', () => {
      const systemDate = new Date('2025-01-15');
      service.setSystemIngestionDate(systemDate);

      const citations: Citation[] = [];
      const documentMetadata = new Map<string, DocumentMetadata>();

      const result = service.generateFreshnessInfo(citations, documentMetadata);

      expect(result.lastRetrieved).toEqual(systemDate);
    });

    it('should determine effective period from document metadata', () => {
      const citations: Citation[] = [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          filename: 'test.pdf',
          pageNumber: 1,
          chunkIndex: 0,
          excerpt: 'test content',
        },
      ];

      const documentMetadata = new Map<string, DocumentMetadata>();
      documentMetadata.set('doc-1', {
        documentType: 'income_limits',
        effectiveDate: new Date('2025-01-01'),
      });

      const result = service.generateFreshnessInfo(citations, documentMetadata);

      expect(result.effectivePeriod).toContain('2025');
    });

    it('should detect income limits effective period', () => {
      const citations: Citation[] = [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          filename: 'income.pdf',
          pageNumber: 1,
          chunkIndex: 0,
          excerpt: 'income limits',
        },
      ];

      const documentMetadata = new Map<string, DocumentMetadata>();
      documentMetadata.set('doc-1', {
        documentType: 'income_limits',
        effectiveDate: new Date('2025-01-01'),
      });

      const result = service.generateFreshnessInfo(citations, documentMetadata);

      expect(result.incomeLimitsEffective).toBeDefined();
      expect(result.incomeLimitsEffective).toContain('April');
    });

    it('should detect stale data', () => {
      const citations: Citation[] = [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          filename: 'ops-memo.pdf',
          pageNumber: 1,
          chunkIndex: 0,
          excerpt: 'operations memo',
        },
      ];

      const documentMetadata = new Map<string, DocumentMetadata>();
      documentMetadata.set('doc-1', {
        documentType: 'oim_ops_memo',
        effectiveDate: new Date('2024-01-01'), // Old date
      });

      // Check in 2025, ops memos should be checked weekly
      const checkDate = new Date('2025-06-01');
      const result = service.generateFreshnessInfo(citations, documentMetadata, checkDate);

      expect(result.hasStaleData).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should deduplicate warnings', () => {
      const citations: Citation[] = [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          filename: 'memo1.pdf',
          pageNumber: 1,
          chunkIndex: 0,
          excerpt: 'memo 1',
        },
        {
          chunkId: 'chunk-2',
          documentId: 'doc-2',
          filename: 'memo2.pdf',
          pageNumber: 1,
          chunkIndex: 0,
          excerpt: 'memo 2',
        },
      ];

      const documentMetadata = new Map<string, DocumentMetadata>();
      documentMetadata.set('doc-1', {
        documentType: 'oim_ops_memo',
        effectiveDate: new Date('2024-01-01'),
      });
      documentMetadata.set('doc-2', {
        documentType: 'oim_ops_memo',
        effectiveDate: new Date('2024-01-01'),
      });

      const checkDate = new Date('2025-06-01');
      const result = service.generateFreshnessInfo(citations, documentMetadata, checkDate);

      // Should not have duplicate warning messages
      const messages = result.warnings.map((w) => w.message);
      const uniqueMessages = [...new Set(messages)];
      expect(messages.length).toBe(uniqueMessages.length);
    });
  });

  describe('formatFreshnessSection', () => {
    it('should format basic freshness info', () => {
      const info = {
        lastRetrieved: new Date('2025-01-15'),
        lastRetrievedFormatted: 'January 15, 2025',
        hasStaleData: false,
        warnings: [],
      };

      const result = service.formatFreshnessSection(info);

      expect(result).toContain('Source Information');
      expect(result).toContain('January 15, 2025');
    });

    it('should include effective period when available', () => {
      const info = {
        lastRetrieved: new Date('2025-01-15'),
        lastRetrievedFormatted: 'January 15, 2025',
        effectivePeriod: 'Calendar Year 2025 (unless otherwise noted)',
        hasStaleData: false,
        warnings: [],
      };

      const result = service.formatFreshnessSection(info);

      expect(result).toContain('Applies to:');
      expect(result).toContain('Calendar Year 2025');
    });

    it('should include income limits effective period when available', () => {
      const info = {
        lastRetrieved: new Date('2025-01-15'),
        lastRetrievedFormatted: 'January 15, 2025',
        incomeLimitsEffective: 'April 2025 - March 2026',
        hasStaleData: false,
        warnings: [],
      };

      const result = service.formatFreshnessSection(info);

      expect(result).toContain('Income limits effective:');
      expect(result).toContain('April 2025 - March 2026');
    });

    it('should include warnings with appropriate icons', () => {
      const info = {
        lastRetrieved: new Date('2025-01-15'),
        lastRetrievedFormatted: 'January 15, 2025',
        hasStaleData: true,
        warnings: [
          { level: 'info' as const, message: 'Info message' },
          { level: 'warning' as const, message: 'Warning message' },
          { level: 'critical' as const, message: 'Critical message' },
        ],
      };

      const result = service.formatFreshnessSection(info);

      expect(result).toContain('ℹ️');
      expect(result).toContain('⚠️');
      expect(result).toContain('🚨');
    });
  });

  describe('getFreshnessDisplayService', () => {
    it('should return singleton instance', () => {
      const instance1 = getFreshnessDisplayService();
      const instance2 = getFreshnessDisplayService();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getFreshnessDisplayService();
      resetFreshnessDisplayService();
      const instance2 = getFreshnessDisplayService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('general freshness warnings', () => {
    it('should add FPL warning in January/February', () => {
      const citations: Citation[] = [];
      const documentMetadata = new Map<string, DocumentMetadata>();
      const checkDate = new Date('2025-01-15');

      const result = service.generateFreshnessInfo(citations, documentMetadata, checkDate);

      const fplWarning = result.warnings.find((w) =>
        w.message.includes('Federal Poverty Level')
      );
      expect(fplWarning).toBeDefined();
    });

    it('should add MSP warning in March-May', () => {
      const citations: Citation[] = [];
      const documentMetadata = new Map<string, DocumentMetadata>();
      const checkDate = new Date('2025-04-15');

      const result = service.generateFreshnessInfo(citations, documentMetadata, checkDate);

      const mspWarning = result.warnings.find((w) =>
        w.message.includes('Medicare Savings Program')
      );
      expect(mspWarning).toBeDefined();
    });

    it('should not add MSP warning outside March-May', () => {
      const citations: Citation[] = [];
      const documentMetadata = new Map<string, DocumentMetadata>();
      const checkDate = new Date('2025-07-15');

      const result = service.generateFreshnessInfo(citations, documentMetadata, checkDate);

      const mspWarning = result.warnings.find((w) =>
        w.message.includes('Medicare Savings Program')
      );
      expect(mspWarning).toBeUndefined();
    });
  });
});
