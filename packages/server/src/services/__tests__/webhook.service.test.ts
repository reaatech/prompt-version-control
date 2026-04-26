import { describe, it, expect } from 'vitest';
import { __test__ } from '../webhook.service.js';

describe('webhook SSRF guard', () => {
  describe('isPrivateAddress', () => {
    it.each([
      ['127.0.0.1'],
      ['10.0.0.5'],
      ['172.16.0.1'],
      ['172.31.255.255'],
      ['192.168.1.1'],
      ['169.254.169.254'], // AWS metadata
      ['224.0.0.1'],
      ['::1'],
      ['fe80::1'],
      ['fd00::1'],
      ['::ffff:127.0.0.1'],
    ])('rejects %s', (addr) => {
      expect(__test__.isPrivateAddress(addr)).toBe(true);
    });

    it.each([['8.8.8.8'], ['142.250.80.46'], ['2001:4860:4860::8888']])(
      'accepts public %s',
      (addr) => {
        expect(__test__.isPrivateAddress(addr)).toBe(false);
      },
    );
  });

  describe('assertPublicUrl', () => {
    it('rejects non-http schemes', async () => {
      await expect(__test__.assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/http\(s\)/);
      await expect(__test__.assertPublicUrl('ftp://example.com/')).rejects.toThrow(/http\(s\)/);
    });

    it('rejects URLs that resolve to loopback', async () => {
      await expect(__test__.assertPublicUrl('http://127.0.0.1/hook')).rejects.toThrow(/disallowed/);
    });

    it('rejects literal localhost', async () => {
      await expect(__test__.assertPublicUrl('http://localhost:9999/x')).rejects.toThrow(
        /disallowed/,
      );
    });

    it('rejects malformed urls', async () => {
      await expect(__test__.assertPublicUrl('not-a-url')).rejects.toThrow(/invalid/);
    });
  });
});
