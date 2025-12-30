import { ChunkInput, ChunkMetadata } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('regulatory-chunker');

/**
 * Options for regulatory text chunking
 */
export interface RegulatoryChunkOptions {
  maxChunkTokens: number;           // Target chunk size (larger for legal: 1024)
  includeParentHeaders: boolean;    // Always include chapter/section titles
  inlineDefinitions: boolean;       // Include definitions when terms appear
  expandCrossRefs: boolean;         // Inline referenced sections
  preserveNumbering: boolean;       // Keep (a), (b), (c) numbering intact
  preserveTables: boolean;          // Keep table structures intact
}

/**
 * Represents a section in regulatory text
 */
export interface RegulatorySection {
  chapterNumber?: string;
  chapterTitle?: string;
  sectionNumber: string;
  sectionTitle: string;
  subsections: RegulatorySubsection[];
  content: string;
  startIndex: number;
  endIndex: number;
  crossReferences: string[];
  effectiveDate?: Date;
  amendmentCitation?: string;
}

/**
 * Represents a subsection (a), (b), (c), etc.
 */
export interface RegulatorySubsection {
  number: string;       // "(a)", "(1)", "(i)"
  title?: string;       // Some subsections have titles
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extended chunk metadata for regulatory content
 */
export interface RegulatoryChunkMetadata extends ChunkMetadata {
  // Legal structure
  chapterNumber?: string;
  sectionNumber?: string;
  subsectionNumber?: string;
  sectionPath: string[];
  sectionTitle?: string;

  // Legal context
  sourceAuthority: 'pa_code' | 'oim_handbook' | 'pa_bulletin';
  legalWeight: 'regulatory' | 'guidance' | 'informational';
  effectiveDate?: string;

  // Cross-references
  crossReferences: string[];

  // Amendment tracking
  lastAmended?: string;
  amendmentCitation?: string;
}

/**
 * Default options for regulatory chunking
 */
const DEFAULT_OPTIONS: RegulatoryChunkOptions = {
  maxChunkTokens: 1024,
  includeParentHeaders: true,
  inlineDefinitions: false,  // Can be enabled when definitions are parsed
  expandCrossRefs: false,    // Careful with size
  preserveNumbering: true,
  preserveTables: true,
};

/**
 * Specialized chunker for regulatory and legal text
 * Preserves section structure, cross-references, and legal hierarchy
 */
export class RegulatoryChunker {
  private options: RegulatoryChunkOptions;
  private definitions: Map<string, string> = new Map();

  constructor(options: Partial<RegulatoryChunkOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse regulatory text into structured sections
   */
  parseStructure(
    content: string,
    sourceType: 'pa_code' | 'oim_handbook' | 'pa_bulletin'
  ): RegulatorySection[] {
    logger.debug({ sourceType, contentLength: content.length }, 'Parsing regulatory structure');

    switch (sourceType) {
      case 'pa_code':
        return this.parsePACodeStructure(content);
      case 'oim_handbook':
        return this.parseOIMHandbookStructure(content);
      case 'pa_bulletin':
        return this.parsePABulletinStructure(content);
      default:
        return this.parseGenericStructure(content);
    }
  }

  /**
   * Parse PA Code structure (e.g., Chapter 258)
   * Format: § 258.1. Definitions.
   */
  private parsePACodeStructure(content: string): RegulatorySection[] {
    const sections: RegulatorySection[] = [];

    // Match PA Code section pattern: § XXX.X. Title.
    const sectionRegex = /§\s*(\d+\.\d+)\.\s*([^.]+)\./g;
    const matches = [...content.matchAll(sectionRegex)];

    if (matches.length === 0) {
      // Fallback to generic parsing
      return this.parseGenericStructure(content);
    }

    // Extract chapter number from first section
    const chapterMatch = content.match(/CHAPTER\s+(\d+)/i);
    const chapterNumber = chapterMatch ? chapterMatch[1] : undefined;
    const chapterTitleMatch = content.match(/CHAPTER\s+\d+[.\s]+([^\n]+)/i);
    const chapterTitle = chapterTitleMatch ? chapterTitleMatch[1].trim() : undefined;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const sectionNumber = match[1];
      const sectionTitle = match[2].trim();
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
      const sectionContent = content.substring(startIndex, endIndex);

      // Extract subsections (a), (b), (c)
      const subsections = this.parseSubsections(sectionContent, startIndex);

      // Extract cross-references
      const crossRefs = this.extractCrossReferences(sectionContent);

      sections.push({
        chapterNumber,
        chapterTitle,
        sectionNumber,
        sectionTitle,
        subsections,
        content: sectionContent,
        startIndex,
        endIndex,
        crossReferences: crossRefs,
      });
    }

    logger.info({ sectionCount: sections.length, chapterNumber }, 'Parsed PA Code structure');
    return sections;
  }

