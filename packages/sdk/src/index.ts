import { sleep } from '@pvc/shared';

export interface PVCClientOptions {
  apiKey: string;
  baseUrl?: string;
  retries?: number;
  retryDelay?: number;
  timeoutMs?: number;
  cache?: boolean;
  cacheTtl?: number;
  cacheMaxEntries?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class PromptVersionControlClient {
  private apiKey: string;
  private baseUrl: string;
  private retries: number;
  private retryDelay: number;
  private timeoutMs: number;
  private cache: Map<string, CacheEntry<unknown>>;
  private cacheEnabled: boolean;
  private cacheTtl: number;
  private cacheMaxEntries: number;

  constructor(options: PVCClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'http://localhost:3000';
    this.retries = options.retries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.cacheEnabled = options.cache ?? false;
    this.cacheTtl = options.cacheTtl ?? 60_000;
    this.cacheMaxEntries = options.cacheMaxEntries ?? 1000;
    this.cache = new Map();
  }

  private cacheKey(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private getCached<T>(path: string): T | undefined {
    if (!this.cacheEnabled) return undefined;
    const key = this.cacheKey(path);
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    if (entry) this.cache.delete(key);
    return undefined;
  }

  private setCached<T>(path: string, data: T): void {
    if (!this.cacheEnabled) return;
    if (this.cache.size >= this.cacheMaxEntries) {
      // Simple FIFO eviction — drop the oldest entry.
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(this.cacheKey(path), {
      data,
      expiresAt: Date.now() + this.cacheTtl,
    });
  }

  private async fetchWithRetry<T>(path: string, init?: RequestInit): Promise<T> {
    const cached = this.getCached<T>(path);
    if (cached !== undefined) return cached;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...init?.headers,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new HttpError(res.status, body.error?.message || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as T;
        this.setCached(path, data);
        return data;
      } catch (err) {
        lastError = err as Error;

        // Only retry on network errors and 5xx; client errors will not become
        // success on retry, and rate limits should be respected by the caller.
        const retriable = !(err instanceof HttpError) || (err.status >= 500 && err.status < 600);
        if (!retriable) throw err;

        if (attempt < this.retries - 1) {
          await sleep(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  async getPrompt(id: string) {
    return this.fetchWithRetry<{ id: string; name: string; template: string }>(
      `/api/v1/prompts/${id}`,
    );
  }

  async listPrompts() {
    return this.fetchWithRetry<{ data: Array<{ id: string; name: string }> }>('/api/v1/prompts');
  }

  async getProduction(promptId: string) {
    return this.fetchWithRetry<{
      id: string;
      number: number;
      content: string;
      template: string;
      variables: Record<string, unknown>;
      metadata: Record<string, unknown> | null;
    }>(`/api/v1/prompts/${promptId}/production`);
  }
}

export { PromptVersionControlClient as PVCClient };
