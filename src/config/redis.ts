import { createClient } from "redis";
import config from "./config";

const redisClient = createClient({
  socket: {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
  },
  password: config.REDIS_PASSWORD,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

export default redisClient;
