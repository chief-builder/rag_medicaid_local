# Medicaid RAG System

> **Clear answers for families navigating Medicaid—when it matters most.**

A fully local, open-source Retrieval-Augmented Generation (RAG) system for Pennsylvania Medicaid eligibility information, with a focus on helping seniors and their families. Built with TypeScript, LM Studio, Qdrant, and PostgreSQL.

## Why This Project?

**Helping Pennsylvania Seniors Navigate Medicaid With Clarity and Confidence**

Applying for Medicaid long-term care can be overwhelming. Seniors and their families often face complex questions about eligibility, income and asset rules, estate recovery, and long-term care options—frequently during moments of stress or medical transition.

This project provides a **private, locally run assistant** designed to help users understand Pennsylvania Medicaid policies using official, publicly available state guidance.

### What This Tool Does

- **Explains Medicaid rules in plain language**
  Converts complex policy language from Pennsylvania DHS materials into clear, understandable explanations.

- **Provides source-linked answers**
  Every response is grounded in official documentation, with citations so users can verify information or share it with caseworkers, attorneys, or care coordinators.

- **Handles sensitive topics responsibly**
  When topics involve asset transfers, estate recovery, or eligibility planning, the system provides factual context and clearly encourages consultation with qualified professionals such as elder law attorneys or legal aid organizations.

- **Protects privacy by design**
  The assistant runs entirely on the user's local machine. No personal data, questions, or documents are sent to external servers.

### Who This Is For

- **Seniors** exploring long-term care and Medicaid eligibility
- **Adult children or caregivers** helping parents or loved ones navigate the system
- **Care coordinators and advocates** looking for fast, accurate references
- **Anyone** seeking reliable, source-backed Medicaid information for Pennsylvania

### What This Tool Does Not Do

This system **does not provide legal, financial, or medical advice**.
It does not make eligibility determinations or replace professional judgment.

Instead, it equips users with accurate information so they can:
- Ask better questions
- Understand official guidance
- Have informed conversations with caseworkers, attorneys, or healthcare professionals

## Features

### Core RAG Capabilities
- **PDF Ingestion**: Convert Medicaid PDFs to Markdown using OCR
- **Hybrid Search**: Combine vector similarity (Qdrant) with BM25 (PostgreSQL)
- **RRF Fusion**: Reciprocal Rank Fusion for optimal result merging
- **LLM Reranking**: Listwise reranking using local LLM
- **Grounded Answers**: Responses with document/page/chunk citations
- **Caching**: Embedding and query result caching
- **Metrics**: Query logging and performance tracking

### Senior-Focused Enhancements
- **Guardrails for Sensitive Topics**: Automatic detection and disclaimers for:
  - Estate planning questions
  - Asset transfer inquiries (5-year look-back period)
  - Spend-down strategies
  - Complex spousal situations
  - Appeals and denials
- **Professional Referrals**: Automatic inclusion of help resources:
  - PHLP (Pennsylvania Health Law Project): 1-800-274-3258
  - Elder Law Attorney referrals: 1-800-932-0311
  - Pennsylvania Legal Aid Network: 1-800-322-7572
- **Chester County Resources**: Local CAO and APPRISE contact information
- **Data Freshness Tracking**: Warnings for outdated FPL, MSP limits, and other data
- **Answer Freshness Display**: Every answer includes source information:
  - When sources were last retrieved
  - Effective period (e.g., "Calendar Year 2025")
  - Income limits effective dates (e.g., "April 2025 - March 2026")
  - Stale data warnings when documents need updating
- **Automated Source Monitoring**: Weekly/monthly change detection for OIM memos and PA Bulletin
- **Regulatory Text Chunking**: Specialized handling for PA Code and OIM Handbook structure

### Document Sources

#### Ingested PDF Documents (12 Documents, ~480 Chunks)

**Primary Sources (PA DHS / PA Aging):**
- PA DHS Estate Recovery FAQ
- PA DHS Long-Term Care Information
- PA DHS Healthy Horizons
- PA DHS Estate Recovery Info
- PA PACE/PACENET Provider Guide 2025
- PA Aging PACE Overview
- LIFE Program Materials (OCR processed)

