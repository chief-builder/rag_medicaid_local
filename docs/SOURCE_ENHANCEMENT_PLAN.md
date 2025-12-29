# Pennsylvania Medicaid Source Enhancement Plan

> **Status**: DRAFT - Updated with decisions, awaiting implementation approval
> **Created**: 2025-12-27
> **Updated**: 2025-12-29
> **Branch**: `claude/review-project-docs-RkWHL`

---

## Executive Summary

This document outlines opportunities to enhance the RAG system's source coverage and currency monitoring based on a comprehensive review of Pennsylvania-focused Medicaid source requirements. The plan prioritizes **official DHS/PA Code sources** while maintaining the existing PHLP secondary references.

---

## OIM Policy Manuals Architecture (Discovered)

The Pennsylvania DHS Office of Income Maintenance (OIM) maintains authoritative policy manuals in an HTML-based structure at `services.dpw.state.pa.us/oimpolicymanuals/`.

### Two Primary Handbooks

| Handbook | Base URL | Purpose |
|----------|----------|---------|
| **Medical Assistance Eligibility Handbook** | http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm | General MA eligibility rules |
| **Long-Term Care Handbook** | http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm | LTC-specific eligibility (nursing home, HCBS) |

### Key Sections Identified

#### Medical Assistance Handbook Sections
| Section | URL Pattern | Content |
|---------|-------------|---------|
| **300 - Forms, Ops Memos, Policy Clarifications** | `/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/` | Change feed (critical) |
| **Operations Memoranda** | `/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm` | Policy updates |
| **Policy Clarifications** | `/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm` | Rule clarifications |
| **316 - MAWD** | `/ma/316_MAWD/316_02_Deciding_on_Eligibility.htm` | Workers with Disabilities |
| **338 - MA Benefits** | `/ma/338_Medical_Assistance_Benefits/338_5_Using_Medical_Assistance.htm` | Using MA coverage |

#### Long-Term Care Handbook Sections
| Section | URL Pattern | Content |
|---------|-------------|---------|
| **400 - Forms** | `/ltc/400_Forms_OPSMemo_PolicyClarifications/400_Forms.htm` | LTC forms |
| **403 - General Policy** | `/ltc/403_General_Information/403_1_General_Policy.htm` | Eligibility requirements |

### Source Format: HTML (Multi-Page)

The OIM manuals are **HTML-based with hierarchical navigation**, not PDFs. This requires:
1. Web scraping to capture content
2. Specialized chunking for legal/regulatory text
3. Section-level metadata preservation
4. Link resolution for cross-references

---

## Current State Assessment

### What We Have (12 Documents)

| # | Document | Source Org | Type |
|---|----------|------------|------|
| 1 | PHLP 2025 MSP Guide | PHLP | Secondary |
| 2 | PHLP CHC Waiver Eligibility Guide | PHLP | Secondary |
| 3 | PHLP 2025 Income Limits | PHLP | Secondary |
| 4 | PA DHS Estate Recovery FAQ | PA DHS | Primary |
| 5 | PA PACE/PACENET Provider Guide 2025 | PA Aging | Primary |
| 6 | PA DHS LIFE Program | PA DHS | Primary |
| 7 | PHLP Medicare/Medicaid Guide | PHLP | Secondary |
| 8 | PHLP 2025 LIS/Extra Help Guide | PHLP | Secondary |
| 9 | PA DHS Healthy Horizons | PA DHS | Primary |
| 10 | PA DHS Long-Term Care | PA DHS | Primary |
| 11 | PA DHS Estate Recovery Info | PA DHS | Primary |
| 12 | PA Aging PACE Overview | PA Aging | Primary |

**Current Balance**: 7 Primary (DHS/Aging) + 5 Secondary (PHLP)

### Existing Infrastructure Strengths

- Robust metadata schema with `effectiveDate`, `updateFrequency`, `sourceUrl`
- FreshnessChecker with 7 data types and warning levels
- Guardrails system with 5 sensitive topic categories
- PHLP helpline already integrated as professional referral
- Document deduplication via file hash

---

## Gap Analysis

### A. Missing Pennsylvania DHS Official Sources (Priority: HIGH)

#### 1. OIM Long-Term Care Handbook
**Status**: NOT IN REGISTRY
**Priority**: CRITICAL
**Rationale**: This is the *core operational policy* document used by County Assistance Offices. Contains authoritative eligibility determination procedures.

