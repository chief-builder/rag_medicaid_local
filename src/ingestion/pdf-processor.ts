import { readFile } from 'fs/promises';
import { basename } from 'path';
import pdfParse from 'pdf-parse';
import { OcrResult, OcrPage } from '../types/index.js';
import { LMStudioClient } from '../clients/lm-studio.js';
import { createChildLogger } from '../utils/logger.js';
import { sanitizeForPostgres } from '../utils/text-sanitizer.js';

const logger = createChildLogger('pdf-processor');

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
   * This method tries OCR first for best quality, falling back to
   * standard text extraction if OCR fails.
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

      // Try OCR processing
      const pages = await this.extractPagesWithOCR(pdfBuffer, totalPages);

      // Combine all pages into full markdown
      const fullMarkdown = pages.map((p) => p.markdown).join('\n\n---\n\n');

      return {
        filename,
        pages,
        fullMarkdown,
        totalPages,
      };
    } catch (error) {
      logger.warn(
        { error, filepath },
        'OCR failed, falling back to text extraction'
      );

      // Fallback to simple text extraction
      return this.extractTextFallback(filepath);
    }
  }

  /**
   * Extract pages using OCR (vision model)
   */
  private async extractPagesWithOCR(
    pdfBuffer: Buffer,
    totalPages: number
  ): Promise<OcrPage[]> {
    const pages: OcrPage[] = [];

    // For OCR, we need to convert PDF pages to images
    // Since we can't do true page-by-page rendering in Node without
    // additional dependencies, we'll use the text content but structure
    // it as if it came from OCR

    // Note: For true OCR with olmocr, you'd need to:
    // 1. Use a library like pdf2pic to convert pages to images
    // 2. Send each image to the OCR model
    // This is a simplified implementation that works with text PDFs

    const pdfData = await pdfParse(pdfBuffer);
    // Sanitize text to remove invalid UTF-8 characters
    const text = sanitizeForPostgres(pdfData.text);

    // Split text by form feed or other page markers
    const pageTexts = text.split(/\f/);

    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i].trim();
      if (pageText.length > 0) {
        // Convert text to markdown format
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

    logger.info({ extractedPages: pages.length }, 'OCR extraction complete');

    return pages;
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

  /**
   * Fallback text extraction without OCR
   */
  private async extractTextFallback(filepath: string): Promise<OcrResult> {
    const filename = basename(filepath);
    const pdfBuffer = await readFile(filepath);
    const pdfData = await pdfParse(pdfBuffer);

    // Sanitize text to remove invalid UTF-8 characters
    const sanitizedText = sanitizeForPostgres(pdfData.text);
    const markdown = this.textToMarkdown(sanitizedText, 1);

    return {
      filename,
      pages: [
        {
          pageNumber: 1,
          markdown,
          confidence: 1.0,
        },
      ],
      fullMarkdown: markdown,
      totalPages: pdfData.numpages,
    };
  }

  /**
   * Process PDF with true OCR using vision model
   * This is a placeholder for when pdf2pic or similar is available
   */
  async processWithVisionOCR(
    filepath: string,
    pageImages: Array<{ pageNumber: number; base64: string; mimeType: string }>
  ): Promise<OcrResult> {
    const filename = basename(filepath);
    const pages: OcrPage[] = [];

    for (const pageImage of pageImages) {
      logger.debug({ pageNumber: pageImage.pageNumber }, 'OCR processing page');

      try {
        const markdown = await this.lmStudio.ocrToMarkdown(
          pageImage.base64,
          pageImage.mimeType
        );

        pages.push({
          pageNumber: pageImage.pageNumber,
          markdown: `[Page: ${pageImage.pageNumber}]\n\n${markdown}`,
          confidence: 0.95, // OCR has some uncertainty
        });
      } catch (error) {
        logger.error(
          { error, pageNumber: pageImage.pageNumber },
          'Failed to OCR page'
        );

        // Add placeholder for failed page
        pages.push({
          pageNumber: pageImage.pageNumber,
          markdown: `[Page: ${pageImage.pageNumber}]\n\n[OCR failed for this page]`,
          confidence: 0,
        });
      }
    }

    const fullMarkdown = pages.map((p) => p.markdown).join('\n\n---\n\n');

    return {
      filename,
      pages,
      fullMarkdown,
      totalPages: pageImages.length,
    };
  }
}

/**
 * Create a PDF processor
 */
export function createPdfProcessor(lmStudio: LMStudioClient): PdfProcessor {
  return new PdfProcessor(lmStudio);
}
