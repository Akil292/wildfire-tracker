import { randomUUID } from "node:crypto";

import {
  GENERIC_CREDENTIALS_ERROR,
  GENERIC_SIGN_UP_ERROR,
  SESSION_DURATION_MS,
} from "./constants";
import { hashPassword, verifyPassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./token";
import type { AuthRepository, SessionWithUser } from "./types";
import { signInSchema, signUpSchema } from "./validation";

type FieldErrors = Record<string, string[]>;

export type AuthenticationResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

let dummyPasswordHash: Promise<string> | undefined;

function validationFailure(fieldErrors: FieldErrors): AuthenticationResult {
  return { ok: false, message: "Check the highlighted fields.", fieldErrors };
}

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword(
    "not-a-real-password-used-for-timing-only",
  );
  return dummyPasswordHash;
}

async function createSession(userId: string, repository: AuthRepository) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const token = generateSessionToken();

  await repository.deleteExpiredSessions(now);
  await repository.createSession({
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function signUp(
  input: unknown,
  repository: AuthRepository,
): Promise<AuthenticationResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const existingUser = await repository.findUserByEmail(parsed.data.email);
  if (existingUser) {
    return { ok: false, message: GENERIC_SIGN_UP_ERROR };
  }

  try {
    const user = await repository.createUser({
      id: randomUUID(),
      email: parsed.data.email,
      passwordHash,
    });
    return { ok: true, ...(await createSession(user.id, repository)) };
  } catch {
    // A unique-index race must not disclose whether the address is registered.
    return { ok: false, message: GENERIC_SIGN_UP_ERROR };
  }
}

export async function signIn(
  input: unknown,
  repository: AuthRepository,
): Promise<AuthenticationResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error.flatten().fieldErrors);
  }

  const user = await repository.findUserByEmail(parsed.data.email);
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(
    passwordHash,
    parsed.data.password,
  );

  if (!user || !passwordMatches) {
    return { ok: false, message: GENERIC_CREDENTIALS_ERROR };
  }

  return { ok: true, ...(await createSession(user.id, repository)) };
}

export async function getSessionUser(
  token: string | undefined,
  repository: AuthRepository,
): Promise<SessionWithUser["user"] | undefined> {
  if (!token) {
    return undefined;
  }

  const tokenHash = hashSessionToken(token);
  const session = await repository.findSessionWithUser(tokenHash);
  if (!session) {
    return undefined;
  }

  if (session.expiresAt <= new Date()) {
    await repository.deleteSession(tokenHash);
    return undefined;
  }

  return session.user;
}

export async function signOut(
  token: string | undefined,
  repository: AuthRepository,
): Promise<void> {
  if (token) {
    await repository.deleteSession(hashSessionToken(token));
  }
}
