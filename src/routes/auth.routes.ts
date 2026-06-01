import { error } from "console";
import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config";
import sessionModel from "../models/session.schema";
import userModel from "../models/user.schema";

interface TokenPayload {
  id: string;
}

const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { userName, email, password } = req.body;

  const isAlreadyExists = await userModel.findOne({
    $or: [{ userName }, { email }],
  });

  if (isAlreadyExists) {
    res.status(409).json({
      message: "user already exist",
    });
  }

  const hashedPassowrd = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const user = await userModel.create({
    userName,
    email,
    password: hashedPassowrd,
  });

  const refreshToken = jwt.sign(
    {
      id: user._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.create({
    user: user._id,
    refreshToken: refreshTokenHash,
    ip: req.ip,
    userAgent: req.header("user-agent"),
  });

  const accessToken = jwt.sign(
    {
      id: user._id,
      sessionId: session._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    message: "User created successfully",
    user: {
      userName: userName,
      email: email,
    },
    accessToken,
  });
});

authRouter.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  const isUserExists = await userModel.findOne({
    email,
  });
  if (!isUserExists) {
    return res.status(400).json({
      message: "User not found please signup",
    });
  }

  const hashedPassowrd = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
  if (isUserExists?.password != hashedPassowrd) {
    return res.status(401).json({
      message: "email and password are incorrect",
    });
  }

  const userId = isUserExists._id;

  const refreshToken = jwt.sign(
    {
      id: userId,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const session = await sessionModel.create({
    user: userId,
    refreshToken: refreshTokenHash,
    ip: req.ip,
    userAgent: req.header("user-agent"),
  });

  const accessToken = jwt.sign(
    {
      id: userId,
      sessionId: session._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    message: "Login Successful",
    accessToken,
  });
});

authRouter.get("/getme", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({
      message: "token not found",
    });
  }

  const decoded = jwt.verify(token!, config.JWT_SECRET) as TokenPayload;
  const user = await userModel.findById(decoded.id);

  res.status(200).json({
    message: "user fetched succesfully",
    user: {
      userName: user?.userName,
      email: user?.email,
    },
  });
});

authRouter.get("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw error("refreshToken not found");
  }

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.findOne({
    refreshToken: refreshTokenHash,
    revoked: false,
  });
  if (!session) {
    return res.status(401).json({
      message: "user logged out",
    });
  }

  const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as TokenPayload;

  const accessToken = jwt.sign(
    {
      id: decoded.id,
      sessionId: session._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const newrefreshToken = jwt.sign(
    {
      id: decoded.id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const newrefreshTokenHash = crypto
    .createHash("sha256")
    .update(newrefreshToken)
    .digest("hex");

  session.refreshToken = newrefreshTokenHash;
  await session.save();

  res.cookie("refreshToken", newrefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    message: "AccessToken refreshed successfully",
    accessToken,
  });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({
      message: "RefreshToken not found",
    });
  }

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.findOne({
    refreshToken: refreshTokenHash,
    revoked: false,
  });
  if (!session) {
    return res.status(400).json({
      message: "session not found",
    });
  }

  session.revoked = true;
  session.save();

  res.clearCookie("refreshToken");

  res.status(200).json({
    message: "logout successful",
  });
});

export default authRouter;
