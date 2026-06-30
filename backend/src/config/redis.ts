import Redis from 'ioredis';
import { env } from './env';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully.');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

export default redis;
export const createRedisConnection = () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
