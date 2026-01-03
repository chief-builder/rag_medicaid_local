import { useMutation } from '@tanstack/react-query';
import { submitQuery, generateMessageId } from '../api/client';
import type { Message, QueryResponse } from '../types';

interface UseSubmitQueryOptions {
  onSuccess?: (response: QueryResponse, query: string) => void;
  onError?: (error: Error, query: string) => void;
}

/**
 * Hook to submit queries to the RAG system
 * Returns a mutation that can be triggered with a query string
 */
export function useSubmitQuery(options?: UseSubmitQueryOptions) {
  return useMutation({
    mutationFn: (query: string) => submitQuery(query),
    onSuccess: (data, query) => {
      options?.onSuccess?.(data, query);
    },
    onError: (error: Error, query) => {
      options?.onError?.(error, query);
    },
  });
}

/**
 * Create a user message object
 */
export function createUserMessage(content: string): Message {
  return {
    id: generateMessageId(),
    type: 'user',
    content,
    timestamp: new Date(),
  };
}

/**
 * Create an assistant message from API response
 */
export function createAssistantMessage(response: QueryResponse): Message {
  return {
    id: generateMessageId(),
    type: 'assistant',
    content: response.answer,
    timestamp: new Date(),
    citations: response.citations,
    retrievalStats: response.retrievalStats,
    freshnessInfo: response.freshnessInfo,
    disclaimer: response.disclaimer,
    confidence: response.confidence,
    latencyMs: response.latencyMs,
  };
}

/**
 * Create a loading placeholder message
 */
export function createLoadingMessage(): Message {
  return {
    id: generateMessageId(),
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    isLoading: true,
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(error: string): Message {
  return {
    id: generateMessageId(),
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    error,
  };
}