**Secondary Sources (PHLP):**
- PHLP 2025 MSP Guide (Medicare Savings Programs)
- PHLP 2025 Income Limits
- PHLP CHC Waiver Eligibility Guide
- PHLP Medicare/Medicaid Dual Eligible Guide
- PHLP 2025 LIS/Extra Help Guide

#### Monitored HTML Sources (10 Sources)

The system monitors these Pennsylvania official sources for changes:

| Source | Type | Frequency |
|--------|------|-----------|
| OIM Operations Memoranda | Policy updates | Weekly |
| OIM Policy Clarifications | Rule clarifications | Weekly |
| PA Bulletin DHS Notices | Legal notices | Weekly |
| OIM LTC Handbook | Core LTC policy | Monthly |
| OIM MA Handbook | MA eligibility | Monthly |
| PA Code Chapter 258 | Estate recovery law | Monthly |
| CHC Publications Hub | CHC materials | Quarterly |
| UPMC CHC Participant Handbook | MCO handbook | Annually |
| AmeriHealth Caritas CHC Handbook | MCO handbook | Annually |
| PA Health & Wellness CHC Handbook | MCO handbook | Annually |

## Architecture

### Ingestion Pipeline (Offline)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  INGESTION PIPELINE                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌───────┐      ┌───────────────┐      ┌───────────┐      ┌──────────────────┐     │
│   │ PDFs  │─────▶│   PDF → MD    │─────▶│  Chunker  │─────▶│  Embed Chunks    │     │
│   └───────┘      └───────┬───────┘      │  512 char │      │                  │     │
│                          │              │  + overlap│      │  ┌────────────┐  │     │
│                          ▼              └─────┬─────┘      │  │ EMBEDDING  │  │     │
│                  ┌───────────────┐            │            │  │   MODEL    │  │     │
│                  │ Native text?  │            │            │  │nomic-embed │  │     │
│                  └───────┬───────┘            │            │  │  768-dim   │  │     │
│                          │                    │            │  └────────────┘  │     │
│              ┌───────────┴───────────┐        │            └────────┬─────────┘     │
│              │                       │        │                     │               │
│              ▼                       ▼        │                     │               │
│      ┌──────────────┐      ┌──────────────┐   │                     │               │
│      │   pdf-parse  │      │  OCR MODEL   │   │                     │               │
│      │  [No Model]  │      │  olmocr-2-7b │   │                     │               │
│      │  (fast path) │      │   (vision)   │   │                     │               │
│      └──────────────┘      └──────────────┘   │                     │               │
│                                               ▼                     ▼               │
│                                        ┌───────────┐         ┌───────────┐          │
│                                        │ Postgres  │         │  Qdrant   │          │
│                                        │  (BM25)   │         │ (Vector)  │          │
│                                        │  chunks   │         │  768-dim  │          │
│                                        └───────────┘         └───────────┘          │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Query Pipeline (Online)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  QUERY PIPELINE                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌───────────┐      ┌──────────────────┐      ┌──────────────────┐                 │
│   │   User    │─────▶│  1. GUARDRAILS   │─────▶│  2. EMBED QUERY  │                 │
│   │   Query   │      │    [No Model]    │      │  ┌────────────┐  │                 │
│   └───────────┘      │                  │      │  │ EMBEDDING  │  │                 │
│                      │  Keyword matching│      │  │   MODEL    │  │                 │
│                      │  Detects:        │      │  │nomic-embed │  │                 │
│                      │  • estate_plan   │      │  │  768-dim   │  │                 │
│                      │  • asset_transfer│      │  └────────────┘  │                 │
│                      │  • spend_down    │      └────────┬─────────┘                 │
│                      │  • appeals       │               │                           │
│                      └──────────────────┘               ▼                           │
│                                              ┌──────────────────────────┐           │
│                                              │ 3. HYBRID SEARCH         │           │
│                                              │    [No Model]            │           │
│                                              │ ┌──────────┬───────────┐ │           │
│                                              │ │  Qdrant  │ Postgres  │ │           │
│                                              │ │  Vector  │   BM25    │ │           │
│                                              │ │ (top 20) │ (top 20)  │ │           │
│                                              │ └──────────┴───────────┘ │           │
│                                              └────────────┬─────────────┘           │
│                                                           ▼                         │
│                                              ┌──────────────────────────┐           │
│                                              │ 4. RRF FUSION [No Model] │           │
│                                              │ Reciprocal Rank Fusion   │           │
│                                              │ Combines & deduplicates  │           │
│                                              └────────────┬─────────────┘           │
│                                                           ▼                         │
│                                              ┌──────────────────────────┐           │
│                                              │ 5. RERANK                │           │
│                                              │ ┌──────────────────────┐ │           │
│                                              │ │     LLM MODEL        │ │           │
│                                              │ │qwen2.5-vl-7b-instruct│ │           │
│                                              │ │ Listwise reranking   │ │           │
│                                              │ └──────────────────────┘ │           │
│                                              └────────────┬─────────────┘           │
│                                                           ▼                         │ 
│                                              ┌──────────────────────────┐           │
│                                              │ 6. ANSWER GENERATION     │           │
│                                              │ ┌──────────────────────┐ │           │
│                                              │ │     LLM MODEL        │ │           │
│                                              │ │qwen2.5-vl-7b-instruct│ │           │
│                                              │ │ Grounded answer with │ │           │
│                                              │ │ [N] citations        │ │           │
│                                              │ └──────────────────────┘ │           │
│                                              └────────────┬─────────────┘           │
│                                                           ▼                         │
│                                              ┌──────────────────────────┐           │
│                                              │ 7. APPLY GUARDRAILS      │           │
│                                              │    [No Model]            │           │
│                                              │ If sensitive query:      │           │
│                                              │ + Add disclaimer text    │           │
│                                              │ + Add professional help  │           │
│                                              └────────────┬─────────────┘           │
│                                                           ▼                         │
│                                              ┌──────────────────────────┐           │
│                                              │     FINAL RESPONSE       │           │
│                                              └──────────────────────────┘           │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Model Summary

