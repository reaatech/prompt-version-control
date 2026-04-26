import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { hashApiKey } from '@pvc/shared';
import { authMiddleware } from '../auth.js';
import { prisma } from '../../db/client.js';
import { errorHandler } from '../error-handler.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('authMiddleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use('/test', authMiddleware);
    app.get('/test', (c) => c.text('ok'));
    app.onError(errorHandler);
  });

  it('should throw UnauthorizedError when authorization header is missing', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should throw UnauthorizedError when format is not Bearer', async () => {
    const res = await app.request('/test', {
      headers: { authorization: 'Basic abc' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should throw UnauthorizedError when API key is not found', async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer invalid-key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should throw UnauthorizedError when API key is expired', async () => {
    const keyHash = hashApiKey('expired-key');
    const past = new Date(Date.now() - 1000);
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'key_123',
      keyHash,
      projectId: 'proj_123',
      project: { id: 'proj_123', name: 'Test' },
      expiresAt: past,
      lastUsedAt: null,
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof prisma.apiKey.findUnique>>);

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer expired-key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toContain('expired');
  });

  it('should set context for valid API key', async () => {
    const keyHash = hashApiKey('valid-key-1');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'key_valid_1',
      keyHash,
      projectId: 'proj_123',
      project: { id: 'proj_123', name: 'Test' },
      expiresAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof prisma.apiKey.findUnique>>);

    let capturedProjectId: string | undefined;
    let capturedApiKey: unknown;
    let capturedProject: unknown;

    app = new Hono();
    app.use('/test', authMiddleware);
    app.get('/test', (c) => {
      capturedProjectId = c.get('projectId');
      capturedApiKey = c.get('apiKey');
      capturedProject = c.get('project');
      return c.text('ok');
    });
    app.onError(errorHandler);

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer valid-key-1' },
    });

    expect(res.status).toBe(200);
    expect(capturedProjectId).toBe('proj_123');
    expect((capturedApiKey as { id: string }).id).toBe('key_valid_1');
    expect((capturedProject as { id: string }).id).toBe('proj_123');
  });
});
