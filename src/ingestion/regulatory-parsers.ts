/**
 * Parsers for different regulatory document formats
 * Handles PA Code, OIM Handbook, and PA Bulletin structures
 */

import { createChildLogger } from '../utils/logger.js';
import {
  RegulatorySection,
  RegulatorySubsection,
  RegulatorySourceType,
} from './regulatory-types.js';

const logger = createChildLogger('regulatory-parsers');

/**
 * Parse regulatory text into structured sections based on source type
 */
export function parseRegulatoryStructure(
  content: string,
  sourceType: RegulatorySourceType
): RegulatorySection[] {
  logger.debug({ sourceType, contentLength: content.length }, 'Parsing regulatory structure');

  switch (sourceType) {
    case 'pa_code':
      return parsePACodeStructure(content);
    case 'oim_handbook':
      return parseOIMHandbookStructure(content);
    case 'pa_bulletin':
      return parsePABulletinStructure(content);
    default:
      return parseGenericStructure(content);
  }
}

/**
 * Parse PA Code structure (e.g., Chapter 258)
 * Format: § 258.1. Definitions.
 */
export function parsePACodeStructure(content: string): RegulatorySection[] {
  const sections: RegulatorySection[] = [];

  // Match PA Code section pattern: § XXX.X. Title.
  const sectionRegex = /§\s*(\d+\.\d+)\.\s*([^.]+)\./g;
  const matches = [...content.matchAll(sectionRegex)];

  if (matches.length === 0) {
    return parseGenericStructure(content);
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

    const subsections = parseSubsections(sectionContent, startIndex);
    const crossRefs = extractCrossReferences(sectionContent);

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
export function parseOIMHandbookStructure(content: string): RegulatorySection[] {
  const sections: RegulatorySection[] = [];

  // Match OIM section pattern: XXX.X Title or XXX.X.X Title
  const sectionRegex = /^(\d{3}(?:\.\d+)+)\s+(.+?)(?:\n|$)/gm;
  const matches = [...content.matchAll(sectionRegex)];

  if (matches.length === 0) {
    return parseGenericStructure(content);
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

    const subsections = parseSubsections(sectionContent, startIndex);
    const crossRefs = extractCrossReferences(sectionContent);

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
export function parsePABulletinStructure(content: string): RegulatorySection[] {
  const sections: RegulatorySection[] = [];

  // Match notice headers: [XX Pa.B. XXXX] or agency names
  const noticeRegex = /\[(\d+\s+Pa\.B\.\s+\d+)\]|DEPARTMENT OF HUMAN SERVICES/gi;
  const matches = [...content.matchAll(noticeRegex)];

  if (matches.length === 0) {
    return parseGenericStructure(content);
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
      crossReferences: extractCrossReferences(sectionContent),
      amendmentCitation: match[1],
    });
  }

  logger.info({ sectionCount: sections.length }, 'Parsed PA Bulletin structure');
  return sections;
}

/**
 * Generic structure parsing for unknown formats
 */
export function parseGenericStructure(content: string): RegulatorySection[] {
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
      crossReferences: extractCrossReferences(content),
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
      subsections: parseSubsections(sectionContent, startIndex),
      content: sectionContent,
      startIndex,
      endIndex,
      crossReferences: extractCrossReferences(sectionContent),
    });
  }

  return sections;
}

/**
 * Parse subsections like (a), (b), (c) or (1), (2), (3)
 */
export function parseSubsections(content: string, baseOffset: number): RegulatorySubsection[] {
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
export function extractCrossReferences(text: string): string[] {
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