  /**
   * Parse OIM Handbook structure
   * Format: 403.1 General Policy or numbered sections
   */
  private parseOIMHandbookStructure(content: string): RegulatorySection[] {
    const sections: RegulatorySection[] = [];

    // Match OIM section pattern: XXX.X Title or XXX.X.X Title
    const sectionRegex = /^(\d{3}(?:\.\d+)+)\s+(.+?)(?:\n|$)/gm;
    const matches = [...content.matchAll(sectionRegex)];

    if (matches.length === 0) {
      return this.parseGenericStructure(content);
    }

    // Extract chapter from first section number (e.g., 403 from 403.1)
    const firstSection = matches[0][1];
    const chapterNumber = firstSection.split('.')[0];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const sectionNumber = match[1];
      const sectionTitle = match[2].trim();
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
      const sectionContent = content.substring(startIndex, endIndex);

      const subsections = this.parseSubsections(sectionContent, startIndex);
      const crossRefs = this.extractCrossReferences(sectionContent);

      sections.push({
        chapterNumber,
        sectionNumber,
        sectionTitle,
        subsections,
        content: sectionContent,
        startIndex,
        endIndex,
        crossReferences: crossRefs,
      });
    }

    logger.info({ sectionCount: sections.length, chapterNumber }, 'Parsed OIM handbook structure');
    return sections;
  }

  /**
   * Parse PA Bulletin structure
   * Typically notices with dates and agency headers
   */
  private parsePABulletinStructure(content: string): RegulatorySection[] {
    const sections: RegulatorySection[] = [];

    // Match notice headers: [XX Pa.B. XXXX] or agency names
    const noticeRegex = /\[(\d+\s+Pa\.B\.\s+\d+)\]|DEPARTMENT OF HUMAN SERVICES/gi;
    const matches = [...content.matchAll(noticeRegex)];

    if (matches.length === 0) {
      return this.parseGenericStructure(content);
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const citation = match[1] || 'DHS Notice';
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
      const sectionContent = content.substring(startIndex, endIndex);

      // Try to extract title from content
      const titleMatch = sectionContent.match(/\n([A-Z][^\n]+)\n/);
      const sectionTitle = titleMatch ? titleMatch[1].trim() : 'Notice';

      sections.push({
        sectionNumber: citation,
        sectionTitle,
        subsections: [],
        content: sectionContent,
        startIndex,
        endIndex,
        crossReferences: this.extractCrossReferences(sectionContent),
        amendmentCitation: match[1],
      });
    }

    logger.info({ sectionCount: sections.length }, 'Parsed PA Bulletin structure');
    return sections;
  }