| Step | Model | Purpose |
|------|-------|---------|
| PDF OCR | `allenai/olmocr-2-7b` (optional) | Convert scanned PDF pages to markdown |
| Embed (Ingestion) | `nomic-embed-text-v1.5` | Convert chunks to 768-dim vectors |
| Embed (Query) | `nomic-embed-text-v1.5` | Convert query to 768-dim vector |
| Rerank | `qwen2.5-vl-7b-instruct` | Listwise relevance reranking |
| Answer | `qwen2.5-vl-7b-instruct` | Generate grounded answer with citations |

## Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- Poppler (for PDF processing): `brew install poppler` (macOS) or `apt install poppler-utils` (Linux)
- [LM Studio](https://lmstudio.ai/) with the following models loaded:
  - `text-embedding-nomic-embed-text-v1.5` (Embeddings - 768 dimensions)
  - `qwen2.5-vl-7b-instruct` (LLM for answers and reranking)
  - `allenai/olmocr-2-7b` (OCR for scanned PDFs - optional, only needed for image-based PDFs)

## Model Usage

The system uses three specialized models for different tasks in the pipeline:

### Embedding Model (`text-embedding-nomic-embed-text-v1.5`)
**Required** - Used for all vector search operations.

| Stage | Usage |
|-------|-------|
| Ingestion | Converts each document chunk into a 768-dimension vector stored in Qdrant |
| Query | Converts the user's question into a vector for similarity search |

### LLM Model (`qwen2.5-vl-7b-instruct`)
**Required** - Used for intelligent processing of search results.

| Stage | Usage |
|-------|-------|
| Reranking | Listwise reranking of hybrid search results to improve relevance ordering |
| Answer Generation | Generates grounded answers with citations from retrieved context |

### OCR Model (`allenai/olmocr-2-7b`)
**Optional** - Only needed when ingesting scanned/image-based PDFs.

| Stage | Usage |
|-------|-------|
| PDF Ingestion | Converts page images to markdown text using vision capabilities |

The system automatically detects whether a PDF contains extractable text or requires OCR. If native text extraction yields fewer than 50 characters, it falls back to OCR processing (~25 seconds per page).

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd rag-medicaid-local
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Infrastructure

```bash
# Start Qdrant and PostgreSQL
pnpm docker:up

# Run database migrations
pnpm db:migrate
```

### 4. Start LM Studio

1. Open LM Studio
2. Search for and download these models:
   - `nomic-ai/nomic-embed-text-v1.5-GGUF` (embeddings)
   - `Qwen/Qwen2.5-VL-7B-Instruct-GGUF` (LLM)
   - `allenai/olmocr-2-7b` (OCR - only if ingesting scanned PDFs)
3. Load the embedding model and LLM model
4. Start the local server (default: http://localhost:1234)
5. Verify models are loaded:
   ```bash
   curl http://localhost:1234/v1/models | jq '.data[].id'
   ```

### 5. Ingest Documents

```bash
# Ingest a single PDF
pnpm ingest file /path/to/document.pdf

# Ingest a directory of PDFs
pnpm ingest directory /path/to/pdfs --recursive

# Check ingestion stats
pnpm ingest stats
```

### 6. Query the System

```bash
# General questions (no disclaimer)
pnpm query ask "What is the LIFE program and how does it help seniors?"
pnpm query ask "What are the income limits for Medicare Savings Programs?"

# Sensitive topics (automatic disclaimers added)
pnpm query ask "Can I transfer my house to my children to qualify for Medicaid?"
pnpm query ask "My Medicaid application was denied, how do I appeal?"

# View metrics
pnpm query metrics
```

#### Example Output with Guardrails

For sensitive topics like asset transfers, the system automatically adds disclaimers:

```
Answer:
If you transfer ownership to a child under 21 years old, it does not affect
your Medicaid eligibility. However, if you give away your house within the
past 60 months before applying for Medicaid, it will be reviewed and could
potentially disqualify you from receiving Medicaid benefits.

Citations: [1] PA-DHS-Estate-Recovery-FAQ.pdf

---
**Important Notice:** Asset transfers within 5 years of applying for Medicaid
("look-back period") can result in penalties that delay your coverage.
Please consult an elder law attorney.

**For Professional Help:** Elder Law Attorney - PA Referral: 1-800-932-0311
```

### 7. Monitor Source Changes

The system includes automated monitoring for Pennsylvania Medicaid source changes:

```bash
# Check monitor status
pnpm monitor status

# List all monitored sources
pnpm monitor list

# Check all sources for changes (respects schedule)
pnpm monitor check

# Force check a specific source
pnpm monitor check --source "OIM Operations Memoranda" --force

# Check only weekly sources
pnpm monitor check --frequency weekly

# Test scraping a URL without saving
pnpm monitor test-scrape "http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm" --type oim_ops_memo

# View recent changes
pnpm monitor changes --limit 10
```

**Monitored Sources:**

| Source | Frequency | Description |
|--------|-----------|-------------|
| OIM Operations Memoranda | Weekly | Policy updates from PA DHS |
| OIM Policy Clarifications | Weekly | Rule clarifications |
| PA Bulletin DHS Notices | Weekly | Official legal notices (DHS-filtered) |
| OIM LTC Handbook | Monthly | Long-Term Care eligibility policy |
| OIM MA Handbook | Monthly | Medical Assistance policy |
| PA Code Chapter 258 | Monthly | Estate recovery regulations |
| CHC Publications Hub | Quarterly | CHC participant guides and fair hearing info |
| MCO Participant Handbooks | Annually | UPMC, AmeriHealth Caritas, PA Health & Wellness |

### 8. Start the API Server

```bash
# Development mode
pnpm dev

# Production mode
pnpm build && pnpm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Query
```
POST /query
Content-Type: application/json

{
  "query": "What are the Medicaid eligibility requirements?",
  "useCache": true
}
```

Response:
```json
{
  "answer": "Based on the documents...",
  "citations": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "filename": "medicaid-guide.pdf",
      "pageNumber": 5,
      "chunkIndex": 12,
      "excerpt": "Income must be below..."
    }
  ],
  "confidence": 85.5,
  "queryId": "uuid",
  "latencyMs": 1250,
  "retrievalStats": {
    "vectorResults": 20,
    "bm25Results": 20,
    "fusedResults": 15,
    "rerankedResults": 10,
    "finalResults": 5
  }
}
```

### Ingest File
```
POST /ingest/file
Content-Type: application/json

