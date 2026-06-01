import mongoose from "mongoose";
import config from "../config/config.js";

async function connectDb() {
  if (!config.MONGO_URI) {
    return;
  }
  await mongoose.connect(config.MONGO_URI);
  console.log("connected to DB");
}
export default connectDb;
