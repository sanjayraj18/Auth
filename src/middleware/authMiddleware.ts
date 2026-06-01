import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config";
import { TokenService } from "../services/tokenService";

interface AuthRequest extends Request {
  userId?: string;
  sessionId?: string;
}

export const VerifyAccessToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(409).json({
        message: "Token not found",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    const sessionId = decoded.sessionId;

    const sessionFromRedis = await TokenService.getSession(sessionId);
    if (!sessionFromRedis) {
      return res.status(409).json({
        message: "Session not found",
      });
    }

    if (sessionFromRedis.revoked) {
      return res.status(409).json({
        message: "Session revoked",
      });
    }

    req.userId = decoded?.id;
    req.sessionId = decoded?.sessionId;

    next();
  } catch (err) {
    res.status(401).json({
      message: "Token verification failed from middleware",
    });
  }
};