{
  "filepath": "/absolute/path/to/document.pdf"
}
```

### Ingest Directory
```
POST /ingest/directory
Content-Type: application/json

{
  "dirPath": "/absolute/path/to/pdfs",
  "recursive": true,
  "saveMarkdown": false
}
```

### Get Metrics
```
GET /metrics
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_BASE_URL` | `http://localhost:1234/v1` | LM Studio API URL |
| `LM_STUDIO_OCR_MODEL` | `allenai/olmocr-2-7b` | OCR model for scanned PDFs |
| `LM_STUDIO_LLM_MODEL` | `qwen2.5-vl-7b-instruct` | LLM for answers and reranking |
| `LM_STUDIO_EMBEDDING_MODEL` | `text-embedding-nomic-embed-text-v1.5` | Embedding model |
| `EMBEDDING_DIMENSION` | `768` | Embedding vector dimension (must match model) |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION` | `medicaid_chunks` | Qdrant collection name |
| `EMBEDDING_DIMENSION` | `768` | Embedding vector dimension (must match model) |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `medicaid_rag` | Database name |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `CHUNK_SIZE` | `512` | Maximum chunk size in characters |
| `CHUNK_OVERLAP` | `64` | Overlap between chunks |
| `VECTOR_TOP_K` | `20` | Vector search results to retrieve |
| `BM25_TOP_K` | `20` | BM25 search results to retrieve |
| `RERANK_TOP_N` | `10` | Results to consider for reranking |
| `FINAL_TOP_C` | `5` | Final results for answer generation |
| `CACHE_ENABLED` | `true` | Enable caching |
| `CACHE_TTL_SECONDS` | `3600` | Cache TTL in seconds |
| `LOG_LEVEL` | `info` | Logging level |

## Development

### Run Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests (requires running services)
pnpm test:integration

# Run end-to-end tests
pnpm test:e2e

# Run performance benchmarks
pnpm test:perf

# Run real service performance benchmarks
pnpm test:perf:real

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### Performance Benchmarks

Typical query pipeline performance (with local LM Studio):

| Component | Avg Latency | % of Pipeline |
|-----------|-------------|---------------|
| Embedding Generation | ~15ms | 0.5% |
| Vector Search (Qdrant) | ~5ms | 0.2% |
| BM25 Search (PostgreSQL) | ~1ms | 0.0% |
| LLM Generation | ~2,900ms | 99.3% |
| **Total Pipeline** | **~3,000ms** | 100% |
| Cached Query | <1ms | N/A |

See `docs/performance-benchmarks.md` for detailed benchmark results.

### Project Structure

```
src/
├── api/                 # Express API server
│   ├── server.ts        # HTTP server with /query, /ingest, /health endpoints
│   └── server.test.ts   # API endpoint tests
├── cli/                 # CLI commands
│   ├── ingest.ts        # Document ingestion CLI
│   ├── query.ts         # Query CLI interface
│   └── monitor.ts       # Source monitoring CLI
├── clients/             # External service clients
│   ├── lm-studio.ts     # LM Studio OpenAI-compatible client
│   ├── postgres.ts      # PostgreSQL BM25 search & metadata
│   └── qdrant.ts        # Qdrant vector store client
├── config/              # Configuration loading
│   └── index.ts         # Config with Zod validation
├── db/                  # Database operations
│   └── migrate.ts       # Database schema migrations
├── freshness/           # Data freshness tracking
│   ├── index.ts         # Module exports
│   ├── checker.ts       # FPL, MSP, weekly/monthly staleness detection
│   └── display.ts       # Freshness display service
├── guardrails/          # Sensitive topic detection
│   ├── index.ts         # GuardrailsEngine
│   ├── detector.ts      # Keyword-based topic detection (5 categories)
│   └── disclaimers.ts   # Disclaimer templates and professional referrals
├── ingestion/           # Document ingestion pipeline
│   ├── pipeline.ts      # Complete ingestion orchestration
│   ├── chunker.ts       # Markdown-aware chunking (512 char + 64 overlap)
│   ├── pdf-processor.ts # PDF to Markdown with OCR support
│   └── regulatory-chunker.ts  # PA Code/OIM legal text chunking
├── monitoring/          # Source change monitoring
│   ├── index.ts         # Monitor orchestration
│   ├── types.ts         # Monitor types and interfaces
│   ├── source-monitor.ts  # Core monitoring service
│   └── scrapers/        # Source-specific scrapers
│       ├── base-scraper.ts        # Abstract scraper base class
│       ├── oim-scraper.ts         # OIM memos/handbooks scraper
│       ├── pa-bulletin-scraper.ts # PA Bulletin/PA Code scraper
│       └── chc-scraper.ts         # CHC publications scraper
├── prompts/             # LLM prompt templates
│   └── senior-assistant.ts  # Senior-focused prompts with Chester County resources
├── retrieval/           # Query retrieval pipeline
│   ├── pipeline.ts      # Complete retrieval pipeline with guardrails
│   ├── fusion.ts        # RRF (Reciprocal Rank Fusion) algorithm
│   └── reranker.ts      # LLM-based listwise reranking
├── types/               # TypeScript types
│   └── index.ts         # Document, Chunk, Config, Response schemas
├── utils/               # Utility functions
│   ├── logger.ts        # Pino logging setup
│   ├── hash.ts          # MD5 hashing for deduplication
│   └── text-sanitizer.ts  # PostgreSQL encoding fixes
└── index.ts             # Main entry point - starts Express server

