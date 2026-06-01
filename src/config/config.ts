import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("no secret exisit");
}
if (!process.env.REDIS_HOST) {
  throw new Error("no secret exisit");
}
if (!process.env.REDIS_PORT) {
  throw new Error("no secret exisit");
}
if (!process.env.REDIS_PASSWORD) {
  throw new Error("no secret exisit");
}

const config = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: Number(process.env.REDIS_PORT),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
};

export default config;
