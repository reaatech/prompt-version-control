import { describe, it, expect } from 'vitest';
import { calculateChecksum, generateApiKey, hashApiKey, sleep } from './index.js';

describe('utils', () => {
  describe('calculateChecksum', () => {
    it('should return a sha256 hex string', () => {
      const hash = calculateChecksum('hello');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic', () => {
      const h1 = calculateChecksum('same');
      const h2 = calculateChecksum('same');
      expect(h1).toBe(h2);
    });
  });

  describe('hashApiKey', () => {
    it('falls back to sha256 with no pepper', () => {
      const a = hashApiKey('pvc_test');
      const b = hashApiKey('pvc_test');
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{64}$/);
    });

    it('uses HMAC when pepper is supplied', () => {
      const plain = hashApiKey('pvc_test');
      const peppered = hashApiKey('pvc_test', 'pepper-value');
      expect(peppered).not.toBe(plain);
      expect(peppered).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateApiKey', () => {
    it('should generate key, prefix, and hash', () => {
      const { key, prefix, hash } = generateApiKey();
      expect(key).toMatch(/^pvc_/);
      expect(prefix).toBe(key.slice(0, 12));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes when pepper supplied', () => {
      const a = generateApiKey();
      const b = generateApiKey('pepper');
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(50);
      expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    });
  });
});
