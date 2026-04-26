import { prisma } from '../db/client.js';
import { NotFoundError, UnauthorizedError } from '../errors.js';
import { evaluationsCompleted } from './prometheus.service.js';
import { logger } from '../utils/logger.js';
import { createHmac, timingSafeEqual } from 'crypto';
import type { EvalStatus } from '@pvc/shared';
import type { Prisma } from '@prisma/client';

// Read at call time so deployments can rotate secrets without a restart and
// so tests can toggle them between cases.
const evalHarnessUrl = () => process.env.EVAL_HARNESS_URL;
const evalWebhookSecret = () => process.env.EVAL_WEBHOOK_SECRET;

export class EvalService {
  async trigger(projectId: string, versionId: string, harnessId: string) {
    const version = await prisma.version.findFirst({
      where: { id: versionId, prompt: { projectId } },
    });
    if (!version) {
      throw new NotFoundError('Version', versionId);
    }

    const eval_ = await prisma.evaluation.create({
      data: {
        versionId,
        harnessId,
        status: 'pending',
      },
    });

    const harnessUrl = evalHarnessUrl();
    const harnessSecret = evalWebhookSecret();
    if (harnessUrl) {
      try {
        const res = await fetch(`${harnessUrl}/evaluations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(harnessSecret ? { 'X-Webhook-Secret': harnessSecret } : {}),
          },
          body: JSON.stringify({
            evaluationId: eval_.id,
            versionId,
            harnessId,
            content: version.content,
            template: version.template,
            variables: version.variables,
            callbackUrl: this.buildCallbackUrl(eval_.id),
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          logger.warn(
            { evaluationId: eval_.id, status: res.status },
            'eval harness returned non-ok status',
          );
        }
      } catch (err) {
        logger.warn({ evaluationId: eval_.id, err }, 'eval harness call failed');
      }
    }

    const updated = await prisma.evaluation.update({
      where: { id: eval_.id },
      data: { status: 'running', startedAt: new Date() },
    });

    return updated;
  }

  /**
   * Receive a callback from the eval harness. Scoped strictly by evaluationId
   * (carried in the callback URL we issued); HMAC verified when EVAL_WEBHOOK_SECRET
   * is configured. No API key is required — this endpoint is meant for
   * external harnesses, authenticated via the shared HMAC secret.
   */
  async receiveWebhook(
    evaluationId: string,
    rawBody: string,
    signatureHeader: string | undefined,
    payload: {
      status: EvalStatus;
      score?: number;
      metrics?: Record<string, unknown>;
    },
  ) {
    const secret = evalWebhookSecret();
    if (secret) {
      if (!signatureHeader) {
        throw new UnauthorizedError('Missing webhook signature');
      }
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const provided = signatureHeader.startsWith('sha256=')
        ? signatureHeader.slice('sha256='.length)
        : signatureHeader;
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(provided, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedError('Invalid webhook signature');
      }
    }

    const eval_ = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
    if (!eval_) {
      throw new NotFoundError('Evaluation', evaluationId);
    }

    const updated = await prisma.evaluation.update({
      where: { id: eval_.id },
      data: {
        status: payload.status,
        score: payload.score,
        metrics: payload.metrics as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    evaluationsCompleted.inc({ status: payload.status });

    return updated;
  }

  async listByVersion(projectId: string, versionId: string) {
    const version = await prisma.version.findFirst({
      where: { id: versionId, prompt: { projectId } },
      select: { id: true },
    });
    if (!version) {
      throw new NotFoundError('Version', versionId);
    }
    return prisma.evaluation.findMany({
      where: { versionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPromotionGateStatus(
    projectId: string,
    versionId: string,
  ): Promise<{
    canPromote: boolean;
    reason?: string;
    evaluations: Awaited<ReturnType<EvalService['listByVersion']>>;
  }> {
    const evals = await this.listByVersion(projectId, versionId);

    if (evals.length === 0) {
      return { canPromote: false, reason: 'No evaluations found', evaluations: evals };
    }

    const failed = evals.filter((e) => e.status === 'failed');
    if (failed.length > 0) {
      return {
        canPromote: false,
        reason: `${failed.length} evaluation(s) failed`,
        evaluations: evals,
      };
    }

    const pending = evals.filter((e) => e.status === 'pending' || e.status === 'running');
    if (pending.length > 0) {
      return {
        canPromote: false,
        reason: `${pending.length} evaluation(s) still pending`,
        evaluations: evals,
      };
    }

    const scores = evals.map((e) => e.score).filter((s): s is number => s !== null);

    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avgScore < 0.8) {
        return {
          canPromote: false,
          reason: `Average score ${avgScore.toFixed(2)} below threshold 0.80`,
          evaluations: evals,
        };
      }
    }

    return { canPromote: true, evaluations: evals };
  }

  private buildCallbackUrl(evaluationId: string): string {
    const baseUrl = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${baseUrl}/api/v1/evaluations/webhook?evaluationId=${evaluationId}`;
  }
}

export const evalService = new EvalService();
