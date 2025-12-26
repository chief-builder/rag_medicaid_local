#!/usr/bin/env node
/**
 * Download Web Pages as PDFs
 *
 * This script uses Puppeteer to automatically save PA government web pages
 * as PDFs for ingestion into the RAG system.
 *
 * Usage: pnpm download:webpages
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WebPage {
  url: string;
  filename: string;
  title: string;
}

const PAGES_TO_DOWNLOAD: WebPage[] = [
  {
    url: 'https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/medicaid-older-people-and-people-with-disabilities',
    filename: 'PA-DHS-Healthy-Horizons.pdf',
    title: 'Medicaid for Older People and People with Disabilities'
  },
  {
    url: 'https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/medicaid-payment-long-term-care',
    filename: 'PA-DHS-Long-Term-Care.pdf',
    title: 'MA and Payment of Long-Term Care (Spousal Rules)'
  },
  {
    url: 'https://www.pa.gov/agencies/dhs/resources/for-residents/estate-recovery',
    filename: 'PA-DHS-Estate-Recovery-Info.pdf',
    title: 'Estate Recovery Information Page'
  },
  {
    url: 'https://www.pa.gov/agencies/aging/aging-programs-and-services/pace-program',
    filename: 'PA-Aging-PACE-Overview.pdf',
    title: 'PACE Program Overview'
  }
];

const OUTPUT_DIR = join(__dirname, '..', 'data', 'raw', 'priority');

async function downloadPage(browser: puppeteer.Browser, page: WebPage): Promise<boolean> {
  const browserPage = await browser.newPage();

  try {
    console.log(`\n📄 Downloading: ${page.title}`);
    console.log(`   URL: ${page.url}`);

    // Set a reasonable viewport
    await browserPage.setViewport({ width: 1200, height: 800 });

    // Navigate to the page with a longer timeout for government sites
    await browserPage.goto(page.url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait a bit for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate PDF
    const outputPath = join(OUTPUT_DIR, page.filename);
    await browserPage.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
        right: '0.5in'
      }
    });

    console.log(`   ✅ Saved: ${page.filename}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  } finally {
    await browserPage.close();
  }
}

async function main() {
  console.log('==================================================');
  console.log('Downloading Web Pages as PDFs');
  console.log('==================================================');

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Launch browser
  console.log('\n🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  let successCount = 0;
  let failCount = 0;

  try {
    for (const page of PAGES_TO_DOWNLOAD) {
      const success = await downloadPage(browser, page);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n==================================================');
  console.log('Download Summary');
  console.log('==================================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);

  if (failCount > 0) {
    console.log('\n⚠️  Some downloads failed. You may need to save them manually.');
    process.exit(1);
  }

  console.log('\n✨ All web pages downloaded successfully!');
  console.log('\nNext steps:');
  console.log('  1. Verify documents: ls -la data/raw/priority/');
  console.log('  2. Ingest documents: pnpm ingest directory data/raw/priority');
}

main().catch(console.error);
