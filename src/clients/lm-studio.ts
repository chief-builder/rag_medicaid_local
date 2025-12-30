import OpenAI from 'openai';
import { Config, EmbeddingResult, LMStudioError } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('lm-studio');

/**
 * LM Studio client wrapper for OpenAI-compatible API
 */
export class LMStudioClient {
  private client: OpenAI;
  private config: Config['lmStudio'];

  constructor(config: Config['lmStudio']) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: 'not-needed', // LM Studio doesn't require API key
    });
  }

  /**
   * Generate embeddings for text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    try {
      logger.debug({ textLength: text.length }, 'Generating embedding');

      const response = await this.client.embeddings.create({
        model: this.config.embeddingModel,
        input: text,
        encoding_format: 'float', // Force float format to avoid base64 decoding issues
      });

      const embedding = response.data[0].embedding;

      // Log dimensions at INFO level to debug dimension issues
      logger.info(
        { dimensions: embedding.length, model: this.config.embeddingModel },
        'Embedding generated'
      );

      return {
        embedding,
        model: this.config.embeddingModel,
        tokenCount: response.usage?.total_tokens,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to generate embedding');
      throw new LMStudioError('Failed to generate embedding', error);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      logger.debug({ count: texts.length }, 'Generating batch embeddings');

      const response = await this.client.embeddings.create({
        model: this.config.embeddingModel,
        input: texts,
        encoding_format: 'float', // Force float format to avoid base64 decoding issues
      });

      // Log dimensions of first embedding at INFO level
      if (response.data.length > 0) {
        logger.info(
          { dimensions: response.data[0].embedding.length, count: response.data.length },
          'Batch embeddings generated'
        );
      }

      return response.data.map((item, _index) => ({
        embedding: item.embedding,
        model: this.config.embeddingModel,
        tokenCount: undefined, // Batch doesn't provide per-item token counts
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to generate batch embeddings');
      throw new LMStudioError('Failed to generate batch embeddings', error);
    }
  }

  /**
   * Chat completion with LLM
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
    }
  ): Promise<string> {
    try {
      logger.debug(
        { messageCount: messages.length },
        'Sending chat completion request'
      );

      const response = await this.client.chat.completions.create({
        model: this.config.llmModel,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 2048,
        stop: options?.stopSequences,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LMStudioError('Empty response from LLM');
      }

      logger.debug(
        { responseLength: content.length },
        'Chat completion successful'
      );

      return content;
    } catch (error) {
      if (error instanceof LMStudioError) throw error;
      logger.error({ error }, 'Failed to complete chat');
      throw new LMStudioError('Failed to complete chat', error);
    }
  }

  /**
   * OCR: Convert image/PDF page to markdown using vision model
   */
  async ocrToMarkdown(
    imageBase64: string,
    mimeType: string = 'image/png'
  ): Promise<string> {
    try {
      logger.debug('Processing OCR request');

      const response = await this.client.chat.completions.create({
        model: this.config.ocrModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Convert this document page to well-formatted Markdown. Preserve the structure including headers, lists, tables, and paragraphs. Output only the markdown content without any preamble.',
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LMStudioError('Empty OCR response');
      }

      logger.debug({ responseLength: content.length }, 'OCR successful');

      return content;
    } catch (error) {
      if (error instanceof LMStudioError) throw error;
      logger.error({ error }, 'Failed to perform OCR');
      throw new LMStudioError('Failed to perform OCR', error);
    }
  }

  /**
   * Listwise reranking of documents using LLM
   */
  async rerankListwise(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topN: number
  ): Promise<Array<{ id: string; score: number }>> {
    try {
      logger.debug(
        { query, docCount: documents.length, topN },
        'Starting listwise reranking'
      );

      // Build the prompt for listwise reranking
      const docList = documents
        .map((doc, i) => `[${i + 1}] ${doc.content.substring(0, 500)}...`)
        .join('\n\n');

      const prompt = `You are a relevance ranker. Given a query and a list of documents, rank them by relevance to the query.

Query: ${query}

Documents:
${docList}

Rank the documents from most to least relevant. Return ONLY a JSON array of document numbers in order of relevance, like: [3, 1, 5, 2, 4]

Ranking:`;

      const response = await this.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0, maxTokens: 256 }
      );

      // Parse the ranking response
      const match = response.match(/\[[\d,\s]+\]/);
      if (!match) {
        logger.warn({ response }, 'Could not parse reranking response');
        // Fallback: return documents in original order
        return documents.slice(0, topN).map((doc, i) => ({
          id: doc.id,
          score: 1 - i * 0.1,
        }));
      }

      const ranking: number[] = JSON.parse(match[0]);
      const results: Array<{ id: string; score: number }> = [];

      for (let i = 0; i < Math.min(ranking.length, topN); i++) {
        const docIndex = ranking[i] - 1; // Convert 1-indexed to 0-indexed
        if (docIndex >= 0 && docIndex < documents.length) {
          results.push({
            id: documents[docIndex].id,
            score: 1 - i / ranking.length, // Higher score for higher rank
          });
        }
      }

      logger.debug({ resultCount: results.length }, 'Reranking complete');

      return results;
    } catch (error) {
      logger.error({ error }, 'Failed to rerank documents');
      throw new LMStudioError('Failed to rerank documents', error);
    }
  }

  /**
   * Generate answer with citations
   */
  async generateAnswer(
    query: string,
    contexts: Array<{
      index: number;
      content: string;
      filename: string;
      pageNumber?: number;
    }>
  ): Promise<{ answer: string; citedIndices: number[] }> {
    try {
      logger.debug(
        { query, contextCount: contexts.length },
        'Generating answer with citations'
      );

      const contextText = contexts
        .map(
          (ctx) =>
            `[${ctx.index}] (${ctx.filename}${ctx.pageNumber ? `, p.${ctx.pageNumber}` : ''}):\n${ctx.content}`
        )
        .join('\n\n---\n\n');

      const systemPrompt = `You are a helpful Medicaid eligibility assistant. Answer questions based ONLY on the provided context documents.

Rules:
1. Only use information from the provided documents
2. Cite your sources using [N] notation where N is the document number
3. If the information is not in the documents, say "I cannot find this information in the provided documents."
4. Be concise but thorough
5. At the end, list all citation numbers you used in a "Citations:" section`;

      const userPrompt = `Context Documents:
${contextText}

---

Question: ${query}

Please answer the question based only on the context above, citing sources with [N] notation.`;

      const response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.1, maxTokens: 1024 }
      );

      // Extract citation indices from the response
      const citationMatches = response.match(/\[(\d+)\]/g) || [];
      const citedIndices = [
        ...new Set(citationMatches.map((m) => parseInt(m.slice(1, -1)))),
      ].filter((n) => n >= 1 && n <= contexts.length);

      logger.debug(
        { citedIndices, answerLength: response.length },
        'Answer generated'
      );

      return { answer: response, citedIndices };
    } catch (error) {
      logger.error({ error }, 'Failed to generate answer');
      throw new LMStudioError('Failed to generate answer', error);
    }
  }

  /**
   * Health check - verify LM Studio is responding
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.models.list();
      return response.data.length > 0;
    } catch (error) {
      logger.error({ error }, 'LM Studio health check failed');
      return false;
    }
  }
}

// Singleton instance
let clientInstance: LMStudioClient | null = null;

export function getLMStudioClient(config: Config['lmStudio']): LMStudioClient {
  if (!clientInstance) {
    clientInstance = new LMStudioClient(config);
  }
  return clientInstance;
}

export function resetLMStudioClient(): void {
  clientInstance = null;
}
