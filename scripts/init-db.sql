-- Initialize Medicaid RAG database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table - stores ingested PDF metadata
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    title TEXT,
    total_pages INTEGER,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chunks table - stores document chunks with full-text search
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    start_char INTEGER,
    end_char INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Full-text search vector
    content_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(document_id, chunk_index)
);

-- Create GIN index for full-text search (BM25-like ranking)
CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv ON chunks USING GIN(content_tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

-- Embedding cache table
CREATE TABLE IF NOT EXISTS embedding_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash TEXT NOT NULL UNIQUE,
    embedding REAL[] NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash ON embedding_cache(content_hash);

-- Query cache table
CREATE TABLE IF NOT EXISTS query_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash TEXT NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON query_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);

-- Query logs table for metrics
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    response_text TEXT,
    vector_results INTEGER,
    bm25_results INTEGER,
    fused_results INTEGER,
    reranked_results INTEGER,
    final_results INTEGER,
    latency_ms INTEGER,
    has_answer BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BM25 search function using ts_rank_cd (covers density for BM25-like behavior)
CREATE OR REPLACE FUNCTION search_bm25(
    search_query TEXT,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    page_number INTEGER,
    chunk_index INTEGER,
    metadata JSONB,
    score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as chunk_id,
        c.document_id,
        c.content,
        c.page_number,
        c.chunk_index,
        c.metadata,
        ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', search_query), 32)::REAL as score
    FROM chunks c
    WHERE c.content_tsv @@ websearch_to_tsquery('english', search_query)
    ORDER BY score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get chunk with document context
CREATE OR REPLACE FUNCTION get_chunk_with_context(chunk_uuid UUID)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    page_number INTEGER,
    chunk_index INTEGER,
    chunk_metadata JSONB,
    filename TEXT,
    title TEXT,
    doc_metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as chunk_id,
        c.document_id,
        c.content,
        c.page_number,
        c.chunk_index,
        c.metadata as chunk_metadata,
        d.filename,
        d.title,
        d.metadata as doc_metadata
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.id = chunk_uuid;
END;
$$ LANGUAGE plpgsql;

-- Source monitors table - tracks sources for change detection
CREATE TABLE IF NOT EXISTS source_monitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    check_frequency TEXT NOT NULL DEFAULT 'weekly',
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_content_hash TEXT,
    last_change_detected_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    auto_ingest BOOLEAN DEFAULT false,
    filter_keywords TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_monitors_active ON source_monitors(is_active);
CREATE INDEX IF NOT EXISTS idx_source_monitors_frequency ON source_monitors(check_frequency);

-- Source change log table - records detected changes
CREATE TABLE IF NOT EXISTS source_change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES source_monitors(id) ON DELETE CASCADE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_hash TEXT,
    new_hash TEXT,
    change_summary TEXT,
    items_added INTEGER DEFAULT 0,
    items_removed INTEGER DEFAULT 0,
    auto_ingested BOOLEAN DEFAULT false,
    ingestion_status TEXT DEFAULT 'pending',
    ingestion_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_source_change_log_monitor ON source_change_log(monitor_id);
CREATE INDEX IF NOT EXISTS idx_source_change_log_detected ON source_change_log(detected_at DESC);
