/**
 * API Client for the PA Medicaid Assistant
 * Connects to the Express.js backend REST API
 */

import type {
  QueryRequest,
  QueryResponse,
  HealthResponse,
  MetricsResponse,
} from '../types';

// API base URL - empty string means same origin (works with Vite proxy in dev)
const API_BASE = '';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Convert technical errors to user-friendly messages
 */
function getFriendlyErrorMessage(error: unknown, status?: number): string {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return "We're having trouble connecting to the server. Please check your internet connection and try again.";
  }

  if (status === 503) {
    return 'The service is temporarily unavailable. Please try again in a few moments.';
  }

  if (status === 500) {
    return 'Something went wrong on our end. Please try again, or call the helpline if the problem continues.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  return "We couldn't process your question. Please try again, or call the PHLP helpline at 1-800-274-3258 for assistance.";
}

/**
 * Make a fetch request with error handling
 */
async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorMessage = getFriendlyErrorMessage(null, response.status);
      throw new ApiError(errorMessage, response.status);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network errors (no internet, server down, etc.)
    throw new ApiError(getFriendlyErrorMessage(error), 0, true);
  }
}

/**
 * Submit a query to the RAG system
 */
export async function submitQuery(
  query: string,
  useCache: boolean = true
): Promise<QueryResponse> {
  const request: QueryRequest = { query, useCache };

  return fetchWithErrorHandling<QueryResponse>(`${API_BASE}/query`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Check if the API is healthy
 */
export async function checkHealth(): Promise<HealthResponse> {
  return fetchWithErrorHandling<HealthResponse>(`${API_BASE}/health`);
}

/**
 * Get query metrics (for caregiver mode)
 */
export async function getMetrics(): Promise<MetricsResponse> {
  return fetchWithErrorHandling<MetricsResponse>(`${API_BASE}/metrics`);
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