| Field | Value |
|-------|-------|
| Primary Source URL | http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm |
| Portal Page | https://www.pa.gov/agencies/dhs/resources/policy-handbooks-manuals |
| Document Type | `oim_ltc_handbook` (new) |
| Format | **HTML multi-page** (requires web scraping) |
| Key Sections | 400 (Forms), 403 (General Policy) |
| Update Frequency | `as_needed` (changes several times/year) |
| Sensitive Topics | Yes (eligibility, transfers, spousal rules) |

#### 2. OIM Medical Assistance Eligibility Handbook
**Status**: NOT IN REGISTRY
**Priority**: CRITICAL
**Rationale**: General MA eligibility rules referenced by LTC handbook. Contains MAWD, MA benefits, and cross-program rules.

| Field | Value |
|-------|-------|
| Source URL | http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm |
| Document Type | `oim_ma_handbook` (new) |
| Format | **HTML multi-page** (requires web scraping) |
| Key Sections | 316 (MAWD), 338 (MA Benefits), 300 (Ops Memos) |
| Update Frequency | `as_needed` |

#### 3. Policy Handbooks & Manuals Index
**Status**: NOT IN REGISTRY
**Priority**: HIGH
**Rationale**: Official entry point for all OIM manuals; provides navigation context.

| Field | Value |
|-------|-------|
| Source URL | https://www.pa.gov/agencies/dhs/resources/policy-handbooks-manuals |
| Document Type | `policy_index` (new) |
| Update Frequency | `as_needed` |

#### 4. Recent OIM Operations Memoranda & Policy Clarifications
**Status**: NOT TRACKED
**Priority**: CRITICAL
**Rationale**: This is the primary *change feed* - contains mid-year clarifications that affect eligibility rules.

| Field | Value |
|-------|-------|
| Operations Memoranda URL | http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm |
| Policy Clarifications URL | http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm |
| Document Type | `oim_ops_memo` (new) |
| Format | **HTML list pages** (requires automated scraping) |
| Update Frequency | `weekly` (new frequency type needed) |
| Monitoring | Automated weekly check for new memos |

---

### B. Missing Pennsylvania Legal Authority (Priority: HIGH)

#### 5. PA Code Chapter 258 — Medical Assistance Estate Recovery
**Status**: NOT IN REGISTRY
**Priority**: HIGH
**Rationale**: The actual regulatory text. When users ask "what's the law," this is *the law*.

| Field | Value |
|-------|-------|
| Source URL | https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html |
| Document Type | `pa_code` (new) |
| Update Frequency | `as_needed` (regulatory changes are infrequent but high-impact) |
| Sensitive Topics | Yes (estate recovery) |

#### 6. PA Bulletin Notices (Program Changes - DHS Only)
**Status**: NOT TRACKED
**Priority**: HIGH
**Rationale**: Official legal notices for program expansions, rate changes, policy updates. Example: LIFE expansion notices.

| Field | Value |
|-------|-------|
| Source URL | https://www.pacodeandbulletin.gov/Display/pabull |
| Document Type | `pa_bulletin` (new) |
| Update Frequency | `weekly` (published every Saturday) |
| Monitoring | Automated weekly check - **DHS notices only** (filtered) |
| Filter Keywords | "Department of Human Services", "Medical Assistance", "LIFE", "CHC", "Long-Term Care" |
| Example | LIFE expansion notice Sep 13, 2025 |

---

### C. Missing CHC / Managed Care Context (Priority: MEDIUM)

#### 7. Community HealthChoices Publications Hub
**Status**: Only have PHLP's advocacy guide (secondary)
**Priority**: MEDIUM
**Rationale**: Official CHC publications from PA DHS provide authoritative procedures, fair hearing info, and plan contacts.

| Field | Value |
|-------|-------|
| Source URL | https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/community-healthchoices/publications |
| Document Type | `chc_publications` (new) |
| Update Frequency | `quarterly` |

#### 8. CHC Participant Handbooks (All MCOs)
**Status**: NOT IN REGISTRY
**Priority**: MEDIUM
**Rationale**: Plan-specific handbooks contain procedures, grievance processes, and contact information.

