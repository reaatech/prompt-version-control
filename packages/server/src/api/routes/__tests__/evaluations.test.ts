import { hashApiKey } from '@reaatech/prompt-version-control-shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../db/client.js';
import { evalService } from '../../../services/eval.service.js';
import { evaluationRoutes } from '../evaluations.js';

vi.mock('../../../services/eval.service.js', () => ({
  evalService: {
    trigger: vi.fn(),
    receiveWebhook: vi.fn(),
    listByVersion: vi.fn(),
    getPromotionGateStatus: vi.fn(),
  },
}));

function authHeader() {
  return { Authorization: 'Bearer test-key' };
}

describe('evaluationRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma.apiKey, 'findUnique').mockImplementation((async (args: {
      where?: { keyHash?: string };
    }) => {
      const where = args?.where as { keyHash?: string };
      if (where?.keyHash === hashApiKey('test-key')) {
        return {
          id: 'key_1',
          projectId: 'proj_1',
          project: { id: 'proj_1', name: 'Test' },
          expiresAt: null,
        } as unknown as Awaited<ReturnType<typeof prisma.apiKey.findUnique>>;
      }
      return null;
    }) as unknown as typeof prisma.apiKey.findUnique);
    vi.spyOn(prisma.apiKey, 'update').mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof prisma.apiKey.update>>,
    );
    app = new Hono();
    app.route('/evaluations', evaluationRoutes);
  });

  it('POST /evaluations/trigger creates an evaluation', async () => {
    vi.mocked(evalService.trigger).mockResolvedValue({
      id: 'e1',
      status: 'running',
    } as unknown as Awaited<ReturnType<typeof evalService.trigger>>);

    const res = await app.request('/evaluations/trigger', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId: 'v1', harnessId: 'h1' }),
    });
    expect(res.status).toBe(201);
    expect(evalService.trigger).toHaveBeenCalledWith('proj_1', 'v1', 'h1');
  });

  it('POST /evaluations/webhook is public and routes by evaluationId', async () => {
    vi.mocked(evalService.receiveWebhook).mockResolvedValue({
      id: 'e1',
      status: 'passed',
    } as unknown as Awaited<ReturnType<typeof evalService.receiveWebhook>>);

    const res = await app.request('/evaluations/webhook?evaluationId=e1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'passed', score: 0.9 }),
    });
    expect(res.status).toBe(200);
    expect(evalService.receiveWebhook).toHaveBeenCalledWith(
      'e1',
      expect.any(String),
      undefined,
      expect.objectContaining({ status: 'passed', score: 0.9 }),
    );
  });

  it('POST /evaluations/webhook rejects when evaluationId is missing', async () => {
    const res = await app.request('/evaluations/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'passed' }),
    });
    // Without an error handler installed in this test app, hono returns 500.
    expect([400, 500]).toContain(res.status);
  });

  it('GET /evaluations/versions/:versionId lists evaluations', async () => {
    vi.mocked(evalService.listByVersion).mockResolvedValue([{ id: 'e1' }] as unknown as Awaited<
      ReturnType<typeof evalService.listByVersion>
    >);

    const res = await app.request('/evaluations/versions/v1', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
    expect(evalService.listByVersion).toHaveBeenCalledWith('proj_1', 'v1');
  });

  it('GET /evaluations/versions/:versionId/gate returns gate status', async () => {
    vi.mocked(evalService.getPromotionGateStatus).mockResolvedValue({
      canPromote: true,
      evaluations: [],
    });

    const res = await app.request('/evaluations/versions/v1/gate', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { canPromote: boolean };
    expect(body.canPromote).toBe(true);
  });
});
