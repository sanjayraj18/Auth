import { error } from "console";
import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config";
import sessionModel from "../models/session.schema";
import userModel from "../models/user.schema";
import { TokenService } from "../services/tokenService";

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

  //redis inclusion to store the session
  await TokenService.storeSession(
    session._id.toString(),
    user._id.toString(),
    req.ip || "unknown",
    req.header("user-agent") || "unknow",
  );

  //redis to store the refreshToken
  await TokenService.storeRefreshToken(
    refreshTokenHash,
    user._id.toString(),
    session._id.toString(),
  );

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

  //redis to store the session
  await TokenService.storeSession(
    session._id.toString(),
    userId.toString(),
    req.ip || "unknown",
    req.header("user-agent") || "unknown",
  );

  //redis to store the refreshTokenHash
  await TokenService.storeRefreshToken(
    refreshTokenHash,
    userId.toString(),
    session._id.toString(),
  );

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

  //search the refreshToken in redis
  const tokenData = await TokenService.getRefreshToken(refreshTokenHash);
  if (!tokenData) {
    return res.status(401).json({
      message: "token expired or invalid",
      code: "TOKEN_INVALID",
    });
  }

  const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as TokenPayload;

  // redis to get the current session
  const session = await TokenService.getSession(tokenData.sessionId);
  if (!session) {
    return res.status(401).json({
      message: "session not found",
    });
  }

  const newaccessToken = jwt.sign(
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

  // Update in MongoDB for audit trail
  const sessionDoc = await sessionModel.findById(tokenData.sessionId);
  if (sessionDoc) {
    sessionDoc.refreshToken = newrefreshTokenHash;
    await sessionDoc.save();
  }

  // Update in Redis with new token - NEW
  await TokenService.revokeRefreshToken(refreshTokenHash);
  await TokenService.storeRefreshToken(
    newrefreshTokenHash,
    decoded.id,
    tokenData.sessionId,
  );

  res.cookie("refreshToken", newrefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    message: "AccessToken refreshed successfully",
    newaccessToken,
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

  // Get token data from Redis
  const tokenData = await TokenService.getRefreshToken(refreshTokenHash);
  if (!tokenData) {
    return res.status(400).json({
      message: "session not found",
    });
  }

  // Delete from Redis immediately - NEW (instant logout)
  await TokenService.revokeRefreshToken(refreshTokenHash);
  await TokenService.revokeSession(tokenData.sessionId);

  const session = await sessionModel.findById(tokenData.sessionId);
  if (session) {
    session.revoked = true;
    await session.save();
  }

  res.clearCookie("refreshToken");

  res.status(200).json({
    message: "logout successful",
  });
});

export default authRouter;
