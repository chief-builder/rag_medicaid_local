# Manual Regression Test Checklist

## Medicaid RAG Local System
**Version:** 1.0.0
**Test Date:** ____________
**Tester:** ____________

---

## Pre-Test Environment Verification

### Required Services
- [ ] PostgreSQL running on localhost:5432
  - Command: `docker ps | grep postgres`
  - Expected: Container running
- [ ] Qdrant running on localhost:6333
  - Command: `curl http://localhost:6333/collections`
  - Expected: JSON response with collections list
- [ ] LM Studio running on localhost:1234
  - Command: `curl http://localhost:1234/v1/models`
  - Expected: JSON with loaded models
- [ ] Required models loaded in LM Studio:
  - [ ] `text-embedding-nomic-embed-text-v1.5`
  - [ ] `qwen2.5-7b-instruct`

### Environment Setup
```bash
# Start services
pnpm docker:up

# Run migrations
pnpm db:migrate

# Verify database
psql -h localhost -U postgres -d medicaid_rag -c "SELECT COUNT(*) FROM documents;"
```

---

## 1. Infrastructure Tests

### INF-001: PostgreSQL Connection
- [ ] **Action:** Run `pnpm db:migrate`
- [ ] **Expected:** Migration completes without errors
- [ ] **Pass/Fail:** ____

### INF-002: Database Tables Exist
- [ ] **Action:** Check tables exist
```sql
\dt -- Lists tables
```
- [ ] **Expected:** documents, chunks, embedding_cache, query_cache, query_logs, source_monitors, source_change_log
- [ ] **Pass/Fail:** ____

### INF-005: Qdrant Connection
- [ ] **Action:** `curl http://localhost:6333/collections`
- [ ] **Expected:** Valid JSON response
- [ ] **Pass/Fail:** ____

### INF-008: LM Studio Health Check
- [ ] **Action:** `curl http://localhost:1234/v1/models`
- [ ] **Expected:** List of available models
- [ ] **Pass/Fail:** ____

---

## 2. Ingestion Pipeline Tests

### ING-001: Ingest Valid PDF
- [ ] **Action:** `pnpm ingest file /path/to/sample.pdf`
- [ ] **Expected:**
  - Document stored message
  - Chunk count displayed
  - Vectors stored confirmation
- [ ] **Pass/Fail:** ____

### ING-003: Duplicate Detection
- [ ] **Action:** Ingest the same file again
- [ ] **Expected:** "Document already exists" message, no new data created
- [ ] **Pass/Fail:** ____

### ING-004: Non-existent File
- [ ] **Action:** `pnpm ingest file /path/that/does/not/exist.pdf`
- [ ] **Expected:** Clear error message about file not found
- [ ] **Pass/Fail:** ____

### ING-008: Directory Ingestion
- [ ] **Action:** `pnpm ingest directory /path/to/pdf/folder`
- [ ] **Expected:**
  - All PDFs processed
  - Progress shown for each file
  - Summary at end
- [ ] **Pass/Fail:** ____

### ING-022: Ingestion Statistics
- [ ] **Action:** `pnpm ingest stats`
- [ ] **Expected:**
  - Total documents count
  - Total chunks count
  - Vector count matches chunks
- [ ] **Pass/Fail:** ____

---

## 3. Query Pipeline Tests

### QRY-001: Simple Query
- [ ] **Action:** `pnpm query ask "What is the income limit for QMB?"`
- [ ] **Expected:**
  - Answer about QMB income limit (~100% FPL)
  - At least one citation
  - Confidence score displayed
  - Latency reported
- [ ] **Pass/Fail:** ____

### QRY-002: No Relevant Documents
- [ ] **Action:** `pnpm query ask "What is the weather in Tokyo?"`
- [ ] **Expected:** "I cannot find information" or similar response
- [ ] **Pass/Fail:** ____

### QRY-014: Query Caching
- [ ] **Action:**
  1. Run query: `pnpm query ask "What is MSP?"`
  2. Note latency
  3. Run same query again immediately
  4. Note latency
- [ ] **Expected:** Second query faster (cached)
- [ ] **First latency:** ____ ms
- [ ] **Second latency:** ____ ms
- [ ] **Pass/Fail:** ____

### QRY-017: Cache Bypass
- [ ] **Action:** `pnpm query ask "What is MSP?" --no-cache`
- [ ] **Expected:** Fresh retrieval performed (similar latency to first query)
- [ ] **Pass/Fail:** ____

### QRY-019: Interactive Mode
- [ ] **Action:** `pnpm query interactive`
- [ ] **Expected:**
  - REPL prompt appears
  - Can type multiple queries
  - Typing "exit" exits cleanly