| Field | Value |
|-------|-------|
| MCO Coverage | **All MCOs** (UPMC, AmeriHealth Caritas, PA Health & Wellness) |
| Document Type | `chc_handbook` (new) |
| Update Frequency | `annually` |
| Content | Grievance procedures, service authorization, fair hearing rights, provider directories |

**MCO Participant Handbooks to Include:**

| MCO | Region Coverage | Handbook Source |
|-----|-----------------|-----------------|
| UPMC Community HealthChoices | Southwest, Southeast, Lehigh/Capital | UPMC website |
| AmeriHealth Caritas PA Community HealthChoices | All regions | AmeriHealth website |
| PA Health & Wellness | All regions | PHW website |

---

### D. Support & Referrals (Priority: ALREADY COMPLETE)

| Resource | Status |
|----------|--------|
| PHLP Helpline (1-800-274-3258) | Already integrated in guardrails |
| Elder Law Attorney Referral | Already integrated |
| PA Legal Aid Network | Already integrated |

**No gaps identified.** Current guardrails system properly routes sensitive topics to professional help.

---

### E. Limits Cheat Sheets (Priority: ALREADY COMPLETE)

| Resource | Status |
|----------|--------|
| PHLP 2025 Income Limits PDF | Already in registry (priority 3) |

**Note**: User guidance specifies to cite PHLP (not DHS) for this document. Current registry correctly identifies `sourceOrg: "Pennsylvania Health Law Project"`.

---

## Versioning & Metadata Enhancements

### Current Schema Gaps

| Field | Current State | Recommended Enhancement |
|-------|---------------|-------------------------|
| `document_hash` | Exists in DB, not in registry JSON | Add to registry for change detection |
| `retrieved_at` | Missing | Add per-document retrieval timestamp |
| `published_date` | Missing | Distinguish from `effectiveDate` (when published vs. when rules take effect) |
| `version` | Missing | Track document versions (e.g., "v2.1", "January 2025 update") |

### Recommended Metadata Schema Additions

```typescript
interface EnhancedDocumentMetadata {
  // Existing fields...

  // New versioning fields
  documentHash?: string;           // SHA-256 for change detection
  retrievedAt?: Date;              // When document was downloaded/captured
  publishedDate?: Date;            // When document was officially published
  version?: string;                // Document version identifier

  // New source classification
  sourceAuthority: 'primary' | 'secondary';  // DHS/PA Code = primary, PHLP = secondary
  legalWeight: 'regulatory' | 'guidance' | 'informational';
}
```

---

## Freshness Monitoring Enhancements

### Current Gaps

| Gap | Description |
|-----|-------------|
| No automated change detection | System doesn't detect when source documents change |
| No OIM ops memo monitoring | Critical change feed not tracked |
| No PA Bulletin monitoring | Weekly legal notices not tracked |
| Answers lack freshness context | Users don't see "Sources last updated: YYYY-MM-DD" |

### Recommended Update Cadence

| Frequency | Sources to Check | Rationale |
|-----------|------------------|-----------|
| **Weekly** | OIM Ops Memos, PA Bulletin | High-signal change feeds |
| **Monthly** | Key DHS pages (LTSS, Estate Recovery, LIFE) | Core policy pages |
| **Quarterly** | CHC publications, handbook versions | Program operations |
| **Annually (Dec/Jan)** | All threshold documents (FPL, FBR, CSRA, MMMNA) | Federal measure updates |

### New FreshnessChecker Data Types Needed

```typescript
// Current types
type DataType =
  | 'federal_poverty_level'
  | 'msp_income_limits'
  | 'nursing_home_fbr'
  | 'spousal_protection'
  | 'part_d_costs'
  | 'pace_pacenet_limits'
  | 'chester_county_contacts';

// New types to add
type DataType =
  // ... existing ...
  | 'oim_ops_memo'        // Weekly check
  | 'pa_bulletin'         // Weekly check
  | 'chc_publications'    // Quarterly check
  | 'pa_code_chapter_258' // As-needed (monitor for amendments)
  | 'oim_ltc_handbook';   // As-needed
```

### New Update Frequency Types Needed

```typescript
// Current frequencies
type UpdateFrequency =
  | 'annually_january'
  | 'annually_april'
  | 'annually_october'
  | 'quarterly'
  | 'as_needed';

// New frequency to add
type UpdateFrequency =
  // ... existing ...
  | 'weekly';  // For OIM ops memos, PA Bulletin
```

