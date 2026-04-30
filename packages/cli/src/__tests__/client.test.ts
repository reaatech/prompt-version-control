import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIClient } from '../client.js';

describe('APIClient', () => {
  let client: APIClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    client = new APIClient({ apiUrl: 'http://localhost:3000', apiKey: 'test-key' });
  });

  describe('listPrompts', () => {
    it('should return prompts list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ data: [{ id: '1', name: 'Test' }] }),
      });

      const result = await client.listPrompts();
      expect(result).toEqual({ data: [{ id: '1', name: 'Test' }] });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('getPrompt', () => {
    it('should return a single prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          id: '1',
          name: 'Test',
          template: 'Hello',
          description: null,
          variables: {},
        }),
      });

      const result = await client.getPrompt('1');
      expect(result.name).toBe('Test');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts/1',
        expect.anything(),
      );
    });
  });

  describe('createPrompt', () => {
    it('should create a prompt with POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: '1', name: 'New', template: 'Hello' }),
      });

      const result = await client.createPrompt({ name: 'New', template: 'Hello' });
      expect(result).toEqual({ id: '1', name: 'New', template: 'Hello' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New', template: 'Hello' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should create a prompt with optional fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: '2', name: 'Desc', template: 'T' }),
      });

      await client.createPrompt({
        name: 'Desc',
        template: 'T',
        description: 'A description',
        variables: { name: 'string' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify({
            name: 'Desc',
            template: 'T',
            description: 'A description',
            variables: { name: 'string' },
          }),
        }),
      );
    });
  });

  describe('createVersion', () => {
    it('should create a version for a prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: 'v1', number: 2, content: 'c' }),
      });

      const result = await client.createVersion('prompt-1', {
        content: 'c',
        template: 'Hello',
      });
      expect(result).toEqual({ id: 'v1', number: 2, content: 'c' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts/prompt-1/versions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'c', template: 'Hello' }),
        }),
      );
    });
  });

  describe('setTag', () => {
    it('should set a tag on a prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: 't1', name: 'prod', versionId: 'v1' }),
      });

      const result = await client.setTag('prompt-1', 'prod', 'v1');
      expect(result).toEqual({ id: 't1', name: 'prod', versionId: 'v1' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/prompts/prompt-1/tags/prod',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ versionId: 'v1' }),
        }),
      );
    });
  });

  describe('getProduction', () => {
    it('should return production version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ id: 'v1', number: 1, content: 'content' }),
      });

      const result = await client.getProduction('prompt-1');
      expect(result).toEqual({ id: 'v1', number: 1, content: 'content' });
    });
  });

  describe('error handling', () => {
    it('should throw error with message from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce({ error: { message: 'Bad Request' } }),
      });

      await expect(client.getPrompt('1')).rejects.toThrow('Bad Request');
    });

    it('should throw HTTP status when response body has no message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValueOnce(new Error('fail')),
      });

      await expect(client.getPrompt('1')).rejects.toThrow('HTTP 500');
    });

    it('should throw HTTP status when response body is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await expect(client.getPrompt('1')).rejects.toThrow('HTTP 404');
    });
  });
});
