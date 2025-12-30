import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LMStudioClient, getLMStudioClient, resetLMStudioClient } from './lm-studio.js';

// Mock OpenAI client
const mockEmbeddingsCreate = vi.fn();
const mockChatCompletionsCreate = vi.fn();
const mockModelsList = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate,
    },
    chat: {
      completions: {
        create: mockChatCompletionsCreate,
      },
    },
    models: {
      list: mockModelsList,
    },
  })),
}));

describe('LMStudioClient', () => {
  let client: LMStudioClient;

  const testConfig = {
    baseUrl: 'http://localhost:1234/v1',
    embeddingModel: 'nomic-embed-text-v1.5',
    llmModel: 'qwen2.5-7b-instruct',
    ocrModel: 'allenai/olmocr-2-7b',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetLMStudioClient();
    client = getLMStudioClient(testConfig);
  });

  afterEach(() => {
    resetLMStudioClient();
  });

  describe('embed', () => {
    it('should generate embedding for text', async () => {
      const mockEmbedding = new Array(768).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
        usage: { total_tokens: 10 },
      });

      const result = await client.embed('Test text');

      expect(result).toEqual({
        embedding: mockEmbedding,
        model: 'nomic-embed-text-v1.5',
        tokenCount: 10,
      });
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'nomic-embed-text-v1.5',
        input: 'Test text',
        encoding_format: 'float',
      });
    });

    it('should throw LMStudioError on failure', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('API error'));

      await expect(client.embed('Test')).rejects.toThrow('Failed to generate embedding');
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbeddings = [
        { embedding: new Array(768).fill(0.1) },
        { embedding: new Array(768).fill(0.2) },
      ];
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: mockEmbeddings,
      });

      const result = await client.embedBatch(['Text 1', 'Text 2']);

      expect(result).toHaveLength(2);
      expect(result[0].model).toBe('nomic-embed-text-v1.5');
    });

    it('should handle empty batch', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({ data: [] });

      const result = await client.embedBatch([]);

      expect(result).toEqual([]);
    });
  });

  describe('chat', () => {
    it('should complete chat with default options', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Test response' } }],
      });

      const result = await client.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBe('Test response');
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'qwen2.5-7b-instruct',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.1,
        max_tokens: 2048,
        stop: undefined,
      });
    });

    it('should use custom options when provided', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response' } }],
      });

      await client.chat(
        [{ role: 'user', content: 'Test' }],
        { temperature: 0.5, maxTokens: 1024, stopSequences: ['STOP'] }
      );

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'qwen2.5-7b-instruct',
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.5,
        max_tokens: 1024,
        stop: ['STOP'],
      });
    });

    it('should throw LMStudioError on empty response', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        client.chat([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Empty response from LLM');
    });

    it('should throw LMStudioError on API failure', async () => {
      mockChatCompletionsCreate.mockRejectedValueOnce(new Error('API error'));

      await expect(
        client.chat([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Failed to complete chat');
    });
  });

  describe('ocrToMarkdown', () => {
    it('should convert image to markdown', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '# Document Title\n\nContent here.' } }],
      });

      const result = await client.ocrToMarkdown('base64ImageData', 'image/png');

      expect(result).toBe('# Document Title\n\nContent here.');
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'allenai/olmocr-2-7b',
          max_tokens: 4096,
          temperature: 0,
        })
      );
    });

    it('should throw LMStudioError on empty OCR response', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
      });

      await expect(
        client.ocrToMarkdown('base64Data')
      ).rejects.toThrow('Empty OCR response');
    });
  });

  describe('rerankListwise', () => {
    it('should rerank documents and return top N', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '[2, 1, 3]' } }],
      });

      const documents = [
        { id: 'doc-1', content: 'Document 1 content' },
        { id: 'doc-2', content: 'Document 2 content' },
        { id: 'doc-3', content: 'Document 3 content' },
      ];

      const result = await client.rerankListwise('query', documents, 2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc-2'); // doc-2 was ranked first
      expect(result[1].id).toBe('doc-1');
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('should fallback to original order on parse failure', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'I cannot rank these documents.' } }],
      });

      const documents = [
        { id: 'doc-1', content: 'Content 1' },
        { id: 'doc-2', content: 'Content 2' },
      ];

      const result = await client.rerankListwise('query', documents, 2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc-1'); // Original order preserved
      expect(result[1].id).toBe('doc-2');
    });

    it('should handle out-of-bounds indices gracefully', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '[5, 1, 10]' } }], // Invalid indices
      });

      const documents = [
        { id: 'doc-1', content: 'Content 1' },
        { id: 'doc-2', content: 'Content 2' },
      ];

      const result = await client.rerankListwise('query', documents, 2);

      // Should only include valid indices
      expect(result.some(r => r.id === 'doc-1')).toBe(true);
    });
  });

  describe('generateAnswer', () => {
    it('should generate answer with citations', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Medicare Savings Programs help pay Medicare costs [1]. QMB is one option [2].\n\nCitations: [1], [2]',
          },
        }],
      });

      const contexts = [
        { index: 1, content: 'MSP info', filename: 'msp.pdf', pageNumber: 1 },
        { index: 2, content: 'QMB info', filename: 'msp.pdf', pageNumber: 2 },
      ];

      const result = await client.generateAnswer('What is MSP?', contexts);

      expect(result.answer).toContain('Medicare Savings Programs');
      expect(result.citedIndices).toEqual([1, 2]);
    });

    it('should handle no citations in answer', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I cannot find this information in the provided documents.',
          },
        }],
      });

      const result = await client.generateAnswer('Unknown topic', []);

      expect(result.citedIndices).toEqual([]);
    });

    it('should filter invalid citation indices', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Answer with citations [1], [5], [10]', // 5 and 10 are out of range
          },
        }],
      });

      const contexts = [
        { index: 1, content: 'Content', filename: 'test.pdf' },
        { index: 2, content: 'Content 2', filename: 'test.pdf' },
      ];

      const result = await client.generateAnswer('Query', contexts);

      expect(result.citedIndices).toEqual([1]); // Only valid index
    });
  });

  describe('healthCheck', () => {
    it('should return true when models are available', async () => {
      mockModelsList.mockResolvedValueOnce({
        data: [{ id: 'model-1' }],
      });

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when no models available', async () => {
      mockModelsList.mockResolvedValueOnce({ data: [] });

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on API failure', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const client1 = getLMStudioClient(testConfig);
      const client2 = getLMStudioClient(testConfig);

      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      const client1 = getLMStudioClient(testConfig);
      resetLMStudioClient();
      const client2 = getLMStudioClient(testConfig);

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });
});
