import { beforeEach, describe, expect, it } from "vitest";

import {
  GENERIC_CREDENTIALS_ERROR,
  GENERIC_SIGN_UP_ERROR,
} from "@/auth/constants";
import { hashPassword } from "@/auth/password";
import { getSessionUser, signIn, signOut, signUp } from "@/auth/service";
import { hashSessionToken } from "@/auth/token";
import type {
  AuthRepository,
  AuthUser,
  SessionRecord,
  SessionWithUser,
} from "@/auth/types";

process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";

class MemoryAuthRepository implements AuthRepository {
  users: AuthUser[] = [];
  sessions: SessionRecord[] = [];

  async findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email);
  }

  async createUser(input: Pick<AuthUser, "id" | "email" | "passwordHash">) {
    if (this.users.some((user) => user.email === input.email)) {
      throw new Error("duplicate email");
    }

    const user = { ...input, createdAt: new Date() };
    this.users.push(user);
    return user;
  }

  async createSession(session: SessionRecord) {
    this.sessions.push(session);
  }

  async findSessionWithUser(
    tokenHash: string,
  ): Promise<SessionWithUser | undefined> {
    const session = this.sessions.find(
      (candidate) => candidate.tokenHash === tokenHash,
    );
    const user =
      session &&
      this.users.find((candidate) => candidate.id === session.userId);
    if (!session || !user) {
      return undefined;
    }

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    };
  }

  async deleteSession(tokenHash: string) {
    this.sessions = this.sessions.filter(
      (session) => session.tokenHash !== tokenHash,
    );
  }

  async deleteExpiredSessions(now: Date) {
    this.sessions = this.sessions.filter((session) => session.expiresAt >= now);
  }
}

describe("authentication service", () => {
  let repository: MemoryAuthRepository;

  beforeEach(() => {
    repository = new MemoryAuthRepository();
  });

  it("creates a normalized user and database-backed session", async () => {
    const result = await signUp(
      {
        email: " PERSON@example.com ",
        password: "correct horse battery staple",
        passwordConfirmation: "correct horse battery staple",
      },
      repository,
    );

    expect(result.ok).toBe(true);
    expect(repository.users).toHaveLength(1);
    expect(repository.users[0]?.email).toBe("person@example.com");
    expect(repository.users[0]?.passwordHash).not.toContain("correct horse");
    expect(repository.sessions).toHaveLength(1);
    expect(repository.sessions[0]?.tokenHash).not.toBe(
      result.ok ? result.token : undefined,
    );
  });

  it("uses a generic response for duplicate email addresses", async () => {
    const input = {
      email: "person@example.com",
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
    };

    await signUp(input, repository);
    const result = await signUp(input, repository);

    expect(result).toEqual({ ok: false, message: GENERIC_SIGN_UP_ERROR });
  });

  it("rejects invalid credentials without revealing account state", async () => {
    await signUp(
      {
        email: "person@example.com",
        password: "correct horse battery staple",
        passwordConfirmation: "correct horse battery staple",
      },
      repository,
    );

    const wrongPassword = await signIn(
      { email: "person@example.com", password: "wrong password" },
      repository,
    );
    const unknownEmail = await signIn(
      { email: "unknown@example.com", password: "wrong password" },
      repository,
    );

    expect(wrongPassword).toEqual({
      ok: false,
      message: GENERIC_CREDENTIALS_ERROR,
    });
    expect(unknownEmail).toEqual({
      ok: false,
      message: GENERIC_CREDENTIALS_ERROR,
    });
  });

  it("looks up, expires, and invalidates sessions", async () => {
    const signUpResult = await signUp(
      {
        email: "person@example.com",
        password: "correct horse battery staple",
        passwordConfirmation: "correct horse battery staple",
      },
      repository,
    );
    if (!signUpResult.ok) {
      throw new Error("Expected sign-up to succeed.");
    }

    await expect(
      getSessionUser(signUpResult.token, repository),
    ).resolves.toMatchObject({
      email: "person@example.com",
    });
    expect(hashSessionToken(signUpResult.token)).toBe(
      repository.sessions[0]?.tokenHash,
    );

    repository.sessions[0]!.expiresAt = new Date(Date.now() - 1);
    await expect(
      getSessionUser(signUpResult.token, repository),
    ).resolves.toBeUndefined();
    expect(repository.sessions).toHaveLength(0);

    const secondSignIn = await signIn(
      { email: "person@example.com", password: "correct horse battery staple" },
      repository,
    );
    if (!secondSignIn.ok) {
      throw new Error("Expected sign-in to succeed.");
    }
    await signOut(secondSignIn.token, repository);
    await expect(
      getSessionUser(secondSignIn.token, repository),
    ).resolves.toBeUndefined();
  });

  it("does not store plaintext passwords", async () => {
    const password = "correct horse battery staple";
    await signUp(
      { email: "person@example.com", password, passwordConfirmation: password },
      repository,
    );

    expect(repository.users[0]?.passwordHash).not.toBe(password);
    await expect(hashPassword(password)).resolves.not.toBe(
      repository.users[0]?.passwordHash,
    );
  });
});
