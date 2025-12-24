import { ChunkInput, ChunkMetadata } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('chunker');

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
  preserveMarkdownStructure: boolean;
}

interface MarkdownSection {
  level: number;
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Structure-aware markdown chunker
 */
export class MarkdownChunker {
  private options: ChunkingOptions;

  constructor(options: ChunkingOptions) {
    this.options = options;
  }

  /**
   * Chunk markdown content with structure awareness
   */
  chunk(
    content: string,
    documentId: string,
    baseMetadata: ChunkMetadata = {}
  ): ChunkInput[] {
    logger.debug(
      { contentLength: content.length, documentId },
      'Starting chunking'
    );

    if (this.options.preserveMarkdownStructure) {
      return this.chunkWithStructure(content, documentId, baseMetadata);
    }

    return this.chunkSimple(content, documentId, baseMetadata);
  }

  /**
   * Simple chunking with overlap
   */
  private chunkSimple(
    content: string,
    documentId: string,
    baseMetadata: ChunkMetadata
  ): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    const { chunkSize, chunkOverlap } = this.options;

    // Split by paragraphs first to avoid cutting mid-sentence
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;
    let charOffset = 0;

    for (const paragraph of paragraphs) {
      const paragraphWithBreak = paragraph + '\n\n';

      if (currentChunk.length + paragraphWithBreak.length > chunkSize) {
        // Save current chunk if it has content
        if (currentChunk.trim().length > 0) {
          chunks.push({
            documentId,
            chunkIndex,
            content: currentChunk.trim(),
            startChar: currentStart,
            endChar: charOffset,
            pageNumber: this.extractPageNumber(currentChunk, baseMetadata),
            metadata: {
              ...baseMetadata,
              section: this.extractSection(currentChunk),
            },
          });
          chunkIndex++;
        }

        // Start new chunk with overlap from previous
        const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
        currentChunk = overlapText + paragraphWithBreak;
        currentStart = charOffset - overlapText.length;
      } else {
        currentChunk += paragraphWithBreak;
      }

      charOffset += paragraphWithBreak.length;
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        documentId,
        chunkIndex,
        content: currentChunk.trim(),
        startChar: currentStart,
        endChar: charOffset,
        pageNumber: this.extractPageNumber(currentChunk, baseMetadata),
        metadata: {
          ...baseMetadata,
          section: this.extractSection(currentChunk),
        },
      });
    }

    logger.info(
      { chunkCount: chunks.length, documentId },
      'Simple chunking complete'
    );

    return chunks;
  }

  /**
   * Structure-aware chunking that respects markdown headers
   */
  private chunkWithStructure(
    content: string,
    documentId: string,
    baseMetadata: ChunkMetadata
  ): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    const sections = this.parseMarkdownSections(content);

    let chunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = this.chunkSection(
        section,
        documentId,
        chunkIndex,
        baseMetadata
      );
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }

    logger.info(
      { chunkCount: chunks.length, sectionCount: sections.length, documentId },
      'Structure-aware chunking complete'
    );

    return chunks;
  }

  /**
   * Parse markdown into sections based on headers
   */
  private parseMarkdownSections(content: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    const matches = [...content.matchAll(headerRegex)];

    if (matches.length === 0) {
      // No headers, treat entire content as one section
      return [
        {
          level: 0,
          title: '',
          content: content,
          startIndex: 0,
          endIndex: content.length,
        },
      ];
    }

    // Add content before first header if exists
    if (matches[0].index! > 0) {
      sections.push({
        level: 0,
        title: 'Introduction',
        content: content.substring(0, matches[0].index!),
        startIndex: 0,
        endIndex: matches[0].index!,
      });
    }

    // Parse each section
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const level = match[1].length;
      const title = match[2];
      const startIndex = match.index!;
      const endIndex =
        i < matches.length - 1 ? matches[i + 1].index! : content.length;

      sections.push({
        level,
        title,
        content: content.substring(startIndex, endIndex),
        startIndex,
        endIndex,
      });
    }

    return sections;
  }

  /**
   * Chunk a single section, potentially splitting large sections
   */
  private chunkSection(
    section: MarkdownSection,
    documentId: string,
    startIndex: number,
    baseMetadata: ChunkMetadata
  ): ChunkInput[] {
    const { chunkSize, chunkOverlap } = this.options;

    if (section.content.length <= chunkSize) {
      // Section fits in one chunk
      return [
        {
          documentId,
          chunkIndex: startIndex,
          content: section.content.trim(),
          startChar: section.startIndex,
          endChar: section.endIndex,
          pageNumber: this.extractPageNumber(section.content, baseMetadata),
          metadata: {
            ...baseMetadata,
            section: section.title || undefined,
          },
        },
      ];
    }

    // Section needs to be split
    const chunks: ChunkInput[] = [];
    let currentContent = section.content;
    let currentStart = section.startIndex;
    let localIndex = 0;

    while (currentContent.length > 0) {
      let chunkContent: string;
      let chunkEnd: number;

      if (currentContent.length <= chunkSize) {
        chunkContent = currentContent;
        chunkEnd = section.endIndex;
        currentContent = '';
      } else {
        // Find a good break point
        const breakPoint = this.findBreakPoint(
          currentContent,
          chunkSize
        );
        chunkContent = currentContent.substring(0, breakPoint);
        currentContent = currentContent.substring(breakPoint - chunkOverlap);
        chunkEnd = currentStart + breakPoint;
      }

      if (chunkContent.trim().length > 0) {
        chunks.push({
          documentId,
          chunkIndex: startIndex + localIndex,
          content: chunkContent.trim(),
          startChar: currentStart,
          endChar: chunkEnd,
          pageNumber: this.extractPageNumber(chunkContent, baseMetadata),
          metadata: {
            ...baseMetadata,
            section: section.title || undefined,
          },
        });
        localIndex++;
        currentStart = chunkEnd - chunkOverlap;
      }
    }

    return chunks;
  }

  /**
   * Find a good break point (end of sentence or paragraph)
   */
  private findBreakPoint(content: string, maxLength: number): number {
    // Try to break at paragraph
    const paragraphBreak = content.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.5) {
      return paragraphBreak + 2;
    }

    // Try to break at sentence
    const sentenceBreak = content.lastIndexOf('. ', maxLength);
    if (sentenceBreak > maxLength * 0.5) {
      return sentenceBreak + 2;
    }

    // Try to break at newline
    const lineBreak = content.lastIndexOf('\n', maxLength);
    if (lineBreak > maxLength * 0.5) {
      return lineBreak + 1;
    }

    // Try to break at space
    const spaceBreak = content.lastIndexOf(' ', maxLength);
    if (spaceBreak > maxLength * 0.5) {
      return spaceBreak + 1;
    }

    // Just break at maxLength
    return maxLength;
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(content: string, overlapSize: number): string {
    if (content.length <= overlapSize) {
      return content;
    }

    const lastPart = content.substring(content.length - overlapSize);
    // Try to start at a word boundary
    const spaceIndex = lastPart.indexOf(' ');
    if (spaceIndex > 0 && spaceIndex < overlapSize / 2) {
      return lastPart.substring(spaceIndex + 1);
    }
    return lastPart;
  }

  /**
   * Extract section title from content (first header found)
   */
  private extractSection(content: string): string | undefined {
    const match = content.match(/^#{1,6}\s+(.+)$/m);
    return match ? match[1] : undefined;
  }

  /**
   * Extract page number if embedded in content or metadata
   */
  private extractPageNumber(
    content: string,
    metadata: ChunkMetadata
  ): number | undefined {
    // Check metadata first
    if (
      metadata.pageNumbers &&
      Array.isArray(metadata.pageNumbers) &&
      metadata.pageNumbers.length > 0
    ) {
      return metadata.pageNumbers[0];
    }

    // Try to find page marker in content
    const pageMatch = content.match(/\[page[:\s]+(\d+)\]/i);
    if (pageMatch) {
      return parseInt(pageMatch[1], 10);
    }

    return undefined;
  }
}

/**
 * Create a chunker with default options
 */
export function createChunker(options: Partial<ChunkingOptions> = {}): MarkdownChunker {
  return new MarkdownChunker({
    chunkSize: options.chunkSize ?? 512,
    chunkOverlap: options.chunkOverlap ?? 64,
    preserveMarkdownStructure: options.preserveMarkdownStructure ?? true,
  });
}
