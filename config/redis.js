import { createClient } from "redis"
import dotenv from "dotenv"
dotenv.config({ path: './config/.env' });


export const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on("error", function(err) {
  throw err;
});
await redis.connect()
await redis.set('foo','bar');

// await redis.disconnect();
