import { readFile, unlink, readdir } from 'fs/promises';
import { basename, join, dirname } from 'path';
import { tmpdir } from 'os';
import pdfParse from 'pdf-parse';
import * as pdfPoppler from 'pdf-poppler';
import { OcrResult, OcrPage } from '../types/index.js';
import { LMStudioClient } from '../clients/lm-studio.js';
import { createChildLogger } from '../utils/logger.js';
import { sanitizeForPostgres } from '../utils/text-sanitizer.js';

const logger = createChildLogger('pdf-processor');

// Minimum text length to consider a page as having extractable text
const MIN_TEXT_LENGTH = 50;

/**
 * Process PDF files and convert to markdown using OCR
 */
export class PdfProcessor {
  private lmStudio: LMStudioClient;

  constructor(lmStudio: LMStudioClient) {
    this.lmStudio = lmStudio;
  }

  /**
   * Process a PDF file and extract text/markdown
   *
   * This method tries text extraction first, falling back to
   * OCR for scanned/image-based PDFs.
   */
  async process(filepath: string): Promise<OcrResult> {
    const filename = basename(filepath);
    logger.info({ filepath, filename }, 'Processing PDF');

    try {
      const pdfBuffer = await readFile(filepath);

      // First, try to get basic info about the PDF
      const pdfData = await pdfParse(pdfBuffer);
      const totalPages = pdfData.numpages;

      logger.info({ totalPages }, 'PDF parsed, extracting pages');

      // Try text extraction first
      const extractedText = sanitizeForPostgres(pdfData.text).trim();

      // Check if we got meaningful text
      if (extractedText.length >= MIN_TEXT_LENGTH) {
        logger.info({ textLength: extractedText.length }, 'Text extraction successful, using native text');
        const pages = this.extractPagesFromText(extractedText, totalPages);

        logger.info({ extractedPages: pages.length }, 'Text extraction complete');

        return {
          filename,
          pages,
          fullMarkdown: pages.map((p) => p.markdown).join('\n\n---\n\n'),
          totalPages,
        };
      }

      // Text extraction failed or returned minimal content - use OCR
      logger.info({ textLength: extractedText.length }, 'Text extraction insufficient, switching to OCR');
      const pages = await this.extractPagesWithOCR(filepath, totalPages);

      logger.info({ extractedPages: pages.length }, 'OCR extraction complete');

      return {
        filename,
        pages,
        fullMarkdown: pages.map((p) => p.markdown).join('\n\n---\n\n'),
        totalPages,
      };
    } catch (error) {
      logger.error({ error, filepath }, 'PDF processing failed');
      throw error;
    }
  }

  /**
   * Extract pages from native PDF text
   */
  private extractPagesFromText(text: string, totalPages: number): OcrPage[] {
    const pages: OcrPage[] = [];

    // Split text by form feed or other page markers
    const pageTexts = text.split(/\f/);

    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i].trim();
      if (pageText.length > 0) {
        const markdown = this.textToMarkdown(pageText, i + 1);
        pages.push({
          pageNumber: i + 1,
          markdown,
          confidence: 1.0, // Text extraction is 100% confident
        });
      }
    }

    // If no pages were extracted from splits, treat entire text as one page
    if (pages.length === 0 && text.trim().length > 0) {
      pages.push({
        pageNumber: 1,
        markdown: this.textToMarkdown(text.trim(), 1),
        confidence: 1.0,
      });
    }

    return pages;
  }

  /**
   * Extract pages using true OCR with vision model
   */
  private async extractPagesWithOCR(filepath: string, totalPages: number): Promise<OcrPage[]> {
    const pages: OcrPage[] = [];
    const tempDir = tmpdir();
    const baseName = `ocr_${Date.now()}`;
    const convertedFiles: string[] = [];

    try {
      // Convert PDF pages to PNG images using pdf-poppler
      logger.info({ filepath, totalPages }, 'Converting PDF pages to images for OCR');

      const opts: pdfPoppler.Options = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: baseName,
        scale: 2048, // Higher resolution for better OCR
      };

      await pdfPoppler.convert(filepath, opts);

      // Find all generated image files
      const tempFiles = await readdir(tempDir);
      const imageFiles = tempFiles
        .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
        .sort(); // Ensure pages are in order

      logger.info({ imageCount: imageFiles.length }, 'PDF converted to images');

      // Process each page with OCR
      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = join(tempDir, imageFiles[i]);
        convertedFiles.push(imagePath);
        const pageNumber = i + 1;

        logger.info({ pageNumber, totalPages: imageFiles.length }, 'OCR processing page');

        try {
          // Read image and convert to base64
          const imageBuffer = await readFile(imagePath);
          const imageBase64 = imageBuffer.toString('base64');

          // Call OCR model
          const markdown = await this.lmStudio.ocrToMarkdown(imageBase64, 'image/png');

          pages.push({
            pageNumber,
            markdown: `[Page: ${pageNumber}]\n\n${markdown}`,
            confidence: 0.95, // OCR has some uncertainty
          });

          logger.debug({ pageNumber, markdownLength: markdown.length }, 'Page OCR complete');
        } catch (error) {
          logger.error({ error, pageNumber }, 'Failed to OCR page');

          // Add placeholder for failed page
          pages.push({
            pageNumber,
            markdown: `[Page: ${pageNumber}]\n\n[OCR failed for this page]`,
            confidence: 0,
          });
        }
      }

      return pages;
    } finally {
      // Clean up temporary image files
      for (const file of convertedFiles) {
        try {
          await unlink(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Convert raw text to markdown format
   */
  private textToMarkdown(text: string, pageNumber: number): string {
    // Add page marker
    let markdown = `[Page: ${pageNumber}]\n\n`;

    // Process the text to add basic markdown structure
    const lines = text.split('\n');
    const processedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        processedLines.push('');
        continue;
      }

      // Detect potential headers (ALL CAPS lines or short bold-looking text)
      if (
        trimmed.length < 100 &&
        trimmed === trimmed.toUpperCase() &&
        /[A-Z]/.test(trimmed)
      ) {
        // Convert to header
        const headerText = trimmed
          .split(' ')
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' ');
        processedLines.push(`## ${headerText}`);
        continue;
      }

      // Detect list items
      if (/^[\-\*\•]\s/.test(trimmed)) {
        processedLines.push(`- ${trimmed.substring(2).trim()}`);
        continue;
      }

      if (/^\d+[\.\)]\s/.test(trimmed)) {
        processedLines.push(trimmed);
        continue;
      }

      // Regular paragraph text
      processedLines.push(trimmed);
    }

    markdown += processedLines.join('\n');

    return markdown;
  }
}

/**
 * Create a PDF processor
 */
export function createPdfProcessor(lmStudio: LMStudioClient): PdfProcessor {
  return new PdfProcessor(lmStudio);
}
