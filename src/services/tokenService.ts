import redisClient from "../config/redis";

const TOKEN_PREFIXES = {
  SESSION: "session:",
  REFRESH_TOKEN: "token:refresh:",
  PASSWORD_RESET: "token:reset:",
  LOGIN_ATTEMPTS: "login:attempts:",
};
export class TokenService {
  static async storeSession(
    sessionId: string,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const key = TOKEN_PREFIXES.SESSION + sessionId;
    const value = JSON.stringify({ userId, ip, userAgent, revoked: false });

    await redisClient.set(key, value, {
      EX: 7 * 24 * 60 * 60,
    });
  }

  static async getSession(sessionId: string) {
    const key = TOKEN_PREFIXES.SESSION + sessionId;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  static async storeRefreshToken(
    refreshTokenhash: string,
    userId: string,
    sessionId: string,
  ) {
    const key = TOKEN_PREFIXES.REFRESH_TOKEN + refreshTokenhash;
    const value = JSON.stringify({
      userId,
      sessionId,
      revoked: false,
      createdAt: new Date().toISOString(),
    });

    await redisClient.set(key, value, { EX: 7 * 24 * 60 * 60 });
  }

  static async getRefreshToken(refreshTokenHash: string) {
    const key = TOKEN_PREFIXES.REFRESH_TOKEN + refreshTokenHash;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  static async revokeRefreshToken(refreshTokenHash: string) {
    const key = TOKEN_PREFIXES.REFRESH_TOKEN + refreshTokenHash;
    await redisClient.del(key);
  }

  static async revokeSession(sessionId: string) {
    const key = TOKEN_PREFIXES.SESSION + sessionId;
    await redisClient.del(key);
  }
}
