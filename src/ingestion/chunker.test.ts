import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownChunker, createChunker } from './chunker.js';

describe('MarkdownChunker', () => {
  describe('Simple Chunking', () => {
    let chunker: MarkdownChunker;

    beforeEach(() => {
      chunker = createChunker({
        chunkSize: 100,
        chunkOverlap: 20,
        preserveMarkdownStructure: false,
      });
    });

    it('should create chunks from simple text', () => {
      const content = 'This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.';
      const chunks = chunker.chunk(content, 'doc-1');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].documentId).toBe('doc-1');
      expect(chunks[0].chunkIndex).toBe(0);
    });

    it('should respect chunk size limit', () => {
      const longParagraph = 'This is a very long paragraph. '.repeat(20);
      const chunks = chunker.chunk(longParagraph, 'doc-1');

      chunks.forEach((chunk) => {
        // Allow some flexibility for overlap and word boundaries
        expect(chunk.content.length).toBeLessThanOrEqual(150);
      });
    });

    it('should include overlap between chunks', () => {
      const content = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here.';
      const chunks = chunker.chunk(content, 'doc-1');

      if (chunks.length > 1) {
        // Check that there's some overlap between consecutive chunks
        const firstEnd = chunks[0].content.slice(-20);
        const secondStart = chunks[1].content.slice(0, 30);
        // Some text from end of first chunk should appear in second
        const hasOverlap = secondStart.includes(firstEnd.split(' ').pop() || '');
        expect(hasOverlap || chunks.length === 1).toBe(true);
      }
    });

    it('should preserve metadata', () => {
      const content = 'Test content here.';
      const metadata = { filename: 'test.pdf', section: 'intro' };
      const chunks = chunker.chunk(content, 'doc-1', metadata);

      expect(chunks[0].metadata.filename).toBe('test.pdf');
    });

    it('should handle empty content', () => {
      const chunks = chunker.chunk('', 'doc-1');
      expect(chunks.length).toBe(0);
    });

    it('should handle whitespace-only content', () => {
      const chunks = chunker.chunk('   \n\n   ', 'doc-1');
      expect(chunks.length).toBe(0);
    });
  });

  describe('Structure-Aware Chunking', () => {
    let chunker: MarkdownChunker;

    beforeEach(() => {
      chunker = createChunker({
        chunkSize: 200,
        chunkOverlap: 30,
        preserveMarkdownStructure: true,
      });
    });

    it('should respect markdown headers', () => {
      const content = `# Introduction

This is the introduction section.

## Background

This is the background section.

## Methods

This is the methods section.`;

      const chunks = chunker.chunk(content, 'doc-1');

      expect(chunks.length).toBeGreaterThan(0);
      // Each section should be treated as a logical unit
      const sectionsFound = chunks.map((c) => c.metadata.section).filter(Boolean);
      expect(sectionsFound.length).toBeGreaterThan(0);
    });

    it('should split large sections', () => {
      const content = `# Large Section

${'This is a long paragraph with lots of content. '.repeat(50)}`;

      const chunks = chunker.chunk(content, 'doc-1');

      // A very large section should be split into multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should keep small sections intact', () => {
      const content = `# Short Section

Short content here.`;

      const chunks = chunker.chunk(content, 'doc-1');

      expect(chunks.length).toBe(1);
      expect(chunks[0].metadata.section).toBe('Short Section');
    });

    it('should handle content before first header', () => {
      const content = `Some intro text before headers.

# First Section

Section content.`;

      const chunks = chunker.chunk(content, 'doc-1');

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract page numbers from content', () => {
      const content = `[Page: 5]

This is content from page 5.`;

      const chunks = chunker.chunk(content, 'doc-1');

      expect(chunks[0].pageNumber).toBe(5);
    });

    it('should use metadata page numbers when available', () => {
      const content = 'Content without page marker.';
      const chunks = chunker.chunk(content, 'doc-1', { pageNumbers: [3] });

      expect(chunks[0].pageNumber).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    let chunker: MarkdownChunker;

    beforeEach(() => {
      chunker = createChunker({
        chunkSize: 100,
        chunkOverlap: 10,
        preserveMarkdownStructure: true,
      });
    });

    it('should handle single word content', () => {
      const chunks = chunker.chunk('Hello', 'doc-1');
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Hello');
    });

    it('should handle content with only headers', () => {
      const content = `# Header 1

## Header 2

### Header 3`;

      const chunks = chunker.chunk(content, 'doc-1');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const content = 'Content with special chars: © ® ™ € £ ¥';
      const chunks = chunker.chunk(content, 'doc-1');
      expect(chunks[0].content).toContain('©');
    });

    it('should handle code blocks', () => {
      const content = `# Code Example

\`\`\`javascript
const x = 1;
const y = 2;
\`\`\`

More text here.`;

      const chunks = chunker.chunk(content, 'doc-1');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle tables', () => {
      const content = `# Table Example

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |`;

      const chunks = chunker.chunk(content, 'doc-1');
      expect(chunks[0].content).toContain('Column 1');
    });

    it('should handle lists', () => {
      const content = `# List Example

- Item 1
- Item 2
- Item 3

1. Numbered 1
2. Numbered 2`;

      const chunks = chunker.chunk(content, 'doc-1');
      expect(chunks[0].content).toContain('Item 1');
    });
  });

  describe('Chunk Index Assignment', () => {
    it('should assign sequential chunk indices', () => {
      const chunker = createChunker({
        chunkSize: 50,
        chunkOverlap: 10,
        preserveMarkdownStructure: false,
      });

      const content = 'Paragraph one here. Paragraph two here. Paragraph three here. Paragraph four here.';
      const chunks = chunker.chunk(content, 'doc-1');

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });
  });

  describe('Character Positions', () => {
    it('should track start and end character positions', () => {
      const chunker = createChunker({
        chunkSize: 50,
        chunkOverlap: 0,
        preserveMarkdownStructure: false,
      });

      const content = 'Short text.';
      const chunks = chunker.chunk(content, 'doc-1');

      expect(chunks[0].startChar).toBeDefined();
      expect(chunks[0].endChar).toBeDefined();
      expect(chunks[0].startChar).toBeLessThan(chunks[0].endChar!);
    });
  });
});

describe('createChunker', () => {
  it('should create chunker with default options', () => {
    const chunker = createChunker();
    const chunks = chunker.chunk('Test content', 'doc-1');
    expect(chunks.length).toBe(1);
  });

  it('should create chunker with custom options', () => {
    const chunker = createChunker({
      chunkSize: 50,
      chunkOverlap: 5,
      preserveMarkdownStructure: false,
    });
    expect(chunker).toBeInstanceOf(MarkdownChunker);
  });
});
