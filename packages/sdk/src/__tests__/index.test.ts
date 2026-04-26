import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptVersionControlClient, PVCClient } from '../index.js';

describe('PromptVersionControlClient', () => {
  let client: PromptVersionControlClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    client = new PVCClient({ apiKey: 'test-key', baseUrl: 'http://localhost:3000' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default options when not provided', () => {
      const defaultClient = new PVCClient({ apiKey: 'key' });
      expect((defaultClient as any).baseUrl).toBe('http://localhost:3000');
      expect((defaultClient as any).retries).toBe(3);
      expect((defaultClient as any).retryDelay).toBe(1000);
      expect((defaultClient as any).cacheEnabled).toBe(false);
      expect((defaultClient as any).cacheTtl).toBe(60_000);
    });

    it('should override default options with custom values', () => {
      const customClient = new PVCClient({
        apiKey: 'key',
        baseUrl: 'http://custom',
        retries: 5,
        retryDelay: 200,
        cache: true,
        cacheTtl: 30_000,
      });
      expect((customClient as any).baseUrl).toBe('http://custom');
      expect((customClient as any).retries).toBe(5);
      expect((customClient as any).retryDelay).toBe(200);
      expect((customClient as any).cacheEnabled).toBe(true);
      expect((customClient as any).cacheTtl).toBe(30_000);
    });
  });

  describe('getPrompt', () => {
    it('should return parsed JSON on successful GET', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: '1', name: 'Test Prompt', template: 'Hello' }),
      });

      const result = await client.getPrompt('1');
      expect(result).toEqual({ id: '1', name: 'Test Prompt', template: 'Hello' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts/1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('listPrompts', () => {
    it('should return list of prompts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ data: [{ id: '1', name: 'A' }] }),
      });

      const result = await client.listPrompts();
      expect(result).toEqual({ data: [{ id: '1', name: 'A' }] });
    });
  });

  describe('getProduction', () => {
    it('should return production version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          id: 'v1',
          number: 1,
          content: 'content',
          template: 'Hello {{name}}',
          variables: {},
          metadata: null,
        }),
      });

      const result = await client.getProduction('prompt-1');
      expect(result.number).toBe(1);
    });
  });

  describe('retry logic', () => {
    it('should retry on failure and eventually succeed', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({ data: [] }),
        });

      const result = await client.listPrompts();
      expect(result).toEqual({ data: [] });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw last error when all retries are exhausted', async () => {
      const finalError = new Error('Final failure');
      mockFetch.mockRejectedValue(finalError);

      await expect(client.getPrompt('1')).rejects.toThrow('Final failure');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('caching', () => {
    it('should return cached data without calling fetch on cache hit', async () => {
      const cachedClient = new PVCClient({
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3000',
        cache: true,
        cacheTtl: 60_000,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: '1', name: 'Test' }),
      });

      await cachedClient.getPrompt('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const result = await cachedClient.getPrompt('1');
      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should call fetch for different paths (cache miss)', async () => {
      const cachedClient = new PVCClient({
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3000',
        cache: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await cachedClient.getPrompt('1');
      await cachedClient.getPrompt('2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after TTL', async () => {
      vi.useFakeTimers();
      const cachedClient = new PVCClient({
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3000',
        cache: true,
        cacheTtl: 1000,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
      });

      await cachedClient.getPrompt('1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1500);

      await cachedClient.getPrompt('1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('headers', () => {
    it('should send Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await client.getProduction('prompt-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts/prompt-1/production',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });
});
