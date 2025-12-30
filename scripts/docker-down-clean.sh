#!/bin/bash
# Completely tear down Docker environment including named volumes
# Use this for a complete fresh start

set -e

echo "=== Docker Complete Teardown ==="

# Step 1: Stop and remove containers
echo ""
echo "Step 1: Stopping containers..."
docker compose down

# Step 2: Remove named volumes
echo ""
echo "Step 2: Removing data volumes..."
docker volume rm rag_medicaid_local_postgres_data 2>/dev/null && echo "  - Removed postgres_data volume" || echo "  - postgres_data volume not found (OK)"
docker volume rm rag_medicaid_local_qdrant_data 2>/dev/null && echo "  - Removed qdrant_data volume" || echo "  - qdrant_data volume not found (OK)"

echo ""
echo "=== Teardown Complete ==="
echo ""
echo "To start fresh, run:"
echo "  pnpm docker:up"
echo "  pnpm db:migrate"
echo "  pnpm ingest directory data/raw/priority"
