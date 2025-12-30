#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig } from '../config/index.js';
import { createIngestionPipeline } from '../ingestion/pipeline.js';
import { createChildLogger } from '../utils/logger.js';

// Logger available for future debugging
createChildLogger('cli-ingest');

const program = new Command();

program
  .name('ingest')
  .description('Ingest PDF documents into the Medicaid RAG system')
  .version('1.0.0');

program
  .command('file <filepath>')
  .description('Ingest a single PDF file')
  .action(async (filepath: string) => {
    try {
      console.log(`Ingesting file: ${filepath}`);

      const config = getConfig();
      const pipeline = createIngestionPipeline(config);

      await pipeline.initialize();
      const result = await pipeline.ingestFile(filepath);

      console.log('\nIngestion complete:');
      console.log(`  Document ID: ${result.document.id}`);
      console.log(`  Filename: ${result.document.filename}`);
      console.log(`  Title: ${result.document.title}`);
      console.log(`  Total Pages: ${result.document.totalPages}`);
      console.log(`  Chunks Created: ${result.chunks.length}`);
    } catch (error) {
      console.error('Ingestion failed:', error);
      process.exit(1);
    }
  });

program
  .command('directory <dirpath>')
  .description('Ingest all PDF files in a directory')
  .option('-r, --recursive', 'Process subdirectories recursively', false)
  .option('-m, --save-markdown', 'Save extracted markdown files', false)
  .action(async (dirpath: string, options: { recursive: boolean; saveMarkdown: boolean }) => {
    try {
      console.log(`Ingesting directory: ${dirpath}`);
      console.log(`  Recursive: ${options.recursive}`);
      console.log(`  Save Markdown: ${options.saveMarkdown}`);

      const config = getConfig();
      const pipeline = createIngestionPipeline(config);

      await pipeline.initialize();
      const stats = await pipeline.ingestDirectory(dirpath, {
        recursive: options.recursive,
        saveMarkdown: options.saveMarkdown,
      });

      console.log('\nIngestion complete:');
      console.log(`  Documents Processed: ${stats.documentsProcessed}`);
      console.log(`  Documents Skipped: ${stats.documentsSkipped}`);
      console.log(`  Chunks Created: ${stats.chunksCreated}`);
      console.log(`  Vectors Stored: ${stats.vectorsStored}`);

      if (stats.errors.length > 0) {
        console.log('\nErrors:');
        stats.errors.forEach((err) => console.log(`  - ${err}`));
      }
    } catch (error) {
      console.error('Ingestion failed:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show ingestion statistics')
  .action(async () => {
    try {
      const config = getConfig();
      const pipeline = createIngestionPipeline(config);

      const stats = await pipeline.getStats();

      console.log('Ingestion Statistics:');
      console.log(`  Total Documents: ${stats.documentCount}`);
      console.log(`  Total Vectors: ${stats.vectorCount}`);

      if (stats.documentCount === 0 && stats.vectorCount === 0) {
        console.log('\nNo documents have been ingested yet.');
        console.log('Run "pnpm ingest file <path>" or "pnpm ingest directory <path>" to ingest documents.');
      }
    } catch (error) {
      console.error('Failed to get stats:', error);
      process.exit(1);
    }
  });

program.parse();