tests/
├── e2e/                 # End-to-end tests
│   ├── senior-queries.e2e.test.ts    # Senior intent query testing
│   ├── golden-answers.e2e.test.ts    # Expected response validation
│   └── full-pipeline.e2e.test.ts     # Complete pipeline testing
├── integration/         # Integration tests with real services
│   ├── infrastructure.test.ts        # Service health & connectivity
│   ├── ingestion-pipeline.test.ts    # Full ingestion with DB
│   └── query-pipeline.test.ts        # Full query with retrieval
├── performance/         # Benchmark tests
│   ├── latency.bench.ts      # Query latency benchmarking
│   └── real-services.bench.ts # Real service performance testing
├── fixtures/            # Test data
│   ├── queries/         # Senior intent test queries
│   └── expected/        # Golden answers for validation
└── helpers/             # Test utilities
    ├── mock-lm-studio.ts    # LM Studio mock
    ├── mock-postgres.ts     # PostgreSQL mock
    ├── mock-qdrant.ts       # Qdrant mock
    ├── test-db.ts           # Test database setup
    └── test-fixtures.ts     # Shared test data

scripts/
├── init-db.sql              # Database schema initialization
├── download-priority-docs.sh # PDF download script
├── download-webpages.ts     # Web page scraping
├── reset-and-ingest.sh      # Reset database and re-ingest all documents
└── trace-query-pipeline.ts  # Query pipeline debugging