---

## Answer Freshness Display

### Current Gap

User cannot see when sources were last updated or what effective period applies.

### Recommended Enhancement

Every answer should include:

```
Answer: [Generated answer with citations]

---
**Source Information**
- Sources last retrieved: 2025-10-15
- Applies to: Calendar Year 2025 (unless otherwise noted)
- Income limits effective: April 2025 - March 2026
```

### Implementation Approach

1. Track `last_ingestion_date` at the system level
2. Include `effectiveDate` range from cited documents
3. Add freshness warnings when data may be stale:

```
⚠️ Note: The 2025 Federal Poverty Level was published in January 2025.
If you're reading this after January 2026, updated figures may be available.
```

---

## Sensitive Topic Guardrails Enhancements

### Current Coverage (5 Categories)

| Category | Keywords | Status |
|----------|----------|--------|
| estate_planning | will, trust, inheritance, probate | Complete |
| spend_down | reduce assets, hide assets, protect assets | Complete |
| asset_transfer | transfer home, gift money, deed to child | Complete |
| spousal_complex | divorce for medicaid, spousal refusal | Complete |
| appeals | appeal, denied, fair hearing | Complete |

### Recommended Addition

| Category | Keywords | Disclaimer |
|----------|----------|------------|
| `look_back_period` | 60 months, 5 years, penalty period, transfer penalty | "Pennsylvania applies a 60-month (5-year) look-back period for asset transfers. Penalties can significantly delay coverage. Consult an elder law attorney." |

---

## Summary: Source Additions Required

**Total New Sources**: 8 primary sources to add

### High Priority (Phase 1) - 6 Sources

| # | Document | Type | Format | Monitoring |
|---|----------|------|--------|------------|
| 1 | OIM Long-Term Care Handbook | Primary | HTML (scrape) | Monthly |
| 2 | OIM Medical Assistance Eligibility Handbook | Primary | HTML (scrape) | Monthly |
| 3 | OIM Operations Memoranda | Primary | HTML (scrape) | Weekly |
| 4 | OIM Policy Clarifications | Primary | HTML (scrape) | Weekly |
| 5 | PA Code Chapter 258 (Estate Recovery) | Primary | HTML | As-needed |
| 6 | PA Bulletin (DHS notices only) | Primary | HTML (filtered) | Weekly |

### Medium Priority (Phase 2) - 2 Sources + MCO Handbooks

| # | Document | Type | Format | Monitoring |
|---|----------|------|--------|------------|
| 7 | CHC Publications Hub | Primary | Mixed | Quarterly |
| 8 | CHC Participant Handbooks (3 MCOs) | Primary | PDF | Annually |

**MCO Handbooks**: UPMC, AmeriHealth Caritas, PA Health & Wellness (all regions)

### Metadata & Infrastructure (Phase 3)

| Enhancement | Description |
|-------------|-------------|
| Document hashing | Add SHA-256 to detect source changes |
| Retrieved timestamp | Track when each document was captured |
| Weekly monitoring job | Automated check for OIM memos, PA Bulletin |
| Answer freshness display | Show "Sources last updated" in every answer |
| New data types | Add 5 new FreshnessChecker data types |

---

## Implementation Phases

### Phase 1: Critical Source Additions (Estimated: 1-2 sessions)

1. Add OIM LTC Handbook to document registry
2. Add PA Code Chapter 258 to document registry
3. Create tracking structure for OIM ops memos
4. Ingest new documents

### Phase 2: Change Feed Monitoring (Estimated: 1-2 sessions)

1. Add `weekly` update frequency type
2. Create monitoring entries for OIM memos and PA Bulletin
3. Add new data types to FreshnessChecker
4. Document monitoring procedures in README

### Phase 3: CHC Managed Care Sources (Estimated: 1 session)

1. Add CHC Publications Hub to registry
2. Identify and add key CHC participant handbooks
3. Update document types enum

### Phase 4: Versioning & Freshness Display (Estimated: 1-2 sessions)

1. Add new metadata fields to schema
2. Update document registry with hashes and retrieval dates
3. Modify answer generation to include freshness context
4. Add freshness warnings to sensitive topics

### Phase 5: Documentation & Monitoring SOP (Estimated: 1 session)

1. Update README with new source list
2. Create monitoring cadence checklist
3. Document procedures for checking change feeds
4. Add "look_back_period" guardrail category

