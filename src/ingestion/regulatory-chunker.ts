/**
 * Specialized chunker for regulatory and legal text
 * Preserves section structure, cross-references, and legal hierarchy
 */

import { ChunkInput, ChunkMetadata } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';
import {
  RegulatoryChunkOptions,
  RegulatorySection,
  RegulatoryChunkMetadata,
  RegulatorySourceType,
  DEFAULT_REGULATORY_OPTIONS,
} from './regulatory-types.js';
import {
  parseRegulatoryStructure,
  extractCrossReferences,
} from './regulatory-parsers.js';

// Re-export types for backwards compatibility
export type {
  RegulatoryChunkOptions,
  RegulatorySection,
  RegulatorySubsection,
  RegulatoryChunkMetadata,
} from './regulatory-types.js';

const logger = createChildLogger('regulatory-chunker');

/**
 * Specialized chunker for regulatory and legal text
 * Preserves section structure, cross-references, and legal hierarchy
 */
export class RegulatoryChunker {
  private options: RegulatoryChunkOptions;
  private definitions: Map<string, string> = new Map();

  constructor(options: Partial<RegulatoryChunkOptions> = {}) {
    this.options = { ...DEFAULT_REGULATORY_OPTIONS, ...options };
  }

  /**
   * Parse regulatory text into structured sections
   */
  parseStructure(
    content: string,
    sourceType: RegulatorySourceType
  ): RegulatorySection[] {
    return parseRegulatoryStructure(content, sourceType);
  }

  /**
   * Extract cross-references from text
   */
  extractCrossReferences(text: string): string[] {
    return extractCrossReferences(text);
  }

