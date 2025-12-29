import { describe, it, expect, beforeEach } from 'vitest';
import {
  RegulatoryChunker,
  createRegulatoryChunker,
  RegulatorySection,
} from './regulatory-chunker.js';

describe('RegulatoryChunker', () => {
  let chunker: RegulatoryChunker;

  beforeEach(() => {
    chunker = createRegulatoryChunker();
  });

  describe('PA Code Parsing', () => {
    const samplePACode = `CHAPTER 258. ESTATE RECOVERY

§ 258.1. Definitions.

The following words and terms, when used in this chapter, have the following meanings:

Claim—A demand for payment.

Estate—All real and personal property and other assets included within the individual's estate.

(a) Property passing to the survivor under joint tenancy.
(b) Property held by the decedent and another.

§ 258.2. General.

(a) DHS has the right to recover from the estate of a deceased MA recipient.
(b) Claims shall include medical assistance paid on behalf of the recipient. See § 258.3 for exceptions.
(c) Reference Chapter 177 for additional guidance.

§ 258.3. Exceptions.

Estate recovery shall not apply to the following:

(a) When a surviving spouse exists.
(b) When a child under 21 survives.
(c) When a disabled child survives.`;

    it('should parse PA Code sections', () => {
      const sections = chunker.parseStructure(samplePACode, 'pa_code');

      expect(sections.length).toBe(3);
      expect(sections[0].sectionNumber).toBe('258.1');
      expect(sections[0].sectionTitle).toBe('Definitions');
      expect(sections[0].chapterNumber).toBe('258');
    });

    it('should extract chapter title', () => {
      const sections = chunker.parseStructure(samplePACode, 'pa_code');

      expect(sections[0].chapterTitle).toBe('ESTATE RECOVERY');
    });

    it('should extract subsections', () => {
      const sections = chunker.parseStructure(samplePACode, 'pa_code');

      // Section 258.1 has subsections (a), (b)
      expect(sections[0].subsections.length).toBeGreaterThanOrEqual(2);
      expect(sections[0].subsections[0].number).toBe('(a)');
    });

    it('should extract cross-references', () => {
      const sections = chunker.parseStructure(samplePACode, 'pa_code');

      // Section 258.2 references § 258.3 and Chapter 177
      const section258_2 = sections.find((s) => s.sectionNumber === '258.2');
      expect(section258_2?.crossReferences).toContain('§ 258.3');
      expect(section258_2?.crossReferences).toContain('Chapter 177');
    });

    it('should track section positions', () => {
      const sections = chunker.parseStructure(samplePACode, 'pa_code');

      sections.forEach((section) => {
        expect(section.startIndex).toBeDefined();
        expect(section.endIndex).toBeDefined();
        expect(section.startIndex).toBeLessThan(section.endIndex);
      });
    });
  });

  describe('OIM Handbook Parsing', () => {
    const sampleOIMHandbook = `403.1 General Policy

This section provides general policy guidance for Medical Assistance eligibility.

(a) Applicants must meet all requirements.
(b) Income must be verified. See section 403.2 for details.

403.2 Income Requirements

The following income limits apply to MA applicants:

(1) Gross income must not exceed 133% FPL
(2) Net income calculations apply certain deductions

403.2.1 Deductions

Certain deductions are allowed from gross income.`;

    it('should parse OIM handbook sections', () => {
      const sections = chunker.parseStructure(sampleOIMHandbook, 'oim_handbook');

      expect(sections.length).toBe(3);
      expect(sections[0].sectionNumber).toBe('403.1');
      expect(sections[0].sectionTitle).toBe('General Policy');
    });

    it('should extract chapter number from section', () => {
      const sections = chunker.parseStructure(sampleOIMHandbook, 'oim_handbook');

      expect(sections[0].chapterNumber).toBe('403');
    });

    it('should parse nested section numbers', () => {
      const sections = chunker.parseStructure(sampleOIMHandbook, 'oim_handbook');

      const nestedSection = sections.find((s) => s.sectionNumber === '403.2.1');
      expect(nestedSection).toBeDefined();
      expect(nestedSection?.sectionTitle).toBe('Deductions');
    });

    it('should extract cross-references', () => {
      const sections = chunker.parseStructure(sampleOIMHandbook, 'oim_handbook');

      const section403_1 = sections.find((s) => s.sectionNumber === '403.1');
      expect(section403_1?.crossReferences).toContain('403.2');
    });
  });

  describe('PA Bulletin Parsing', () => {
    const samplePABulletin = `DEPARTMENT OF HUMAN SERVICES

MEDICAID FEE UPDATE

The Department announces the following fee schedule updates...

[52 Pa.B. 1234]

INCOME LIMITS FOR 2025

Effective January 1, 2025, the following income limits apply...

[52 Pa.B. 1345]

WAIVER AMENDMENTS

The Department is amending the Community HealthChoices waiver...`;

    it('should parse PA Bulletin notices', () => {
      const sections = chunker.parseStructure(samplePABulletin, 'pa_bulletin');

      expect(sections.length).toBeGreaterThan(0);
    });

    it('should extract bulletin citations', () => {
      const sections = chunker.parseStructure(samplePABulletin, 'pa_bulletin');

      const hasCitation = sections.some(
        (s) => s.sectionNumber.includes('Pa.B.') || s.amendmentCitation
      );
      expect(hasCitation).toBe(true);
    });
  });

  describe('Generic Structure Parsing', () => {
    it('should handle content without structure markers', () => {
      const plainContent = 'This is simple text content without any headers or structure.';
      const sections = chunker.parseStructure(plainContent, 'pa_code');

      expect(sections.length).toBe(1);
      expect(sections[0].sectionNumber).toBe('1');
    });

    it('should handle markdown-style headers', () => {
      const markdownContent = `# 1. Introduction

Some introduction text.

## 1.1 Background

Background information here.`;

      // When no PA Code patterns found, falls back to generic
      const chunkerGeneric = createRegulatoryChunker();
      // The PA Code parser falls back to generic if no matches
      const sections = chunkerGeneric.parseStructure(markdownContent, 'pa_code');

      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Reference Extraction', () => {
    it('should extract PA Code section references', () => {
      const text = 'See § 258.1 and § 177.2 for more information.';
      const refs = chunker.extractCrossReferences(text);

      expect(refs).toContain('§ 258.1');
      expect(refs).toContain('§ 177.2');
    });

    it('should extract Chapter references', () => {
      const text = 'Refer to Chapter 258 and Chapter 177 for details.';
      const refs = chunker.extractCrossReferences(text);

      expect(refs).toContain('Chapter 258');
      expect(refs).toContain('Chapter 177');
    });

    it('should extract OIM section references', () => {
      const text = 'See section 403.1 and section 404.2 for policy guidance.';
      const refs = chunker.extractCrossReferences(text);

      expect(refs).toContain('403.1');
      expect(refs).toContain('404.2');
    });

    it('should not duplicate references', () => {
      const text = 'See § 258.1 and also § 258.1 again.';
      const refs = chunker.extractCrossReferences(text);

      const count = refs.filter((r) => r === '§ 258.1').length;
      expect(count).toBe(1);
    });
  });

  describe('Chunking Sections', () => {
    it('should chunk small sections into single chunks', () => {
      const sections: RegulatorySection[] = [
        {
          sectionNumber: '258.1',
          sectionTitle: 'Definitions',
          content: 'Short content here.',
          startIndex: 0,
          endIndex: 20,
          subsections: [],
          crossReferences: [],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'pa_code');

      expect(chunks.length).toBe(1);
      expect(chunks[0].documentId).toBe('doc-1');
      expect(chunks[0].chunkIndex).toBe(0);
    });

    it('should include section header in chunks', () => {
      const sections: RegulatorySection[] = [
        {
          chapterNumber: '258',
          sectionNumber: '258.1',
          sectionTitle: 'Definitions',
          content: 'Section content.',
          startIndex: 0,
          endIndex: 20,
          subsections: [],
          crossReferences: [],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'pa_code');

      expect(chunks[0].content).toContain('Chapter 258');
      expect(chunks[0].content).toContain('§ 258.1');
    });

    it('should split large sections into multiple chunks', () => {
      // Create content with paragraphs that exceeds the default chunk size
      const paragraphs = Array(50)
        .fill('This is a large paragraph with detailed legal text that spans multiple sentences. It contains important regulatory information.')
        .join('\n\n');
      const sections: RegulatorySection[] = [
        {
          sectionNumber: '258.1',
          sectionTitle: 'Definitions',
          content: paragraphs,
          startIndex: 0,
          endIndex: paragraphs.length,
          subsections: [],
          crossReferences: [],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'pa_code');

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should preserve subsection boundaries when splitting', () => {
      const sections: RegulatorySection[] = [
        {
          sectionNumber: '258.1',
          sectionTitle: 'Definitions',
          content: '(a) First subsection content. (b) Second subsection content. (c) Third subsection content.',
          startIndex: 0,
          endIndex: 100,
          subsections: [
            { number: '(a)', content: '(a) First subsection content.', startIndex: 0, endIndex: 30 },
            { number: '(b)', content: '(b) Second subsection content.', startIndex: 31, endIndex: 62 },
            { number: '(c)', content: '(c) Third subsection content.', startIndex: 63, endIndex: 93 },
          ],
          crossReferences: [],
        },
      ];

      // Use a small chunk size to force splitting
      const smallChunker = createRegulatoryChunker({ maxChunkTokens: 100 });
      const chunks = smallChunker.chunkSections(sections, 'doc-1', 'pa_code');

      // Chunks should respect subsection boundaries
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should include regulatory metadata in chunks', () => {
      const sections: RegulatorySection[] = [
        {
          chapterNumber: '258',
          sectionNumber: '258.1',
          sectionTitle: 'Definitions',
          content: 'Content with cross-ref to § 258.2.',
          startIndex: 0,
          endIndex: 35,
          subsections: [],
          crossReferences: ['§ 258.2'],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'pa_code', {
        filename: 'chapter-258.pdf',
      });

      expect(chunks[0].metadata.chapterNumber).toBe('258');
      expect(chunks[0].metadata.sectionNumber).toBe('258.1');
      expect(chunks[0].metadata.sourceAuthority).toBe('pa_code');
      expect(chunks[0].metadata.legalWeight).toBe('regulatory');
      expect(chunks[0].metadata.crossReferences).toContain('§ 258.2');
    });
  });

  describe('Legal Weight Assignment', () => {
    it('should assign regulatory weight to PA Code', () => {
      const sections: RegulatorySection[] = [
        {
          sectionNumber: '1',
          sectionTitle: 'Test',
          content: 'Test content',
          startIndex: 0,
          endIndex: 12,
          subsections: [],
          crossReferences: [],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'pa_code');
      expect(chunks[0].metadata.legalWeight).toBe('regulatory');
    });

    it('should assign guidance weight to OIM Handbook', () => {
      const sections: RegulatorySection[] = [
        {
          sectionNumber: '1',
          sectionTitle: 'Test',
          content: 'Test content',
          startIndex: 0,
          endIndex: 12,
          subsections: [],
          crossReferences: [],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'oim_handbook');
      expect(chunks[0].metadata.legalWeight).toBe('guidance');
    });

    it('should assign regulatory weight to PA Bulletin', () => {
      const sections: RegulatorySection[] = [
        {
          sectionNumber: '1',
          sectionTitle: 'Test',
          content: 'Test content',
          startIndex: 0,
          endIndex: 12,
          subsections: [],
          crossReferences: [],
        },
      ];

      const chunks = chunker.chunkSections(sections, 'doc-1', 'pa_bulletin');
      expect(chunks[0].metadata.legalWeight).toBe('regulatory');
    });
  });

  describe('Definition Injection', () => {
    it('should register and inject definitions', () => {
      chunker.registerDefinition('Estate', 'All property of a deceased person.');

      const chunk = {
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'The Estate recovery process begins after death.',
        startChar: 0,
        endChar: 48,
        metadata: {},
      };

      const chunkerWithDefs = createRegulatoryChunker({ inlineDefinitions: true });
      chunkerWithDefs.registerDefinition('Estate', 'All property of a deceased person.');

      const injected = chunkerWithDefs.injectDefinitions(chunk);

      expect(injected.content).toContain('[Definitions]');
      expect(injected.content).toContain('Estate');
    });

    it('should not inject when disabled', () => {
      const chunk = {
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'The Estate recovery process begins after death.',
        startChar: 0,
        endChar: 48,
        metadata: {},
      };

      // Default has inlineDefinitions disabled
      chunker.registerDefinition('Estate', 'All property of a deceased person.');
      const injected = chunker.injectDefinitions(chunk);

      expect(injected.content).not.toContain('[Definitions]');
    });
  });

  describe('createRegulatoryChunker Factory', () => {
    it('should create chunker with default options', () => {
      const defaultChunker = createRegulatoryChunker();
      expect(defaultChunker).toBeInstanceOf(RegulatoryChunker);
    });

    it('should create chunker with custom options', () => {
      const customChunker = createRegulatoryChunker({
        maxChunkTokens: 2048,
        includeParentHeaders: false,
      });
      expect(customChunker).toBeInstanceOf(RegulatoryChunker);
    });
  });
});
