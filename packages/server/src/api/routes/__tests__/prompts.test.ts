import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { promptRoutes } from '../prompts.js';
import { prisma } from '../../../db/client.js';
import { promptService } from '../../../services/prompt.service.js';
import { tagService } from '../../../services/tag.service.js';
import { diffEngine } from '../../../services/diff.engine.js';

vi.mock('../../../services/prompt.service.js', () => ({
  promptService: {
    listPrompts: vi.fn(),
    createPrompt: vi.fn(),
    getPrompt: vi.fn(),
    updatePrompt: vi.fn(),
    archivePrompt: vi.fn(),
    listVersions: vi.fn(),
    createVersion: vi.fn(),
    getVersion: vi.fn(),
  },
}));

vi.mock('../../../services/tag.service.js', () => ({
  tagService: {
    getProductionVersion: vi.fn(),
  },
}));

vi.mock('../../../services/diff.engine.js', () => ({
  diffEngine: {
    diff: vi.fn(),
  },
}));

vi.mock('../../../services/audit.service.js', () => ({
  auditService: {
    log: vi.fn(),
  },
}));

function authHeader() {
  return { Authorization: 'Bearer test-key' };
}

describe('promptRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma.apiKey, 'findUnique').mockResolvedValue({
      id: 'key_1',
      projectId: 'proj_1',
      project: { id: 'proj_1', name: 'Test' },
      expiresAt: null,
    } as any);
    vi.spyOn(prisma.apiKey, 'update').mockResolvedValue({} as any);
    app = new Hono();
    app.route('/prompts', promptRoutes);
  });

  it('GET /prompts lists prompts', async () => {
    vi.mocked(promptService.listPrompts).mockResolvedValue({
      data: [{ id: 'p1', name: 'test' }],
      meta: { limit: 20 },
    });

    const res = await app.request('/prompts?limit=20', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /prompts creates a prompt', async () => {
    vi.mocked(promptService.createPrompt).mockResolvedValue({ id: 'p1', name: 'test' } as any);

    const res = await app.request('/prompts', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test', template: 'hello' }),
    });
    expect(res.status).toBe(201);
  });

  it('GET /prompts/:id gets a prompt', async () => {
    vi.mocked(promptService.getPrompt).mockResolvedValue({ id: 'p1', name: 'test' } as any);

    const res = await app.request('/prompts/p1', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('PUT /prompts/:id updates a prompt', async () => {
    vi.mocked(promptService.updatePrompt).mockResolvedValue({ id: 'p1', name: 'updated' } as any);

    const res = await app.request('/prompts/p1', {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    });
    expect(res.status).toBe(200);
  });

  it('DELETE /prompts/:id archives a prompt', async () => {
    vi.mocked(promptService.archivePrompt).mockResolvedValue({ id: 'p1', archived: true } as any);

    const res = await app.request('/prompts/p1', { method: 'DELETE', headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('GET /prompts/:id/versions lists versions', async () => {
    vi.mocked(promptService.listVersions).mockResolvedValue({
      data: [{ id: 'v1', number: 1 }],
      meta: { limit: 20 },
    });

    const res = await app.request('/prompts/p1/versions?limit=20', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('POST /prompts/:id/versions creates a version', async () => {
    vi.mocked(promptService.createVersion).mockResolvedValue({ id: 'v1', number: 2 } as any);

    const res = await app.request('/prompts/p1/versions', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello', template: 'hello' }),
    });
    expect(res.status).toBe(201);
  });

  it('GET /prompts/:id/production gets production version', async () => {
    vi.mocked(tagService.getProductionVersion).mockResolvedValue({ id: 'v1', number: 2 } as any);

    const res = await app.request('/prompts/p1/production', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('GET /prompts/:id/diff returns diff', async () => {
    vi.mocked(diffEngine.diff).mockResolvedValue({ impact: 'minor', sections: [] } as any);

    const res = await app.request('/prompts/p1/diff?fromVersion=1&toVersion=2', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
  });
});
