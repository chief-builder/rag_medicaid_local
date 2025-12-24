# Medicaid RAG System

A fully local, open-source Retrieval-Augmented Generation (RAG) system for Medicaid eligibility information. Built with TypeScript, LM Studio, Qdrant, and PostgreSQL.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OFFLINE / INGESTION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐              │
│  │  PDFs   │───▶│ PDF→MD   │───▶│ Chunker  │───▶│  Embed    │              │
│  │         │    │ (olmocr) │    │          │    │           │              │
│  └─────────┘    └──────────┘    └────┬─────┘    └─────┬─────┘              │
│                                      │                │                     │
│                                      ▼                ▼                     │
│                               ┌──────────┐     ┌──────────┐                │
│                               │ Postgres │     │  Qdrant  │                │
│                               │  (BM25)  │     │ (Vector) │                │
│                               └──────────┘     └──────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            ONLINE / QUERY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐              │
│  │  User   │───▶│  Query   │───▶│  Embed   │───▶│  Vector   │              │
│  │         │    │   API    │    │  Query   │    │  Search   │              │
│  └─────────┘    └────┬─────┘    └──────────┘    └─────┬─────┘              │
│                      │                                │                     │
│                      │          ┌──────────┐          │                     │
│                      └─────────▶│   BM25   │◀─────────┘                     │
│                                 │  Search  │                                │
│                                 └────┬─────┘                                │
│                                      │                                      │
│                                      ▼                                      │
│                               ┌──────────┐                                 │
│                               │   RRF    │                                 │
│                               │  Fusion  │                                 │
│                               └────┬─────┘                                 │
│                                    │                                        │
│                                    ▼                                        │
│                               ┌──────────┐                                 │
│                               │  Rerank  │                                 │
│                               │  (LLM)   │                                 │
│                               └────┬─────┘                                 │
│                                    │                                        │
│                                    ▼                                        │
│                               ┌──────────┐    ┌───────────┐                │
│                               │  Answer  │───▶│  Answer + │                │
│                               │  (LLM)   │    │ Citations │                │
│                               └──────────┘    └───────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **PDF Ingestion**: Convert Medicaid PDFs to Markdown using OCR
- **Hybrid Search**: Combine vector similarity (Qdrant) with BM25 (PostgreSQL)
- **RRF Fusion**: Reciprocal Rank Fusion for optimal result merging
- **LLM Reranking**: Listwise reranking using local LLM
- **Grounded Answers**: Responses with document/page/chunk citations
- **Caching**: Embedding and query result caching
- **Metrics**: Query logging and performance tracking

## Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- [LM Studio](https://lmstudio.ai/) with:
  - `allenai/olmocr-2-7b` (OCR)
  - `Qwen2.5-7B-Instruct` (LLM)
  - Text embedding model (e.g., `nomic-embed-text-v1.5`)

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
2. Load `allenai/olmocr-2-7b` for OCR
3. Load `Qwen2.5-7B-Instruct` for LLM
4. Load an embedding model
5. Start the local server (default: http://localhost:1234)

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
# Ask a question
pnpm query ask "What are the income requirements for Medicaid?"

# Start interactive mode
pnpm query interactive

# View metrics
pnpm query metrics
```

### 7. Start the API Server

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
| `LM_STUDIO_OCR_MODEL` | `allenai/olmocr-2-7b` | OCR model name |
| `LM_STUDIO_LLM_MODEL` | `qwen2.5-7b-instruct` | LLM model name |
| `LM_STUDIO_EMBEDDING_MODEL` | `text-embedding-nomic-embed-text-v1.5` | Embedding model |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION` | `medicaid_chunks` | Qdrant collection name |
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

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### Project Structure

```
src/
├── api/                 # Express API server
│   └── server.ts
├── cli/                 # CLI commands
│   ├── ingest.ts
│   └── query.ts
├── clients/             # External service clients
│   ├── lm-studio.ts     # LM Studio OpenAI-compatible client
│   ├── postgres.ts      # PostgreSQL client
│   └── qdrant.ts        # Qdrant vector store client
├── config/              # Configuration loading
│   └── index.ts
├── db/                  # Database migrations
│   └── migrate.ts
├── ingestion/           # Document ingestion pipeline
│   ├── chunker.ts       # Markdown chunking
│   ├── pdf-processor.ts # PDF to Markdown conversion
│   └── pipeline.ts      # Complete ingestion pipeline
├── retrieval/           # Query retrieval pipeline
│   ├── fusion.ts        # RRF fusion algorithm
│   ├── reranker.ts      # LLM-based reranking
│   └── pipeline.ts      # Complete retrieval pipeline
├── types/               # TypeScript types
│   └── index.ts
├── utils/               # Utility functions
│   ├── hash.ts
│   └── logger.ts
└── index.ts             # Main entry point
```

## Troubleshooting

### LM Studio Connection Issues

1. Ensure LM Studio is running and the local server is started
2. Verify the correct models are loaded
3. Check `LM_STUDIO_BASE_URL` matches your LM Studio server

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

### Ingestion Failures

- Ensure PDFs are valid and not password-protected
- Check available disk space
- Verify LM Studio has enough memory for the models

## License

MIT
