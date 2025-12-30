# Source Monitoring Standard Operating Procedures

> **Purpose**: Ensure Pennsylvania Medicaid RAG sources stay current and accurate.
> **Last Updated**: 2025-12-30

## Monitoring Cadence Overview

| Frequency | Sources | Check Day | Priority |
|-----------|---------|-----------|----------|
| **Weekly** | OIM Operations Memoranda, OIM Policy Clarifications, PA Bulletin (DHS) | Sunday | High |
| **Monthly** | OIM LTC Handbook, OIM MA Handbook, PA Code Chapter 258 | 1st of month | Medium |
| **Quarterly** | CHC Publications Hub | Jan 1, Apr 1, Jul 1, Oct 1 | Medium |
| **Annually** | MCO Participant Handbooks (UPMC, AmeriHealth, PHW) | January | Low |
| **Annually (Jan)** | Federal Poverty Level, Nursing Home FBR, CSRA/MMMNA | Mid-January | Critical |
| **Annually (Apr)** | MSP Income Limits | April 1 | Critical |
| **Annually (Oct)** | Part D Costs | October | Medium |

---

## Weekly Monitoring Checklist

### Sunday Morning Check (30 min)

#### 1. OIM Operations Memoranda
```bash
# Run automated check
pnpm monitor check --source "OIM Operations Memoranda" --force

# Or test scrape directly
pnpm monitor test-scrape "http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm" --type oim_ops_memo
```