---

## Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **OIM Handbook Format** | Multi-section HTML scraping | OIM manuals are HTML-based at `services.dpw.state.pa.us/oimpolicymanuals/`. Will scrape and preserve section structure. |
| **PA Bulletin Scope** | DHS notices only (filtered) | Filter for "Department of Human Services", "Medical Assistance", "LIFE", "CHC", "Long-Term Care" keywords. |
| **CHC Plan Handbooks** | All MCOs | Include UPMC, AmeriHealth Caritas, and PA Health & Wellness handbooks. |
| **Monitoring Automation** | Automated | Implement automated scraping/change detection for weekly and monthly sources. |
| **Legal Text Chunking** | Specialized strategy | Create regulatory text chunker that preserves section/subsection structure. |

---

## Automated Monitoring Architecture

### Overview

Implement a scheduled monitoring system that automatically detects changes to source documents and ingests updates.

### Component Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE MONITORING PIPELINE                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌──────────────┐     ┌───────────────┐     ┌──────────────────┐   │
│   │   Scheduler  │────▶│  Web Scraper  │────▶│  Change Detector │   │
│   │  (cron/node) │     │  (per source) │     │   (hash compare) │   │
│   └──────────────┘     └───────────────┘     └────────┬─────────┘   │
│                                                        │             │
│                                              ┌─────────▼─────────┐   │
│                                              │  Changed?         │   │
│                                              │  ┌─────┐ ┌─────┐  │   │
│                                              │  │ Yes │ │ No  │  │   │
│                                              │  └──┬──┘ └──┬──┘  │   │
│                                              └─────┼───────┼─────┘   │
│                                                    │       │         │
│                               ┌────────────────────▼───┐   │         │
│                               │   Ingestion Pipeline   │   │         │
│                               │   - Parse HTML/PDF     │   │         │
│                               │   - Chunk content      │   │         │
│                               │   - Embed & store      │   │         │
│                               └────────────────────────┘   │         │
│                                                            │         │
│                               ┌────────────────────────────▼───┐     │
│                               │   Update Monitoring Log        │     │
│                               │   - Last checked timestamp     │     │
│                               │   - Content hash               │     │
│                               │   - Change history             │     │
│                               └────────────────────────────────┘     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Monitoring Schedule

| Frequency | Sources | Trigger | Actions |
|-----------|---------|---------|---------|
| **Weekly (Sunday)** | OIM Ops Memos, Policy Clarifications, PA Bulletin (DHS) | Cron: `0 6 * * 0` | Scrape list pages, detect new items, ingest new content |
| **Monthly (1st)** | DHS LTSS page, Estate Recovery page, LIFE page, OIM Handbooks | Cron: `0 6 1 * *` | Hash compare main content, re-ingest if changed |
| **Quarterly (Jan/Apr/Jul/Oct)** | CHC Publications, MCO Handbooks | Cron: `0 6 1 1,4,7,10 *` | Check for new handbook versions |
| **Annually (January)** | All threshold documents (FPL, FBR, CSRA, MMMNA) | Cron: `0 6 15 1 *` | Full refresh of income/resource limit documents |

### Database Schema for Monitoring

```sql
-- New table for source monitoring
CREATE TABLE source_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,  -- 'oim_ops_memo', 'pa_bulletin', 'dhs_page', etc.
    check_frequency TEXT NOT NULL,  -- 'weekly', 'monthly', 'quarterly', 'annually'
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_content_hash TEXT,
    last_change_detected_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    filter_keywords TEXT[],  -- For PA Bulletin filtering
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change history log
CREATE TABLE source_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES source_monitors(id),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_hash TEXT,
    new_hash TEXT,
    change_summary TEXT,  -- Brief description of what changed
    items_added INTEGER DEFAULT 0,  -- For list-based sources (ops memos)
    auto_ingested BOOLEAN DEFAULT false,
    ingestion_status TEXT  -- 'pending', 'success', 'failed'
);

-- Index for efficient lookups
CREATE INDEX idx_source_monitors_frequency ON source_monitors(check_frequency);
CREATE INDEX idx_source_monitors_last_checked ON source_monitors(last_checked_at);
CREATE INDEX idx_change_log_monitor ON source_change_log(monitor_id);
```

### Scraper Implementation Approach

