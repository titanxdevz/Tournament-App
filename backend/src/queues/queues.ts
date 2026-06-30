import { Queue } from 'bullmq';
import redis, { createRedisConnection } from '../config/redis';

export const notificationsQueue = new Queue('notifications-queue', {
  connection: createRedisConnection() as any,
});

export const matchRoomsQueue = new Queue('match-rooms-queue', {
  connection: createRedisConnection() as any,
});

export const prizesQueue = new Queue('prizes-queue', {
  connection: createRedisConnection() as any,
});

export const ocrQueue = new Queue('ocr-queue', {
  connection: createRedisConnection() as any,
});
