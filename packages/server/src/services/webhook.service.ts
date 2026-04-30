import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { sleep } from '@reaatech/prompt-version-control-shared';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { type AppEvent, type EventType, eventBus } from './event.bus.js';

const WEBHOOK_TIMEOUT_MS = 10_000;
const ALLOW_PRIVATE = process.env.WEBHOOK_ALLOW_PRIVATE === '1';

/**
 * Reject URLs that point at private/loopback/link-local addresses to prevent
 * SSRF. Set WEBHOOK_ALLOW_PRIVATE=1 to disable (only safe in trusted dev envs).
 */
async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid webhook url: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`webhook url must be http(s): ${url.protocol}`);
  }

  if (ALLOW_PRIVATE) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const candidates: string[] = [];
  if (isIP(host)) {
    candidates.push(host);
  } else {
    try {
      const records = await lookup(host, { all: true });
      for (const r of records) candidates.push(r.address);
    } catch {
      throw new Error(`could not resolve webhook host: ${host}`);
    }
  }

  for (const addr of candidates) {
    if (isPrivateAddress(addr)) {
      throw new Error(`webhook url resolves to disallowed address: ${addr}`);
    }
  }
  return url;
}

function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 4) {
    const parts = addr.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local & metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  if (isIP(addr) === 6) {
    const lower = addr.toLowerCase();
    if (lower === '::1') return true;
    if (lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('ff')) return true; // multicast
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped — recurse on the v4 part
      const v4 = lower.slice('::ffff:'.length);
      return isPrivateAddress(v4);
    }
    return false;
  }
  return true;
}

export class WebhookService {
  private retryDelays = [1_000, 5_000, 15_000, 60_000]; // ms

  constructor() {
    eventBus.on('version.created', (e) => this.deliver(e));
    eventBus.on('tag.moved', (e) => this.deliver(e));
    eventBus.on('eval.completed', (e) => this.deliver(e));
    eventBus.on('promotion.requested', (e) => this.deliver(e));
    eventBus.on('promotion.approved', (e) => this.deliver(e));
    eventBus.on('promotion.rejected', (e) => this.deliver(e));
  }

  async createSubscription(
    projectId: string,
    data: {
      url: string;
      events: EventType[];
      secret: string;
    },
  ) {
    // Validate destination at creation time so users get immediate feedback.
    await assertPublicUrl(data.url);
    return prisma.webhookSubscription.create({
      data: {
        projectId,
        url: data.url,
        events: data.events,
        secret: data.secret,
        active: true,
      },
    });
  }

  async listSubscriptions(projectId: string) {
    return prisma.webhookSubscription.findMany({
      where: { projectId },
    });
  }

  async deleteSubscription(projectId: string, id: string) {
    return prisma.webhookSubscription.deleteMany({
      where: { id, projectId },
    });
  }

  async testDelivery(
    projectId: string,
    id: string,
  ): Promise<{ success: boolean; status?: number; error?: string }> {
    const sub = await prisma.webhookSubscription.findFirst({
      where: { id, projectId },
    });
    if (!sub) return { success: false, error: 'Subscription not found' };

    const event: AppEvent = {
      id: `test_${Date.now()}`,
      type: 'version.created',
      projectId,
      payload: { test: true },
      createdAt: new Date(),
    };

    return this.send(sub.url, sub.secret, event);
  }

  private async deliver(event: AppEvent) {
    const subs = await prisma.webhookSubscription.findMany({
      where: {
        projectId: event.projectId,
        active: true,
        events: { has: event.type },
      },
    });

    // Deliver in parallel; per-subscription retries shouldn't block other subs.
    await Promise.all(
      subs.map(async (sub) => {
        for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
          const result = await this.send(sub.url, sub.secret, event);
          if (result.success) return;
          if (attempt < this.retryDelays.length) {
            // biome-ignore lint/style/noNonNullAssertion: safe — guarded by length check
            await sleep(this.retryDelays[attempt]!);
          }
        }
      }),
    );
  }

  private async send(
    url: string,
    secret: string,
    event: AppEvent,
  ): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
      await assertPublicUrl(url);
    } catch (err) {
      logger.warn({ err: (err as Error).message, url }, 'webhook destination rejected');
      return { success: false, error: (err as Error).message };
    }

    try {
      const payload = JSON.stringify(event);
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Event-Id': event.id,
          'X-Event-Type': event.type,
        },
        body: payload,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      if (res.ok) {
        return { success: true, status: res.status };
      }
      return { success: false, status: res.status };
    } catch (err) {
      logger.warn({ err, url, eventId: event.id }, 'webhook delivery failed');
      return { success: false, error: (err as Error).message };
    }
  }
}

export const webhookService = new WebhookService();

export const __test__ = { assertPublicUrl, isPrivateAddress };