```typescript
// src/monitoring/scrapers/base-scraper.ts
interface ScraperResult {
  contentHash: string;
  content: string | string[];  // Single page or list of items
  metadata: {
    scrapedAt: Date;
    itemCount?: number;  // For list pages
    newItems?: string[];  // URLs of new items detected
  };
}

abstract class BaseScraper {
  abstract scrape(url: string): Promise<ScraperResult>;
  abstract detectChanges(previous: ScraperResult, current: ScraperResult): ChangeDetection;
}

// Specialized scrapers
class OIMOpsMemoScraper extends BaseScraper { /* List page scraping */ }
class PABulletinScraper extends BaseScraper { /* Filtered bulletin scraping */ }
class DHSPageScraper extends BaseScraper { /* Single page hash comparison */ }
class OIMHandbookScraper extends BaseScraper { /* Multi-page handbook scraping */ }
```

### Alert & Notification

When changes are detected:
1. Log change to `source_change_log` table
2. Auto-ingest new content if `auto_ingest` is enabled
3. Update FreshnessChecker with new effective dates
4. Optionally: Send notification (email/webhook) for critical sources

---

## Specialized Legal Text Chunking Strategy

### Problem Statement

Legal/regulatory text (PA Code, OIM Handbooks) has different characteristics than prose documents:
- Hierarchical structure (Chapters → Sections → Subsections → Paragraphs)
- Cross-references between sections
- Numbered lists with legal significance
- Defined terms that must remain in context
- Amendment history notations

### Chunking Strategy for Regulatory Text

#### 1. Section-Aware Chunking

Instead of fixed character-based chunking, use section boundaries:

```typescript
interface RegulatoryChunk {
  id: string;
  content: string;
  sectionPath: string[];  // e.g., ["Chapter 258", "§258.1", "General"]
  sectionNumber: string;  // e.g., "258.1"
  sectionTitle: string;   // e.g., "Definitions"
  parentSection?: string;
  childSections?: string[];
  crossReferences: string[];  // Other sections referenced
  effectiveDate?: Date;
  amendmentHistory?: string[];
}
```

#### 2. Hierarchy Preservation

```
PA Code Chapter 258 - Estate Recovery
├── §258.1 Definitions           → Chunk 1 (always include with related chunks)
├── §258.2 Statement of policy   → Chunk 2
├── §258.3 Property subject...   → Chunk 3
│   ├── (a) Recoverable property → Sub-chunk 3a
│   ├── (b) Exceptions           → Sub-chunk 3b
│   └── (c) Liens                → Sub-chunk 3c
└── §258.4 Procedures            → Chunk 4
```

#### 3. Context Window Strategy

For regulatory text, include:
- **Header context**: Chapter and section titles (always prepended)
- **Definition injection**: When a defined term appears, include its definition
- **Cross-reference expansion**: Optionally inline referenced sections

```typescript
interface RegulatoryChunkOptions {
  includeParentHeaders: boolean;  // Always true for legal text
  inlineDefinitions: boolean;     // Include §258.1 definitions when terms appear
  expandCrossRefs: boolean;       // Inline referenced sections (careful with size)
  preserveNumbering: boolean;     // Keep (a), (b), (c) numbering intact
  maxChunkTokens: number;         // Target chunk size (larger for legal: 1024)
}
```

#### 4. OIM Handbook Chunking

For HTML-based OIM manuals:

```typescript
// Parse HTML structure into logical sections
interface OIMSection {
  chapterNumber: string;      // "403"
  chapterTitle: string;       // "General Information"
  sectionNumber: string;      // "403.1"
  sectionTitle: string;       // "General Policy"
  subsections: OIMSubsection[];
  htmlContent: string;        // Original HTML (for rendering)
  markdownContent: string;    // Converted for embedding
}

// Chunking rules for OIM:
// 1. Never split within a numbered list
// 2. Keep policy statements with their exceptions
// 3. Preserve table structures intact
// 4. Include section header in every chunk
```

#### 5. Implementation

New file: `src/ingestion/regulatory-chunker.ts`

