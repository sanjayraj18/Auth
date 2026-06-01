import cookieParser from "cookie-parser";
import express from "express";
import morgan from "morgan";
import connectDb from "./db";
import authRouter from "./routes/auth.routes";

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

connectDb();

app.use("/api/auth", authRouter);

app.listen(3000, (res) => console.log("server started"));
