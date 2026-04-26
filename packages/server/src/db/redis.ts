import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        logger.warn({ err: err.message }, 'redis reconnect');
        return true;
      },
    })
  : null;

if (redis) {
  redis.on('error', (err) => {
    logger.error({ err: err.message }, 'redis error');
  });
}
