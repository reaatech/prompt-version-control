import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../db/client.js';
import { deploymentService } from '../../../services/deployment.service.js';
import { deploymentRoutes } from '../deployments.js';

vi.mock('../../../services/deployment.service.js', () => ({
  deploymentService: {
    createDeployment: vi.fn(),
    listDeployments: vi.fn(),
    resolveVersion: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

function authHeader() {
  return { Authorization: 'Bearer test-key' };
}

describe('deploymentRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma.apiKey, 'findUnique').mockResolvedValue({
      id: 'key_1',
      projectId: 'proj_1',
      project: { id: 'proj_1', name: 'Test' },
      expiresAt: null,
    } as unknown as Awaited<ReturnType<typeof prisma.apiKey.findUnique>>);
    vi.spyOn(prisma.apiKey, 'update').mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof prisma.apiKey.update>>,
    );
    app = new Hono();
    app.route('/deployments', deploymentRoutes);
  });

  it('POST /deployments creates a deployment', async () => {
    vi.mocked(deploymentService.createDeployment).mockResolvedValue({
      id: 'd1',
      name: 'A/B',
    } as unknown as Awaited<ReturnType<typeof deploymentService.createDeployment>>);

    const res = await app.request('/deployments', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptId: 'p1',
        name: 'A/B',
        variants: [{ versionId: 'v1', weight: 100, isControl: true }],
      }),
    });
    expect(res.status).toBe(201);
  });

  it('GET /deployments lists deployments', async () => {
    vi.mocked(deploymentService.listDeployments).mockResolvedValue([
      { id: 'd1' },
    ] as unknown as Awaited<ReturnType<typeof deploymentService.listDeployments>>);

    const res = await app.request('/deployments', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it('GET /deployments/:id/resolve returns version', async () => {
    vi.mocked(deploymentService.resolveVersion).mockResolvedValue('v1');

    const res = await app.request('/deployments/d1/resolve?sessionId=s1', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { versionId: string };
    expect(body.versionId).toBe('v1');
  });

  it('PUT /deployments/:id updates status', async () => {
    vi.mocked(deploymentService.updateStatus).mockResolvedValue({
      id: 'd1',
      status: 'paused',
    } as unknown as Awaited<ReturnType<typeof deploymentService.updateStatus>>);

    const res = await app.request('/deployments/d1', {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    });
    expect(res.status).toBe(200);
  });
});
