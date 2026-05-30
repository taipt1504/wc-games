import IORedis from 'ioredis';

// Kết nối Redis dùng chung cho BullMQ (queue + worker).
// maxRetriesPerRequest: null là BẮT BUỘC cho BullMQ Worker.
export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
