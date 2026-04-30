import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { NotFoundError } from '../../errors.js';
import { errorHandler } from '../error-handler.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('errorHandler', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.onError(errorHandler);
  });

  it('should return 400 with validation details for ZodError', async () => {
    app.get('/zod', () => {
      throw new ZodError([
        {
          code: 'invalid_type' as const,
          path: ['name'],
          message: 'Required',
          expected: 'string',
          received: 'undefined',
        },
        {
          code: 'invalid_string' as const,
          path: ['email'],
          message: 'Invalid email',
          validation: 'email',
        },
      ]);
    });

    const res = await app.request('/zod');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.fields).toEqual({
      name: ['Required'],
      email: ['Invalid email'],
    });
  });

  it('should return correct status and code for AppError (NotFoundError)', async () => {
    app.get('/notfound', () => {
      throw new NotFoundError('Prompt', '123');
    });

    const res = await app.request('/notfound');
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('Prompt with id 123 not found');
  });

  it('should return 500 with INTERNAL_ERROR for unknown errors', async () => {
    app.get('/unknown', () => {
      throw new Error('Something broke');
    });

    const res = await app.request('/unknown');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal server error');
  });
});
