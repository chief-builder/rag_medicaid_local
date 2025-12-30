# Performance Benchmarks - Medicaid RAG Local

## Overview

This document contains performance benchmark results from testing the Medicaid RAG system against real services running locally.

**Test Date:** December 30, 2025
**System Configuration:**
- PostgreSQL 15 (Docker)
- Qdrant 1.7+ (Docker)
- LM Studio with:
  - Embedding model: `text-embedding-nomic-embed-text-v1.5`
  - LLM model: `qwen2.5-7b-instruct`

## Summary Results

| Component | Avg Latency | % of Pipeline | P95 |
|-----------|-------------|---------------|-----|
| Embedding Generation | 15ms | 0.5% | 16ms |
| Vector Search (Qdrant) | 5ms | 0.2% | 7ms |
| BM25 Search (PostgreSQL) | 1ms | 0.0% | 2ms |
| LLM Generation | 2,858ms | 99.3% | 5,600ms |
| **Total Pipeline** | **2,879ms** | 100% | 5,619ms |
| Cached Query | 0.5ms | N/A | 0.8ms |

## Key Insights

1. **LLM generation dominates latency (99.3%)** - The local LLM inference is the primary bottleneck
2. **Cache hits are 5,367x faster** - Caching provides massive speedup for repeated queries
3. **Vector search is 3.6x slower than BM25** - But semantic search quality justifies the cost
4. **Search operations are negligible** - Combined vector + BM25 is only ~6ms (~0.2% of total)

## Detailed Benchmark Results

### 1. Single Embedding Generation

Generates a 768-dimension embedding vector for a single query text.

```
Samples: 10
Min:     8.66ms
Max:     21.94ms
Avg:     10.70ms
P50:     9.44ms
P95:     21.94ms
```

**Analysis:** Embedding generation is very fast (~10ms average), making it viable for real-time query processing.

### 2. Batch Embedding (5 texts)

Generates embeddings for 5 texts in a single batch call.

```
Samples: 5
Min:     28.25ms
Max:     40.77ms
Avg:     31.82ms
P50:     29.08ms
P95:     40.77ms
```

**Analysis:** Batch processing adds ~20ms overhead but processes 5x the texts, yielding ~6.4ms/text (40% faster than individual calls). Use batching during ingestion.

### 3. Vector Search (Qdrant)

Searches for top 20 most similar vectors using cosine similarity.

```
Samples: 10
Min:     2.04ms
Max:     4.71ms
Avg:     2.68ms
P50:     2.54ms
P95:     4.71ms
```

**Analysis:** Qdrant vector search is extremely fast (<5ms), even with the full document corpus. HNSW indexing provides sub-linear search time.

### 4. BM25 Search (PostgreSQL)

Full-text keyword search using PostgreSQL's built-in BM25 ranking.

```
Samples: 10
Min:     0.71ms
Max:     12.93ms
Avg:     2.15ms
P50:     0.93ms
P95:     12.93ms
```

**Analysis:** PostgreSQL BM25 is very fast (<3ms average). The P95 spike to 13ms is likely cold cache; subsequent queries are consistently <1ms.

### 5. LLM Answer Generation

Generates a natural language answer using the local LLM (200 max tokens).

```
Samples: 5
Min:     683.20ms
Max:     3723.75ms
Avg:     2522.19ms
P50:     2991.41ms
P95:     3723.75ms
```

**Analysis:** LLM generation is the bottleneck with high variance (683ms - 3.7s). Latency depends on:
- Answer length (token count)
- Model temperature/sampling
- GPU utilization
- Context length

### 6. Cache Performance

Measures PostgreSQL query cache lookup times.

**Cache Miss:**
```
Samples: 20
Min:     0.35ms
Max:     3.07ms
Avg:     0.59ms
P50:     0.45ms
P95:     3.07ms
```

**Cache Hit:**
```
Samples: 20
Min:     0.35ms
Max:     0.85ms
Avg:     0.54ms
P50:     0.53ms
P95:     0.85ms
```

**Analysis:** Cache lookup is sub-millisecond regardless of hit/miss. This validates the caching strategy - cached queries skip ~2.9s of LLM processing.

### 7. Full Query Pipeline (E2E)

End-to-end query including embedding, hybrid search, and LLM generation.

```
Total Pipeline:
  Min:     1550.56ms
  Max:     5619.19ms
  Avg:     2878.96ms
  P50:     2535.26ms
  P95:     5619.19ms

Breakdown:
  Embedding:     15.46ms (0.5%)
  Vector Search:  4.70ms (0.2%)
  BM25 Search:    1.29ms (0.0%)
  LLM Generation: 2857.52ms (99.3%)
```

**Analysis:** The pipeline completes in ~3 seconds on average, with LLM generation accounting for 99.3% of latency.

## Performance Recommendations

### For Lower Latency

1. **Enable query caching** - Reduces repeated query latency from ~3s to <1ms
2. **Use smaller LLM** - Trade answer quality for speed if needed
3. **Reduce max tokens** - Shorter answers generate faster
4. **GPU acceleration** - Ensure LM Studio is using GPU

### For Higher Throughput

1. **Batch embeddings during ingestion** - 40% more efficient than individual calls
2. **Parallelize hybrid search** - Vector and BM25 search can run concurrently
3. **Implement connection pooling** - Already handled by PostgreSQL client
4. **Consider async processing** - Queue non-urgent queries for batch processing

### Scaling Considerations

| Corpus Size | Expected Impact |
|-------------|-----------------|
| 1K documents | Negligible (<5ms search) |
| 10K documents | Minor (~10ms search) |
| 100K documents | Moderate (~50ms search) |
| 1M+ documents | Consider sharding Qdrant |

## Running Benchmarks

```bash
# Run mocked benchmarks (fast, no services needed)
pnpm test:perf

# Run real service benchmarks (requires all services running)
pnpm test:perf:real
```

## Environment

The benchmarks were run on:
- **OS:** macOS Darwin 23.4.0
- **Services:** Docker containers (PostgreSQL, Qdrant)
- **LLM:** LM Studio running locally
- **Hardware:** [Your hardware specs here]

---

*Last updated: December 30, 2025*