- [ ] **Pass/Fail:** ____

### QRY-022: Query Metrics
- [ ] **Action:** `pnpm query metrics`
- [ ] **Expected:**
  - Total queries count
  - Average latency
  - No-answer rate percentage
- [ ] **Pass/Fail:** ____

---

## 4. Guardrails Tests

### GRD-001: Estate Planning Detection
- [ ] **Action:** `pnpm query ask "How can I transfer my home to avoid Medicaid?"`
- [ ] **Expected:**
  - Answer includes disclaimer
  - Suggests consulting attorney
  - PHLP phone number (1-800-274-3258) included
- [ ] **Pass/Fail:** ____

### GRD-005: Appeals Detection
- [ ] **Action:** `pnpm query ask "My Medicaid was denied, how do I appeal?"`
- [ ] **Expected:**
  - Answer includes fair hearing information
  - Contact information provided
- [ ] **Pass/Fail:** ____

### GRD-007: Non-Sensitive Query
- [ ] **Action:** `pnpm query ask "What are the MSP income limits?"`
- [ ] **Expected:** Answer without special disclaimers
- [ ] **Pass/Fail:** ____

---

## 5. Source Monitoring Tests

### CLI-010: List Monitors
- [ ] **Action:** `pnpm monitor list`
- [ ] **Expected:** List of all configured source monitors
- [ ] **Pass/Fail:** ____

### CLI-011: Check Monitors
- [ ] **Action:** `pnpm monitor check`
- [ ] **Expected:** Status for each monitor checked
- [ ] **Pass/Fail:** ____

### CLI-015: Monitor Status
- [ ] **Action:** `pnpm monitor status`
- [ ] **Expected:** Overall health summary
- [ ] **Pass/Fail:** ____

---

## 6. API Endpoint Tests

### API-001: Health Endpoint
- [ ] **Action:** `curl http://localhost:3000/health`
- [ ] **Expected:**
```json
{
  "status": "ok",
  "documentCount": <number>,
  "vectorCount": <number>
}
```
- [ ] **Pass/Fail:** ____

### API-004: Query Endpoint
- [ ] **Action:**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is QMB?"}'
```
- [ ] **Expected:** JSON with answer, citations, confidence, latency
- [ ] **Pass/Fail:** ____

### API-006: Query Validation
- [ ] **Action:**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query": ""}'
```
- [ ] **Expected:** 400 Bad Request with error message
- [ ] **Pass/Fail:** ____

### API-012: Metrics Endpoint
- [ ] **Action:** `curl http://localhost:3000/metrics`
- [ ] **Expected:** JSON with query statistics
- [ ] **Pass/Fail:** ____

---

## 7. End-to-End Workflow Tests

### E2E-001: Full Pipeline Verification
- [ ] **Steps:**
  1. Ingest a new PDF: `pnpm ingest file /path/to/new.pdf`
  2. Query about content in that PDF
  3. Verify citation references the new document
- [ ] **Pass/Fail:** ____

### E2E-004: Cache Behavior
- [ ] **Steps:**
  1. Run a unique query
  2. Note response
  3. Ingest a new document that should affect that query
  4. Run same query with --no-cache
  5. Verify new content is included
- [ ] **Pass/Fail:** ____

---

## 8. Performance Verification

### PRF-001: Query Latency
- [ ] **Action:** Run 5 different queries, record latencies
- [ ] **Query 1:** ____ ms
- [ ] **Query 2:** ____ ms
- [ ] **Query 3:** ____ ms
- [ ] **Query 4:** ____ ms
- [ ] **Query 5:** ____ ms
- [ ] **Average:** ____ ms
- [ ] **Expected:** < 5000ms per query
- [ ] **Pass/Fail:** ____

### PRF-002: Cached Query Latency
- [ ] **Action:** Query same thing twice, measure second response
- [ ] **Latency:** ____ ms
- [ ] **Expected:** < 500ms
- [ ] **Pass/Fail:** ____

---

## Test Summary

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| Infrastructure | /4 | | |
| Ingestion | /5 | | |
| Query | /6 | | |
| Guardrails | /3 | | |
| Monitoring | /3 | | |
| API | /4 | | |
| E2E | /2 | | |
| Performance | /2 | | |
| **Total** | /29 | | |

---

## Sign-off

**Tester Signature:** ________________________

**Date:** ____________

**Overall Status:** [ ] PASS [ ] FAIL

**Critical Issues Found:**
1. ________________________________________
2. ________________________________________
3. ________________________________________

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________
