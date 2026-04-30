import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../db/client.js';
import { metricService } from '../../../services/metric.service.js';
import { metricRoutes } from '../metrics.js';

vi.mock('../../../services/metric.service.js', () => ({
  metricService: {
    ingest: vi.fn(),
    getVersionMetrics: vi.fn(),
    getPromptMetrics: vi.fn(),
  },
}));

function authHeader() {
  return { Authorization: 'Bearer test-key' };
}

describe('metricRoutes', () => {
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
    app.route('/metrics', metricRoutes);
  });

  it('POST /metrics/ingest creates metrics', async () => {
    vi.mocked(metricService.ingest).mockResolvedValue({ ingested: 2 });

    const res = await app.request('/metrics/ingest', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metrics: [{ versionId: 'v1', type: 'latency', name: 't1', value: 100, unit: 'ms' }],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.ingested).toBe(2);
  });

  it('GET /metrics/versions/:versionId returns metrics', async () => {
    vi.mocked(metricService.getVersionMetrics).mockResolvedValue([{ id: 'm1' }] as any);

    const res = await app.request('/metrics/versions/v1?hours=24', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
  });

  it('GET /metrics/prompts/:promptId returns metrics', async () => {
    vi.mocked(metricService.getPromptMetrics).mockResolvedValue([{ id: 'm1' }] as any);

    const res = await app.request('/metrics/prompts/p1', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
  });
});
