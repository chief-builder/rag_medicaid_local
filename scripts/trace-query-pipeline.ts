#!/usr/bin/env tsx
/**
 * Query Pipeline Trace Script
 *
 * This script traces through each step of the query pipeline,
 * showing which model is used at each step and timing information.
 *
 * Usage:
 *   pnpm trace:query "What is the LIFE program?"
 *   pnpm trace:query "Can I transfer my house to my children?"
 */

import { config as loadEnv } from 'dotenv';
import { loadConfig } from '../src/config/index.js';
import { getLMStudioClient, resetLMStudioClient } from '../src/clients/lm-studio.js';
import { getQdrantStore, resetQdrantStore } from '../src/clients/qdrant.js';
import { getPostgresStore, resetPostgresStore } from '../src/clients/postgres.js';
import { fuseResults, deduplicateResults } from '../src/retrieval/fusion.js';
import { createReranker } from '../src/retrieval/reranker.js';
import { getGuardrailsEngine } from '../src/guardrails/index.js';
import { hashString } from '../src/utils/hash.js';

loadEnv();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(step: number, title: string, model: string | null, details: Record<string, unknown> = {}) {
  const modelStr = model
    ? `${colors.cyan}[Model: ${model}]${colors.reset}`
    : `${colors.dim}[No Model]${colors.reset}`;

  console.log(`\n${colors.bright}${colors.blue}Step ${step}: ${title}${colors.reset} ${modelStr}`);

  for (const [key, value] of Object.entries(details)) {
    const displayValue = typeof value === 'object'
      ? JSON.stringify(value, null, 2).split('\n').map((l, i) => i === 0 ? l : `         ${l}`).join('\n')
      : value;
    console.log(`  ${colors.yellow}${key}:${colors.reset} ${displayValue}`);
  }
}

function logTiming(label: string, ms: number) {
  const color = ms > 5000 ? colors.red : ms > 1000 ? colors.yellow : colors.green;
  console.log(`  ${colors.dim}Timing:${colors.reset} ${color}${ms}ms${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}${colors.magenta}${title}${colors.reset}`);
  console.log(`${'='.repeat(80)}`);
}

