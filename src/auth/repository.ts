import { eq, lt } from "drizzle-orm";

import { getDatabase } from "@/db";
import { sessions, users } from "@/db/schema";

import type { AuthRepository, SessionWithUser } from "./types";

export const drizzleAuthRepository: AuthRepository = {
  async findUserByEmail(email) {
    const [user] = await getDatabase()
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  },

  async createUser(input) {
    const [user] = await getDatabase().insert(users).values(input).returning();
    if (!user) {
      throw new Error("User creation did not return a record.");
    }
    return user;
  },

  async createSession(session) {
    await getDatabase().insert(sessions).values(session);
  },

  async findSessionWithUser(tokenHash) {
    const [result] = await getDatabase()
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        userId: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    if (!result) {
      return undefined;
    }

    return {
      id: result.sessionId,
      expiresAt: result.expiresAt,
      user: {
        id: result.userId,
        email: result.email,
        createdAt: result.createdAt,
      },
    } satisfies SessionWithUser;
  },

  async deleteSession(tokenHash) {
    await getDatabase()
      .delete(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
  },

  async deleteExpiredSessions(now) {
    await getDatabase().delete(sessions).where(lt(sessions.expiresAt, now));
  },
};