```typescript
export class RegulatoryChunker {
  constructor(private options: RegulatoryChunkOptions) {}

  /**
   * Parse regulatory text into structured sections
   */
  parseStructure(content: string, sourceType: 'pa_code' | 'oim_handbook'): RegulatorySection[];

  /**
   * Chunk sections respecting legal structure
   */
  chunkSections(sections: RegulatorySection[]): RegulatoryChunk[];

  /**
   * Extract cross-references from text
   */
  extractCrossReferences(text: string): string[];

  /**
   * Inject definitions for referenced terms
   */
  injectDefinitions(chunk: RegulatoryChunk, definitions: Map<string, string>): RegulatoryChunk;
}
```

#### 6. Metadata for Legal Chunks

Enhanced chunk metadata for regulatory content:

```typescript
interface RegulatoryChunkMetadata extends ChunkMetadata {
  // Legal structure
  chapterNumber: string;
  sectionNumber: string;
  subsectionNumber?: string;
  sectionPath: string[];

  // Legal context
  sourceAuthority: 'pa_code' | 'oim_handbook' | 'pa_bulletin';
  legalWeight: 'regulatory' | 'guidance' | 'informational';
  effectiveDate?: Date;

  // Cross-references
  crossReferences: string[];
  referencedBy: string[];  // Sections that reference this one

  // Amendment tracking
  lastAmended?: Date;
  amendmentCitation?: string;  // e.g., "52 Pa.B. 1234"
}
```

---

## Appendix: Complete Source Checklist

### A) Pennsylvania DHS Official Guidance (Primary)

| Source | Current Status | Action | URL |
|--------|----------------|--------|-----|
| Medicaid and Payment of Long-Term Services | ✓ In registry | None | - |
| Estate Recovery Program overview | ✓ In registry | None | - |
| LIFE program page + enrollment guidance | ✓ In registry | None | - |
| General Medicaid eligibility overview | ✓ In registry (Healthy Horizons) | None | - |
| Policy Handbooks & Manuals index | **MISSING** | Add (Phase 1) | https://www.pa.gov/agencies/dhs/resources/policy-handbooks-manuals |
| OIM Long-Term Care Handbook | **MISSING** | Add (Phase 1) | http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm |
| OIM Medical Assistance Handbook | **MISSING** | Add (Phase 1) | http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm |
| OIM Operations Memoranda | **MISSING** | Add (Phase 1) | http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm |
| OIM Policy Clarifications | **MISSING** | Add (Phase 1) | http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm |

### B) Pennsylvania Legal Authority (Primary)

| Source | Current Status | Action | URL |
|--------|----------------|--------|-----|
| PA Code Chapter 258 (Estate Recovery) | **MISSING** | Add (Phase 1) | https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html |
| PA Bulletin notices (DHS only) | **MISSING** | Add (Phase 1) | https://www.pacodeandbulletin.gov/Display/pabull |

### C) CHC / Managed Care Context

| Source | Current Status | Action | URL |
|--------|----------------|--------|-----|
| CHC Publications Hub | **MISSING** (only PHLP guide) | Add (Phase 2) | https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/community-healthchoices/publications |
| UPMC CHC Participant Handbook | **MISSING** | Add (Phase 2) | (to be identified) |
| AmeriHealth Caritas CHC Handbook | **MISSING** | Add (Phase 2) | (to be identified) |
| PA Health & Wellness CHC Handbook | **MISSING** | Add (Phase 2) | (to be identified) |

### D) Support & Referrals

| Source | Current Status | Action |
|--------|----------------|--------|
| PHLP Helpline + hours | ✓ In guardrails | None |
| Elder Law Attorney Referral | ✓ In guardrails | None |
| PA Legal Aid Network | ✓ In guardrails | None |

### E) Limits Cheat Sheets (Secondary)

| Source | Current Status | Action |
|--------|----------------|--------|
| PHLP 2025 Income and Resource Limits | ✓ In registry | None |

---

## Key URLs Reference

```
# OIM Policy Manuals Base
http://services.dpw.state.pa.us/oimpolicymanuals/

# Medical Assistance Handbook
http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm
http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm
http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm

# Long-Term Care Handbook
http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm
http://services.dpw.state.pa.us/oimpolicymanuals/ltc/403_General_Information/403_1_General_Policy.htm

# PA Code & Bulletin
https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html
https://www.pacodeandbulletin.gov/Display/pabull

# DHS Portal Pages
https://www.pa.gov/agencies/dhs/resources/policy-handbooks-manuals
https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/community-healthchoices/publications
```

---

*End of Enhancement Plan*
