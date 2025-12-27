#!/usr/bin/env node

import { Command } from 'commander';
import { createInterface } from 'readline';
import { getConfig } from '../config/index.js';
import { createRetrievalPipeline } from '../retrieval/pipeline.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('cli-query');

const program = new Command();

program
  .name('query')
  .description('Query the Medicaid RAG system')
  .version('1.0.0');

program
  .command('ask <question>')
  .description('Ask a question about Medicaid eligibility')
  .option('--no-cache', 'Disable query caching')
  .action(async (question: string, options: { cache: boolean }) => {
    try {
      const config = getConfig();
      const pipeline = createRetrievalPipeline(config);

      console.log(`\nQuery: ${question}\n`);
      console.log('Processing...\n');

      const response = await pipeline.query(question, { useCache: options.cache });

      console.log('Answer:');
      console.log(response.answer);
      console.log();

      if (response.citations.length > 0) {
        console.log('Citations:');
        response.citations.forEach((citation, i) => {
          console.log(
            `  [${i + 1}] ${citation.filename}${citation.pageNumber ? `, page ${citation.pageNumber}` : ''}`
          );
          console.log(`      "${citation.excerpt}"`);
        });
        console.log();
      }

      console.log('Statistics:');
      console.log(`  Query ID: ${response.queryId}`);
      console.log(`  Latency: ${response.latencyMs}ms`);
      console.log(`  Confidence: ${response.confidence.toFixed(1)}%`);
      console.log(`  Vector Results: ${response.retrievalStats.vectorResults}`);
      console.log(`  BM25 Results: ${response.retrievalStats.bm25Results}`);
      console.log(`  Final Results: ${response.retrievalStats.finalResults}`);
    } catch (error) {
      console.error('Query failed:', error);
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start an interactive query session')
  .action(async () => {
    const config = getConfig();
    const pipeline = createRetrievalPipeline(config);

    console.log('Medicaid RAG Interactive Mode');
    console.log('Type your questions and press Enter. Type "exit" to quit.\n');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = () => {
      rl.question('You: ', async (question) => {
        if (question.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          rl.close();
          process.exit(0);
        }

        if (!question.trim()) {
          askQuestion();
          return;
        }

        try {
          const response = await pipeline.query(question);

          console.log('\nAssistant:');
          console.log(response.answer);

          if (response.citations.length > 0) {
            console.log('\nSources:');
            response.citations.forEach((citation, i) => {
              console.log(
                `  [${i + 1}] ${citation.filename}${citation.pageNumber ? `, p.${citation.pageNumber}` : ''}`
              );
            });
          }

          console.log(`\n(${response.latencyMs}ms, ${response.confidence.toFixed(0)}% confidence)\n`);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
          console.log();
        }

        askQuestion();
      });
    };

    askQuestion();
  });

program
  .command('metrics')
  .description('Show query metrics')
  .action(async () => {
    try {
      const config = getConfig();
      const pipeline = createRetrievalPipeline(config);

      const metrics = await pipeline.getMetrics();

      console.log('Query Metrics:');
      console.log(`  Total Queries: ${metrics.totalQueries}`);
      console.log(`  Average Latency: ${metrics.avgLatencyMs.toFixed(0)}ms`);
      console.log(`  No-Answer Rate: ${(metrics.noAnswerRate * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('Failed to get metrics:', error);
      process.exit(1);
    }
  });

program.parse();