  /**
   * Chunk sections respecting legal structure
   */
  chunkSections(
    sections: RegulatorySection[],
    documentId: string,
    sourceType: RegulatorySourceType,
    baseMetadata: ChunkMetadata = {}
  ): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = this.chunkSection(
        section,
        documentId,
        chunkIndex,
        sourceType,
        baseMetadata
      );
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }

    logger.info(
      { totalChunks: chunks.length, sectionCount: sections.length },
      'Regulatory chunking complete'
    );

    return chunks;
  }

  /**
   * Chunk a single regulatory section
   */
  private chunkSection(
    section: RegulatorySection,
    documentId: string,
    startIndex: number,
    sourceType: RegulatorySourceType,
    baseMetadata: ChunkMetadata
  ): ChunkInput[] {
    const { maxChunkTokens, includeParentHeaders, preserveNumbering } = this.options;

    // Build section header for context
    const header = this.buildSectionHeader(section);

    // If section fits in one chunk
    if (section.content.length <= maxChunkTokens) {
      const content = includeParentHeaders
        ? `${header}\n\n${section.content}`
        : section.content;

      return [{
        documentId,
        chunkIndex: startIndex,
        content: content.trim(),
        startChar: section.startIndex,
        endChar: section.endIndex,
        metadata: this.buildRegulatoryMetadata(section, sourceType, baseMetadata),
      }];
    }

    // Section needs splitting - try to split at subsection boundaries
    const chunks: ChunkInput[] = [];

    if (section.subsections.length > 0 && preserveNumbering) {
      chunks.push(...this.chunkBySubsections(
        section, header, documentId, startIndex, sourceType, baseMetadata
      ));
    } else {
      chunks.push(...this.chunkByParagraphs(
        section, header, documentId, startIndex, sourceType, baseMetadata
      ));
    }

    return chunks;
  }

  /**
   * Chunk section by subsection boundaries
   */
  private chunkBySubsections(
    section: RegulatorySection,
    header: string,
    documentId: string,
    startIndex: number,
    sourceType: RegulatorySourceType,
    baseMetadata: ChunkMetadata
  ): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    const { maxChunkTokens } = this.options;

    let currentContent = header + '\n\n';
    let currentStart = section.startIndex;
    let localIndex = 0;

    for (const subsection of section.subsections) {
      const subsectionWithContext = subsection.content;

      if (currentContent.length + subsectionWithContext.length > maxChunkTokens) {
        // Save current chunk
        if (currentContent.trim().length > header.length) {
          chunks.push({
            documentId,
            chunkIndex: startIndex + localIndex,
            content: currentContent.trim(),
            startChar: currentStart,
            endChar: subsection.startIndex,
            metadata: this.buildRegulatoryMetadata(section, sourceType, baseMetadata),
          });
          localIndex++;
        }
        currentContent = header + '\n\n' + subsectionWithContext + '\n\n';
        currentStart = subsection.startIndex;
      } else {
        currentContent += subsectionWithContext + '\n\n';
      }
    }

    // Add final chunk
    if (currentContent.trim().length > header.length) {
      chunks.push({
        documentId,
        chunkIndex: startIndex + localIndex,
        content: currentContent.trim(),
        startChar: currentStart,
        endChar: section.endIndex,
        metadata: this.buildRegulatoryMetadata(section, sourceType, baseMetadata),
      });
    }

    return chunks;
  }

  /**
   * Chunk section by paragraph boundaries
   */
  private chunkByParagraphs(
    section: RegulatorySection,
    header: string,
    documentId: string,
    startIndex: number,
    sourceType: RegulatorySourceType,
    baseMetadata: ChunkMetadata
  ): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    const { maxChunkTokens } = this.options;

    const paragraphs = section.content.split(/\n\n+/);
    let currentContent = header + '\n\n';
    let currentStart = section.startIndex;
    let localIndex = 0;
    let charOffset = section.startIndex;

    for (const paragraph of paragraphs) {
      if (currentContent.length + paragraph.length > maxChunkTokens) {
        if (currentContent.trim().length > header.length) {
          chunks.push({
            documentId,
            chunkIndex: startIndex + localIndex,
            content: currentContent.trim(),
            startChar: currentStart,
            endChar: charOffset,
            metadata: this.buildRegulatoryMetadata(section, sourceType, baseMetadata),
          });
          localIndex++;
        }
        currentContent = header + '\n\n' + paragraph + '\n\n';
        currentStart = charOffset;
      } else {
        currentContent += paragraph + '\n\n';
      }
      charOffset += paragraph.length + 2;
    }

    // Add final chunk
    if (currentContent.trim().length > header.length) {
      chunks.push({
        documentId,
        chunkIndex: startIndex + localIndex,
        content: currentContent.trim(),
        startChar: currentStart,
        endChar: section.endIndex,
        metadata: this.buildRegulatoryMetadata(section, sourceType, baseMetadata),
      });
    }

    return chunks;
  }

  /**
   * Build section header for context
   */
  private buildSectionHeader(section: RegulatorySection): string {
    const parts: string[] = [];

    if (section.chapterNumber) {
      parts.push(`Chapter ${section.chapterNumber}`);
      if (section.chapterTitle) {
        parts.push(`- ${section.chapterTitle}`);
      }
    }

    if (section.sectionNumber) {
      parts.push(`\n§ ${section.sectionNumber}`);
    }

    if (section.sectionTitle) {
      parts.push(`. ${section.sectionTitle}`);
    }

    return parts.join('');
  }

  /**
   * Build regulatory chunk metadata
   */
  private buildRegulatoryMetadata(
    section: RegulatorySection,
    sourceType: RegulatorySourceType,
    baseMetadata: ChunkMetadata
  ): RegulatoryChunkMetadata {
    const sectionPath: string[] = [];
    if (section.chapterNumber) sectionPath.push(`Chapter ${section.chapterNumber}`);
    if (section.sectionNumber) sectionPath.push(`§ ${section.sectionNumber}`);

    // Determine legal weight based on source type
    let legalWeight: 'regulatory' | 'guidance' | 'informational';
    switch (sourceType) {
      case 'pa_code':
      case 'pa_bulletin':
        legalWeight = 'regulatory';
        break;
      case 'oim_handbook':
        legalWeight = 'guidance';
        break;
      default:
        legalWeight = 'informational';
    }

    return {
      ...baseMetadata,
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      sectionPath,
      sectionTitle: section.sectionTitle,
      sourceAuthority: sourceType,
      legalWeight,
      crossReferences: section.crossReferences,
      effectiveDate: section.effectiveDate?.toISOString(),
      amendmentCitation: section.amendmentCitation,
    };
  }

  /**
   * Register a definition for potential inline injection
   */
  registerDefinition(term: string, definition: string): void {
    this.definitions.set(term.toLowerCase(), definition);
  }

  /**
   * Inject definitions for referenced terms (if enabled)
   */
  injectDefinitions(chunk: ChunkInput): ChunkInput {
    if (!this.options.inlineDefinitions || this.definitions.size === 0) {
      return chunk;
    }

    let content = chunk.content;
    const injectedDefs: string[] = [];

    for (const [term] of this.definitions) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(content) && !injectedDefs.includes(term)) {
        injectedDefs.push(term);
      }
    }

    if (injectedDefs.length > 0) {
      const defSection = injectedDefs
        .map(term => `**${term}**: ${this.definitions.get(term.toLowerCase())}`)
        .join('\n');
      content = `[Definitions]\n${defSection}\n\n${content}`;
    }

    return {
      ...chunk,
      content,
    };
  }
}

/**
 * Create a regulatory chunker with default or custom options
 */
export function createRegulatoryChunker(
  options: Partial<RegulatoryChunkOptions> = {}
): RegulatoryChunker {
  return new RegulatoryChunker(options);
}
