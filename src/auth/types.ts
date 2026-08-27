export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type SessionWithUser = Pick<SessionRecord, "id" | "expiresAt"> & {
  user: Pick<AuthUser, "id" | "email" | "createdAt">;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | undefined>;
  createUser(
    input: Pick<AuthUser, "id" | "email" | "passwordHash">,
  ): Promise<AuthUser>;
  createSession(session: SessionRecord): Promise<void>;
  findSessionWithUser(tokenHash: string): Promise<SessionWithUser | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
}