  /**
   * Generic structure parsing for unknown formats
   */
  private parseGenericStructure(content: string): RegulatorySection[] {
    const sections: RegulatorySection[] = [];

    // Try to find any numbered or header patterns
    const headerRegex = /^((?:#{1,4}\s+)?(?:\d+\.?)+\s+.+)$/gm;
    const matches = [...content.matchAll(headerRegex)];

    if (matches.length === 0) {
      // No structure found, return as single section
      return [{
        sectionNumber: '1',
        sectionTitle: 'Content',
        subsections: [],
        content,
        startIndex: 0,
        endIndex: content.length,
        crossReferences: this.extractCrossReferences(content),
      }];
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const headerText = match[1].replace(/^#+\s*/, '');
      const numberMatch = headerText.match(/^([\d.]+)\s*/);
      const sectionNumber = numberMatch ? numberMatch[1] : String(i + 1);
      const sectionTitle = headerText.replace(/^[\d.]+\s*/, '').trim();
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
      const sectionContent = content.substring(startIndex, endIndex);

      sections.push({
        sectionNumber,
        sectionTitle,
        subsections: this.parseSubsections(sectionContent, startIndex),
        content: sectionContent,
        startIndex,
        endIndex,
        crossReferences: this.extractCrossReferences(sectionContent),
      });
    }

    return sections;
  }

  /**
   * Parse subsections like (a), (b), (c) or (1), (2), (3)
   */
  private parseSubsections(content: string, baseOffset: number): RegulatorySubsection[] {
    const subsections: RegulatorySubsection[] = [];

    // Match (a), (b), (1), (2), (i), (ii) at start of line or after period
    const subsectionRegex = /(?:^|\.\s+)\(([a-z]|\d+|[ivx]+)\)\s+/gim;
    const matches = [...content.matchAll(subsectionRegex)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const number = `(${match[1]})`;
      const startIndex = match.index! + match[0].indexOf('(');
      const endIndex = i < matches.length - 1
        ? matches[i + 1].index! + matches[i + 1][0].indexOf('(')
        : content.length;

      subsections.push({
        number,
        content: content.substring(startIndex, endIndex).trim(),
        startIndex: baseOffset + startIndex,
        endIndex: baseOffset + endIndex,
      });
    }

    return subsections;
  }

  /**
   * Extract cross-references from text
   */
  extractCrossReferences(text: string): string[] {
    const refs: Set<string> = new Set();

    // PA Code references: § XXX.X or Chapter XXX
    const paCodeRefs = text.matchAll(/§\s*(\d+\.\d+)/g);
    for (const match of paCodeRefs) {
      refs.add(`§ ${match[1]}`);
    }

    // Chapter references
    const chapterRefs = text.matchAll(/Chapter\s+(\d+)/gi);
    for (const match of chapterRefs) {
      refs.add(`Chapter ${match[1]}`);
    }

    // OIM handbook references: XXX.X
    const oimRefs = text.matchAll(/(?:section|see)\s+(\d{3}\.\d+)/gi);
    for (const match of oimRefs) {
      refs.add(match[1]);
    }

    return Array.from(refs);
  }

  /**
   * Chunk sections respecting legal structure
   */
  chunkSections(
    sections: RegulatorySection[],
    documentId: string,
    sourceType: 'pa_code' | 'oim_handbook' | 'pa_bulletin',
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
    sourceType: 'pa_code' | 'oim_handbook' | 'pa_bulletin',
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
      // Group subsections into chunks
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
    } else {
      // No subsections or not preserving - use paragraph-based chunking
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
    sourceType: 'pa_code' | 'oim_handbook' | 'pa_bulletin',
    baseMetadata: ChunkMetadata
  ): RegulatoryChunkMetadata {
    const sectionPath: string[] = [];
    if (section.chapterNumber) sectionPath.push(`Chapter ${section.chapterNumber}`);
    if (section.sectionNumber) sectionPath.push(`§ ${section.sectionNumber}`);

    // Determine legal weight based on source type
    let legalWeight: 'regulatory' | 'guidance' | 'informational';
    switch (sourceType) {
      case 'pa_code':
        legalWeight = 'regulatory';
        break;
      case 'oim_handbook':
        legalWeight = 'guidance';
        break;
      case 'pa_bulletin':
        legalWeight = 'regulatory';
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