**Manual verification:**
1. Navigate to [OIM Operations Memoranda](http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm)
2. Note any new memos since last check (format: YY-MM-##)
3. Review memo titles for Medicaid eligibility relevance
4. Flag memos related to: income limits, asset rules, LTC, CHC, LIFE

#### 2. OIM Policy Clarifications
```bash
pnpm monitor check --source "OIM Policy Clarifications" --force
```

**Manual verification:**
1. Navigate to [OIM Policy Clarifications](http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm)
2. Note any new clarifications
3. Review for eligibility rule interpretations

#### 3. PA Bulletin DHS Notices
```bash
pnpm monitor check --source "PA Bulletin DHS Notices" --force
```

**Manual verification:**
1. Navigate to [PA Bulletin](https://www.pacodeandbulletin.gov/Display/pabull)
2. Search for "Department of Human Services"
3. Look for notices related to:
   - Medical Assistance
   - Long-Term Care
   - Community HealthChoices
   - LIFE program

---

## Monthly Monitoring Checklist

### First of Month Check (45 min)

#### 1. OIM LTC Handbook
```bash
pnpm monitor check --source "OIM LTC Handbook" --force
```

**Key sections to review:**
- 403: General Policy (eligibility requirements)
- 440: Resource Eligibility
- 450: Income Eligibility
- 460: Transfer of Assets

#### 2. OIM MA Handbook
```bash
pnpm monitor check --source "OIM MA Handbook" --force
```

**Key sections to review:**
- 316: MAWD program
- 338: MA Benefits Usage
- 300: Operations Memoranda references

#### 3. PA Code Chapter 258
```bash
pnpm monitor check --source "PA Code Chapter 258" --force
```

**Review for:**
- Estate recovery rule changes
- New hardship waiver conditions
- Lien procedure updates

---

## Quarterly Monitoring Checklist

### CHC Publications Hub (Jan, Apr, Jul, Oct)

```bash
pnpm monitor check --source "CHC Publications Hub" --force
```

**Review for:**
1. New participant guides
2. Updated fair hearing procedures
3. Service authorization changes
4. MCO contact updates

**MCO-specific sources to check:**
- [UPMC CHC](https://www.upmchealthplan.com/chc/)
- [AmeriHealth Caritas CHC](https://www.amerihealthcaritaschc.com/)
- [PA Health & Wellness CHC](https://www.pahealthwellness.com/members/chc/)

---

## Annual Monitoring Checklist

### January: Federal Updates

| Source | Typical Publication Date | What to Look For |
|--------|--------------------------|------------------|
| Federal Poverty Level | Mid-January | New FPL figures in Federal Register |
| SSI/FBR Amounts | January 1 | SSA COLA announcement |
| CSRA/MMMNA | January 1 | CMS spousal protection amounts |
| MCO Handbooks | January | New annual versions |

**FPL Update Process:**
1. Check [ASPE Poverty Guidelines](https://aspe.hhs.gov/poverty-guidelines)
2. Update document-registry.json with new effective date
3. Flag income_limits documents for re-ingestion
4. Update PHLP income limits PDF when available

### April: MSP Updates

| Source | Typical Publication Date | What to Look For |
|--------|--------------------------|------------------|
| MSP Income Limits | April 1 | New QMB/SLMB/QI limits |

**MSP Update Process:**
1. Check PHLP website for new MSP guide
2. Verify limits in PA DHS announcements
3. Update msp_guide documents
4. Review PHLP 2025 MSP Guide PDF

### October: Medicare Updates

| Source | Typical Publication Date | What to Look For |
|--------|--------------------------|------------------|
| Part D Costs | October | Premium, deductible changes |
| Medicare Open Enrollment | Oct 15 - Dec 7 | New materials |

---

## Change Detection Procedures

### Automated Change Detection

The monitoring system automatically:
1. **Fetches** source pages on schedule
2. **Hashes** content to detect changes
3. **Compares** with previous hash
4. **Logs** changes detected

```bash
# View recent changes
pnpm monitor changes --limit 20

# Check monitor status
pnpm monitor status
```

### When Changes Are Detected

1. **Review the change:**
   - Is it a substantive policy update or minor formatting?
   - Does it affect eligibility rules?
   - Is it relevant to seniors and their families?

2. **If substantive update:**
   ```bash
   # Re-ingest the updated source
   pnpm ingest --source "Source Name"
   ```

3. **Update metadata:**
   - Modify `effectiveDate` in document-registry.json
   - Update version notes if applicable

4. **Verify freshness tracking:**
   - Confirm FreshnessChecker recognizes the update
   - Test that answers include updated freshness info

---

## Critical Alert Thresholds

### Immediate Action Required

| Condition | Action |
|-----------|--------|
| New OIM ops memo about eligibility rules | Review within 24 hours |
| PA Bulletin notice about MA rate changes | Review within 48 hours |
| FPL or MSP limit changes | Update immediately |
| MCO handbook major revision | Schedule re-ingestion |

### Weekly Summary

Generate a weekly monitoring report:
```bash
pnpm monitor changes --since "7 days ago" --format summary
```

---

## Troubleshooting

### Source Unavailable

If a source URL returns an error:
1. Check if the URL has changed
2. Verify government site is not in maintenance
3. Try alternative access methods (direct vs. navigation)
4. Update URL in document-registry.json if changed

### Hash Mismatch False Positives

Some pages change frequently without substantive updates:
- Timestamps in page footers
- Session tokens in URLs
- Advertising content

**Solution:** Configure content filtering in scraper to ignore non-substantive changes.

### Ingestion Failures

If document ingestion fails:
1. Check document format (PDF, HTML)
2. Verify OCR service is running (for PDFs)
3. Review chunking strategy for document type
4. Check database connection

---

## Contact Resources

| Resource | Phone | When to Contact |
|----------|-------|-----------------|
| PHLP Helpline | 1-800-274-3258 | Policy clarification questions |
| PA DHS Customer Service | 1-877-395-8930 | Official program information |
| Chester County CAO | 610-466-1000 | Local eligibility questions |

---

## CLI Commands Reference

### Monitor Commands

```bash
# Check monitor status (summary of all monitors)
pnpm monitor status

# List all monitored sources
pnpm monitor list

# Check all sources for changes (respects schedule)
pnpm monitor check

# Force check a specific source
pnpm monitor check --source "OIM Operations Memoranda" --force

# Check only sources of a specific frequency
pnpm monitor check --frequency weekly
pnpm monitor check --frequency monthly
pnpm monitor check --frequency quarterly

# View recent change history
pnpm monitor changes
pnpm monitor changes --limit 10

# Test scrape a URL without saving
pnpm monitor test-scrape "<URL>" --type oim_ops_memo
pnpm monitor test-scrape "<URL>" --type pa_bulletin
pnpm monitor test-scrape "<URL>" --type chc_publications
```

### Ingestion Commands

```bash
# Ingest a single PDF
pnpm ingest file /path/to/document.pdf

# Ingest a directory of PDFs
pnpm ingest directory /path/to/pdfs --recursive

# Check ingestion stats
pnpm ingest stats
```

### Query Commands

```bash
# Ask a question
pnpm query ask "What is the LIFE program?"

# View query metrics
pnpm query metrics
```

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-01 | System | Initial SOP creation |
| 1.1 | 2025-12-30 | System | Added CLI commands reference, updated commands |
