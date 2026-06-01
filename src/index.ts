import cookieParser from "cookie-parser";
import express from "express";
import morgan from "morgan";
import connectDb from "./db";
import connectRedis from "./db/redis";
import authRouter from "./routes/auth.routes";

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

const startServer = async () => {
  try {
    await connectDb();
    await connectRedis();
    console.log("server started");
  } catch (err) {
    console.log("Error in the connection", err);
  }
};

app.use("/api/auth", authRouter);

startServer();