docs/
├── MONITORING_SOP.md         # Source monitoring procedures
├── SOURCE_ENHANCEMENT_PLAN.md # Source coverage roadmap
├── performance-benchmarks.md # Performance metrics
└── query-test-results.md     # Query test results
```

## Troubleshooting

### LM Studio Connection Issues

1. Ensure LM Studio is running and the local server is started
2. Verify models are loaded:
   ```bash
   curl http://localhost:1234/v1/models | jq '.data[].id'
   ```
3. Check `LM_STUDIO_BASE_URL` matches your LM Studio server
4. Ensure model names in `.env` match exactly what LM Studio reports

### Embedding Dimension Mismatch

If you see errors about vector dimensions:
1. Check your embedding model's dimension (nomic-embed-text-v1.5 uses 768)
2. Update `EMBEDDING_DIMENSION` in `.env` to match
3. If collection exists with wrong dimension, reset and re-ingest:
   ```bash
   pnpm reset:ingest  # Warning: deletes all data and re-ingests
   ```

### Database Connection Issues

```bash
# Check if containers are running
docker ps

# View logs
docker-compose logs postgres
docker-compose logs qdrant

# Restart containers
pnpm docker:down && pnpm docker:up
```

### Query Returns "Cannot find answer"

1. Verify documents are ingested:
   ```bash
   pnpm ingest stats
   ```
2. Check LM Studio has the LLM model loaded (not just embeddings)
3. Try a simpler query to test: "What is Medicaid?"

### Ingestion Failures

- Ensure PDFs are valid and not password-protected
- Check available disk space
- Verify LM Studio has enough memory for the models
- For OCR issues with scanned PDFs:
  - Ensure poppler is installed: `brew install poppler` (macOS) or `apt install poppler-utils` (Linux)
  - Ensure `allenai/olmocr-2-7b` is loaded in LM Studio
  - OCR takes ~25 seconds per page on a 7B model

## License

MIT
