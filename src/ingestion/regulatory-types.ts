/**
 * Types and interfaces for regulatory text chunking
 */

import { ChunkMetadata } from '../types/index.js';

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
 * Source types for regulatory documents
 */
export type RegulatorySourceType = 'pa_code' | 'oim_handbook' | 'pa_bulletin';

/**
 * Default options for regulatory chunking
 */
export const DEFAULT_REGULATORY_OPTIONS: RegulatoryChunkOptions = {
  maxChunkTokens: 1024,
  includeParentHeaders: true,
  inlineDefinitions: false,  // Can be enabled when definitions are parsed
  expandCrossRefs: false,    // Careful with size
  preserveNumbering: true,
  preserveTables: true,
};