async function traceQueryPipeline(query: string) {
  const config = loadConfig();

  // Reset singletons to ensure fresh state
  resetLMStudioClient();
  resetQdrantStore();
  resetPostgresStore();

  const lmStudio = getLMStudioClient(config.lmStudio);
  const qdrant = getQdrantStore(config.qdrant);
  const postgres = getPostgresStore(config.postgres);
  const reranker = createReranker(lmStudio);
  const guardrails = getGuardrailsEngine();

  logSection(`QUERY PIPELINE TRACE`);
  console.log(`${colors.bright}Query:${colors.reset} "${query}"`);
  console.log(`${colors.dim}Config:${colors.reset}`);
  console.log(`  Embedding Model: ${config.lmStudio.embeddingModel}`);
  console.log(`  LLM Model: ${config.lmStudio.llmModel}`);
  console.log(`  Vector TopK: ${config.rag.vectorTopK}`);
  console.log(`  BM25 TopK: ${config.rag.bm25TopK}`);
  console.log(`  Rerank TopN: ${config.rag.rerankTopN}`);
  console.log(`  Final TopC: ${config.rag.finalTopC}`);

  const pipelineStart = Date.now();

  try {
    // =========================================================================
    // Step 1: Guardrails Check (No Model)
    // =========================================================================
    let stepStart = Date.now();
    const guardrailResult = await guardrails.checkQuery(query);

    log(1, 'GUARDRAILS CHECK', null, {
      'Location': 'src/guardrails/detector.ts:104',
      'Method': 'Keyword pattern matching',
      'Is Sensitive': guardrailResult.isSensitive,
      'Category': guardrailResult.category || 'N/A',
      'Matched Keywords': guardrailResult.matchedKeywords?.length > 0
        ? guardrailResult.matchedKeywords.join(', ')
        : 'None',
      'Disclaimer Required': guardrailResult.disclaimerRequired,
    });
    logTiming('Guardrails check', Date.now() - stepStart);

    // =========================================================================
    // Step 2: Embed Query (Embedding Model)
    // =========================================================================
    stepStart = Date.now();
    console.log(`\n${colors.bright}${colors.blue}Step 2: EMBED QUERY${colors.reset} ${colors.cyan}[Model: ${config.lmStudio.embeddingModel}]${colors.reset}`);
    console.log(`  ${colors.yellow}Location:${colors.reset} src/clients/lm-studio.ts:25-52`);
    console.log(`  ${colors.yellow}API:${colors.reset} POST ${config.lmStudio.baseUrl}/embeddings`);

    const embeddingResult = await lmStudio.embed(query);

    console.log(`  ${colors.yellow}Input:${colors.reset} "${query}" (${query.length} chars)`);
    console.log(`  ${colors.yellow}Output:${colors.reset} ${embeddingResult.embedding.length}-dimension vector`);
    console.log(`  ${colors.yellow}First 5 values:${colors.reset} [${embeddingResult.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    logTiming('Embedding generation', Date.now() - stepStart);

    // =========================================================================
    // Step 3: Hybrid Search (No Model - Database Queries)
    // =========================================================================
    stepStart = Date.now();
    log(3, 'HYBRID SEARCH', null, {
      'Location': 'src/clients/qdrant.ts + src/clients/postgres.ts',
      'Vector Search': `Qdrant cosine similarity (top ${config.rag.vectorTopK})`,
      'BM25 Search': `PostgreSQL ts_rank (top ${config.rag.bm25TopK})`,
      'Execution': 'Parallel',
    });

    const [vectorResults, bm25Results] = await Promise.all([
      qdrant.search(embeddingResult.embedding, config.rag.vectorTopK),
      postgres.searchBM25(query, config.rag.bm25TopK),
    ]);

    console.log(`  ${colors.yellow}Vector Results:${colors.reset} ${vectorResults.length} chunks`);
    if (vectorResults.length > 0) {
      console.log(`    Top match: ${vectorResults[0].metadata?.filename || 'Unknown'} (score: ${vectorResults[0].score?.toFixed(4)})`);
    }
    console.log(`  ${colors.yellow}BM25 Results:${colors.reset} ${bm25Results.length} chunks`);
    if (bm25Results.length > 0) {
      console.log(`    Top match: ${bm25Results[0].metadata?.filename || 'Unknown'} (score: ${bm25Results[0].score?.toFixed(4)})`);
    }
    logTiming('Hybrid search', Date.now() - stepStart);

    // =========================================================================
    // Step 4: RRF Fusion (No Model - Algorithm)
    // =========================================================================
    stepStart = Date.now();
    const fusedResults = fuseResults(vectorResults, bm25Results, config.rag.rerankTopN);
    const dedupedResults = deduplicateResults(fusedResults);

    log(4, 'RRF FUSION', null, {
      'Location': 'src/retrieval/fusion.ts',
      'Algorithm': 'Reciprocal Rank Fusion (k=60)',
      'Input': `${vectorResults.length} vector + ${bm25Results.length} BM25`,
      'After Fusion': `${fusedResults.length} results`,
      'After Dedup': `${dedupedResults.length} unique results`,
    });

    if (dedupedResults.length > 0) {
      console.log(`  ${colors.yellow}Top 3 fused results:${colors.reset}`);
      dedupedResults.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i + 1}. ${r.metadata?.filename || 'Unknown'} (RRF: ${r.rrfScore.toFixed(4)})`);
      });
    }
    logTiming('RRF fusion', Date.now() - stepStart);

    // =========================================================================
    // Step 5: LLM Reranking (LLM Model)
    // =========================================================================
    stepStart = Date.now();
    console.log(`\n${colors.bright}${colors.blue}Step 5: LLM RERANKING${colors.reset} ${colors.cyan}[Model: ${config.lmStudio.llmModel}]${colors.reset}`);
    console.log(`  ${colors.yellow}Location:${colors.reset} src/clients/lm-studio.ts:180-243`);
    console.log(`  ${colors.yellow}API:${colors.reset} POST ${config.lmStudio.baseUrl}/chat/completions`);
    console.log(`  ${colors.yellow}Prompt:${colors.reset} "Rank documents by relevance... Return JSON array"`);
    console.log(`  ${colors.yellow}Input:${colors.reset} ${dedupedResults.length} documents to rerank`);

    const rerankedResults = await reranker.rerank(query, dedupedResults, config.rag.rerankTopN);

    console.log(`  ${colors.yellow}Output:${colors.reset} ${rerankedResults.length} reranked results`);
    if (rerankedResults.length > 0) {
      console.log(`  ${colors.yellow}Top 3 after reranking:${colors.reset}`);
      rerankedResults.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i + 1}. ${r.metadata?.filename || 'Unknown'} (rerank: ${r.rerankScore.toFixed(4)})`);
      });
    }
    logTiming('LLM reranking', Date.now() - stepStart);

    // =========================================================================
    // Step 6: Select Final Results (No Model)
    // =========================================================================
    const finalResults = rerankedResults.slice(0, config.rag.finalTopC);

    log(6, 'SELECT FINAL RESULTS', null, {
      'Location': 'src/retrieval/pipeline.ts:100',
      'Selection': `Top ${config.rag.finalTopC} from reranked results`,
      'Final Count': finalResults.length,
    });

    if (finalResults.length > 0) {
      console.log(`  ${colors.yellow}Final chunks for answer generation:${colors.reset}`);
      finalResults.forEach((r, i) => {
        const preview = r.content.substring(0, 100).replace(/\n/g, ' ');
        console.log(`    ${i + 1}. ${r.metadata?.filename || 'Unknown'} p.${r.pageNumber || '?'}`);
        console.log(`       "${preview}..."`);
      });
    }

    // =========================================================================
    // Step 7: Answer Generation (LLM Model)
    // =========================================================================
    stepStart = Date.now();
    console.log(`\n${colors.bright}${colors.blue}Step 7: ANSWER GENERATION${colors.reset} ${colors.cyan}[Model: ${config.lmStudio.llmModel}]${colors.reset}`);
    console.log(`  ${colors.yellow}Location:${colors.reset} src/clients/lm-studio.ts:248-312`);
    console.log(`  ${colors.yellow}API:${colors.reset} POST ${config.lmStudio.baseUrl}/chat/completions`);
    console.log(`  ${colors.yellow}System:${colors.reset} "You are a helpful Medicaid eligibility assistant..."`);
    console.log(`  ${colors.yellow}Context:${colors.reset} ${finalResults.length} document chunks`);

    const contexts = finalResults.map((r, i) => ({
      index: i + 1,
      content: r.content,
      filename: (r.metadata?.filename as string) || 'Unknown',
      pageNumber: r.pageNumber,
    }));

    let answer = 'No answer generated (no results found)';
    let citedIndices: number[] = [];

    if (contexts.length > 0) {
      const result = await lmStudio.generateAnswer(query, contexts);
      answer = result.answer;
      citedIndices = result.citedIndices;
    }

    console.log(`  ${colors.yellow}Citations used:${colors.reset} [${citedIndices.join(', ')}]`);
    logTiming('Answer generation', Date.now() - stepStart);

    // =========================================================================
    // Step 8: Apply Guardrails (No Model)
    // =========================================================================
    log(8, 'APPLY GUARDRAILS', null, {
      'Location': 'src/retrieval/pipeline.ts:299-323',
      'Sensitive Topic': guardrailResult.isSensitive ? 'Yes' : 'No',
      'Disclaimer Added': guardrailResult.disclaimerRequired ? 'Yes' : 'No',
      'Referral Added': guardrailResult.referral ? 'Yes' : 'No',
    });

    if (guardrailResult.disclaimerRequired && guardrailResult.disclaimer) {
      answer += '\n\n---\n';
      answer += `**Important Notice:** ${guardrailResult.disclaimer}`;
      if (guardrailResult.referral) {
        answer += `\n\n**For Professional Help:** ${guardrailResult.referral}`;
      }
    }

    // =========================================================================
    // Final Output
    // =========================================================================
    logSection('FINAL ANSWER');
    console.log(answer);

    logSection('PIPELINE SUMMARY');
    const totalTime = Date.now() - pipelineStart;
    console.log(`${colors.bright}Total Time:${colors.reset} ${totalTime}ms`);
    console.log(`${colors.bright}Results:${colors.reset}`);
    console.log(`  Vector results: ${vectorResults.length}`);
    console.log(`  BM25 results: ${bm25Results.length}`);
    console.log(`  Fused results: ${fusedResults.length}`);
    console.log(`  Reranked results: ${rerankedResults.length}`);
    console.log(`  Final results: ${finalResults.length}`);
    console.log(`  Citations: ${citedIndices.length}`);
    console.log(`${colors.bright}Sensitive Topic:${colors.reset} ${guardrailResult.isSensitive ? `Yes (${guardrailResult.category})` : 'No'}`);

    console.log(`\n${colors.bright}Model Usage Summary:${colors.reset}`);
    console.log(`  1. Guardrails:    ${colors.dim}[No Model]${colors.reset} - Keyword matching`);
    console.log(`  2. Embedding:     ${colors.cyan}[${config.lmStudio.embeddingModel}]${colors.reset}`);
    console.log(`  3. Hybrid Search: ${colors.dim}[No Model]${colors.reset} - Database queries`);
    console.log(`  4. RRF Fusion:    ${colors.dim}[No Model]${colors.reset} - Algorithm`);
    console.log(`  5. Reranking:     ${colors.cyan}[${config.lmStudio.llmModel}]${colors.reset}`);
    console.log(`  6. Selection:     ${colors.dim}[No Model]${colors.reset} - Top-K selection`);
    console.log(`  7. Answer:        ${colors.cyan}[${config.lmStudio.llmModel}]${colors.reset}`);
    console.log(`  8. Guardrails:    ${colors.dim}[No Model]${colors.reset} - String concat`);

  } catch (error) {
    console.error(`\n${colors.red}Pipeline Error:${colors.reset}`, error);
    throw error;
  } finally {
    // Cleanup
    await postgres.close();
  }
}

// Main execution
const query = process.argv[2];

if (!query) {
  console.log(`
${colors.bright}Query Pipeline Trace Script${colors.reset}

Usage:
  pnpm trace:query "What is the LIFE program?"
  pnpm trace:query "Can I transfer my house to my children?"

This script traces through each step of the query pipeline, showing:
  - Which model is used at each step
  - Timing information for each step
  - Intermediate results
  - Final answer with citations
`);
  process.exit(1);
}

traceQueryPipeline(query)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
