#!/bin/bash
# Reset database and Qdrant collection, then ingest priority documents
# Run this script from the project root directory

set -e

echo "=== Resetting RAG System for Fresh Ingestion ==="

# Step 1: Delete Qdrant collection
echo ""
echo "Step 1: Deleting Qdrant collection..."
curl -X DELETE http://localhost:6333/collections/medicaid_chunks 2>/dev/null && echo "Collection deleted" || echo "Collection may not exist (OK)"

# Step 2: Reset PostgreSQL
echo ""
echo "Step 2: Resetting PostgreSQL database..."
docker compose down -v
docker compose up -d
echo "Waiting for PostgreSQL to start..."
sleep 5

# Step 3: Run migrations
echo ""
echo "Step 3: Running database migrations..."
pnpm db:migrate

# Step 4: Ingest documents
echo ""
echo "Step 4: Ingesting priority documents..."
pnpm ingest directory data/raw/priority

echo ""
echo "=== Ingestion Complete ==="
