import redisClient from "../config/redis";

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("RedisClient conencted Successfully");
  } catch (err) {
    console.log("RedisClient conenction error", err);
    process.exit(1);
  }
};

export default connectRedis;
