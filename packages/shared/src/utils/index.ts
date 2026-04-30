import crypto from 'node:crypto';

export function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Hash an API key for storage/lookup. Uses HMAC-SHA-256 with API_KEY_PEPPER
 * when set; falls back to plain SHA-256 only for development. Production
 * deployments must set API_KEY_PEPPER (see deployments/helm and .env.example).
 */
export function hashApiKey(key: string, pepper?: string): string {
  const p = pepper ?? process.env.API_KEY_PEPPER;
  if (p) {
    return crypto.createHmac('sha256', p).update(key).digest('hex');
  }
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(pepper?: string): { key: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const key = `pvc_${raw}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key, pepper);
  return { key, prefix, hash };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
