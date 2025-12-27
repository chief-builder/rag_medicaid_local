# Pennsylvania Medicaid Source Enhancement Plan

> **Status**: DRAFT - Awaiting approval before implementation
> **Created**: 2025-12-27
> **Branch**: `claude/review-project-docs-RkWHL`

---

## Executive Summary

This document outlines opportunities to enhance the RAG system's source coverage and currency monitoring based on a comprehensive review of Pennsylvania-focused Medicaid source requirements. The plan prioritizes **official DHS/PA Code sources** while maintaining the existing PHLP secondary references.

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
| Source URL | https://www.dhs.pa.gov/providers/Providers/Pages/OIM-Long-Term-Care-Manual.aspx |
| Document Type | `oim_handbook` (new) |
| Update Frequency | `as_needed` (changes several times/year) |
| Sensitive Topics | Yes (eligibility, transfers, spousal rules) |

#### 2. Policy Handbooks & Manuals Index
**Status**: NOT IN REGISTRY
**Priority**: HIGH
**Rationale**: Official entry point for all OIM manuals; provides navigation context.

| Field | Value |
|-------|-------|
| Source URL | https://www.dhs.pa.gov/providers/Providers/Pages/Policy-Handbooks-and-Manuals.aspx |
| Document Type | `policy_index` (new) |
| Update Frequency | `as_needed` |

#### 3. Recent OIM Operations Memoranda & Policy Clarifications
**Status**: NOT TRACKED
**Priority**: CRITICAL
**Rationale**: This is the primary *change feed* - contains mid-year clarifications that affect eligibility rules.

| Field | Value |
|-------|-------|
| Source URL | https://www.dhs.pa.gov/providers/Providers/Pages/OIM-Policy-Clarifications.aspx |
| Document Type | `oim_ops_memo` (new) |
| Update Frequency | `weekly` (new frequency type needed) |
| Monitoring | Should be checked weekly for new memos |

---

### B. Missing Pennsylvania Legal Authority (Priority: HIGH)

#### 4. PA Code Chapter 258 — Medical Assistance Estate Recovery
**Status**: NOT IN REGISTRY
**Priority**: HIGH
**Rationale**: The actual regulatory text. When users ask "what's the law," this is *the law*.

| Field | Value |
|-------|-------|
| Source URL | https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html |
| Document Type | `pa_code` (new) |
| Update Frequency | `as_needed` (regulatory changes are infrequent but high-impact) |
| Sensitive Topics | Yes (estate recovery) |

#### 5. PA Bulletin Notices (Program Changes)
**Status**: NOT TRACKED
**Priority**: HIGH
**Rationale**: Official legal notices for program expansions, rate changes, policy updates. Example: LIFE expansion notices.

| Field | Value |
|-------|-------|
| Source URL | https://www.pacodeandbulletin.gov/Display/pabull |
| Document Type | `pa_bulletin` (new) |
| Update Frequency | `weekly` (published every Saturday) |
| Monitoring | Should be checked weekly for DHS-related notices |
| Example | LIFE expansion notice Sep 13, 2025 |

---

### C. Missing CHC / Managed Care Context (Priority: MEDIUM)

#### 6. Community HealthChoices Publications Hub
**Status**: Only have PHLP's advocacy guide (secondary)
**Priority**: MEDIUM
**Rationale**: Official CHC publications from PA DHS provide authoritative procedures, fair hearing info, and plan contacts.

| Field | Value |
|-------|-------|
| Source URL | https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/community-healthchoices/publications |
| Document Type | `chc_publications` (new) |
| Update Frequency | `quarterly` |

#### 7. CHC Participant Handbook Templates
**Status**: NOT IN REGISTRY
**Priority**: MEDIUM
**Rationale**: Plan-specific handbooks contain procedures, grievance processes, and contact information.

| Field | Value |
|-------|-------|
| Source URL | (from individual MCO plans) |
| Document Type | `chc_handbook` (new) |
| Update Frequency | `annually` |

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

### High Priority (Phase 1)

| # | Document | Type | Monitoring |
|---|----------|------|------------|
| 1 | OIM Long-Term Care Handbook | Primary | Monthly |
| 2 | OIM Ops Memos & Policy Clarifications | Primary | Weekly |
| 3 | PA Code Chapter 258 (Estate Recovery) | Primary | As-needed |
| 4 | PA Bulletin (DHS notices) | Primary | Weekly |

### Medium Priority (Phase 2)

| # | Document | Type | Monitoring |
|---|----------|------|------------|
| 5 | Policy Handbooks & Manuals Index | Primary | Monthly |
| 6 | CHC Publications Hub | Primary | Quarterly |
| 7 | CHC Participant Handbook Templates | Primary | Annually |

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

## Open Questions for Discussion

1. **OIM Handbook Format**: The OIM LTC Handbook may be a multi-chapter HTML document. Should we capture it as a single PDF or multiple section documents?

2. **PA Bulletin Scope**: PA Bulletin is published weekly with many notices. Should we filter only for DHS/Medicaid-related notices or capture all?

3. **CHC Plan Handbooks**: There are multiple MCO plans (e.g., UPMC, AmeriHealth Caritas, PA Health & Wellness). Should we include handbooks from all plans or focus on a subset?

4. **Monitoring Automation**: Should we implement automated scraping/change detection, or is a manual checklist sufficient for the initial version?

5. **Legal Text Chunking**: PA Code regulatory text may require different chunking strategies than prose documents. Should we create a specialized chunker?

---

## Appendix: Complete Source Checklist

### A) Pennsylvania DHS Official Guidance (Primary)

| Source | Current Status | Action |
|--------|----------------|--------|
| Medicaid and Payment of Long-Term Services | In registry | None |
| Estate Recovery Program overview | In registry | None |
| LIFE program page + enrollment guidance | In registry | None |
| General Medicaid eligibility overview | In registry (Healthy Horizons) | None |
| Policy Handbooks & Manuals index | **MISSING** | Add (Phase 2) |
| OIM Long-Term Care Handbook | **MISSING** | Add (Phase 1) |
| Recent OIM Ops Memos & Policy Clarifications | **MISSING** | Add (Phase 1) |

### B) Pennsylvania Legal Authority (Primary)

| Source | Current Status | Action |
|--------|----------------|--------|
| PA Code Chapter 258 (Estate Recovery) | **MISSING** | Add (Phase 1) |
| PA Bulletin notices | **MISSING** | Add (Phase 1) |

### C) CHC / Managed Care Context

| Source | Current Status | Action |
|--------|----------------|--------|
| Community HealthChoices publications | **MISSING** (only PHLP guide) | Add (Phase 3) |
| CHC Participant Handbook templates | **MISSING** | Add (Phase 3) |

### D) Support & Referrals

| Source | Current Status | Action |
|--------|----------------|--------|
| PHLP Helpline + hours | In guardrails | None |

### E) Limits Cheat Sheets (Secondary)

| Source | Current Status | Action |
|--------|----------------|--------|
| PHLP 2025 Income and Resource Limits | In registry | None |

---

*End of Enhancement Plan*
