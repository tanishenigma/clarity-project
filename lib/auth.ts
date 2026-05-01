"use server";

import {
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Types } from "mongoose";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import UserModel from "./models/User";
import type { User } from "./types";

const JWT_COOKIE_NAME = "ai_tutor_jwt";
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const JWT_ISSUER = "ai-tutor";
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha512";

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
}

const base64UrlEncode = (input: string | Buffer): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlDecode = (input: string): Buffer => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
};

const getJwtSecret = (): Buffer => {
  const secret = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in environment variables");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  return Buffer.from(secret, "utf8");
};

const signJwt = (payload: JwtPayload): string => {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getJwtSecret())
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
};

const verifyJwt = (token: string): JwtPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", getJwtSecret())
    .update(signingInput)
    .digest();

  let providedSignature: Buffer;
  try {
    providedSignature = base64UrlDecode(encodedSignature);
  } catch {
    return null;
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as JwtPayload;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.iss !== JWT_ISSUER
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const hashLegacyPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "ai_tutor_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const verifyPasswordHash = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 5) {
      return false;
    }

    const [scheme, digest, iterationsRaw, saltEncoded, derivedEncoded] = parts;
    if (scheme !== "pbkdf2") {
      return false;
    }

    const iterations = Number.parseInt(iterationsRaw, 10);
    if (!Number.isFinite(iterations) || iterations <= 0) {
      return false;
    }

    try {
      const salt = base64UrlDecode(saltEncoded);
      const expected = base64UrlDecode(derivedEncoded);
      const actual = pbkdf2Sync(
        password,
        salt,
        iterations,
        expected.length,
        digest,
      );
      return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
      );
    } catch {
      return false;
    }
  }

  const legacyInputHash = await hashLegacyPassword(password);
  const storedBuffer = Buffer.from(storedHash, "utf8");
  const inputBuffer = Buffer.from(legacyInputHash, "utf8");

  return (
    storedBuffer.length === inputBuffer.length &&
    timingSafeEqual(storedBuffer, inputBuffer)
  );
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  );

  return [
    "pbkdf2",
    PBKDF2_DIGEST,
    PBKDF2_ITERATIONS.toString(),
    base64UrlEncode(salt),
    base64UrlEncode(derived),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return verifyPasswordHash(password, hash);
}

export async function createUser(
  email: string,
  username: string,
  password: string,
): Promise<User> {
  await connectDB();

  // Check if user exists
  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    throw new Error("User already exists");
  }

  const passwordHash = await hashPassword(password);

  const user = await UserModel.create({
    email,
    username,
    passwordHash,
    authProvider: "email",
    theme: "dark",
    subscriptionTier: "free",
    studyStreak: 0,
    totalStudyMinutes: 0,
  });

  return user.toObject() as unknown as User;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<User> {
  await connectDB();

  const user = await UserModel.findOne({ email }).lean();
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  if (!user.passwordHash.startsWith("pbkdf2$")) {
    const upgradedHash = await hashPassword(password);
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash: upgradedHash } },
    ).catch(() => {});
  }

  return user as unknown as User;
}

export async function createAuthJwt(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: userId,
    iat: now,
    exp: now + JWT_TTL_SECONDS,
    iss: JWT_ISSUER,
  };

  return signJwt(payload);
}

export async function getAuthJwt(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const payload = verifyJwt(token);
    if (!payload) return null;
    if (!Types.ObjectId.isValid(payload.sub)) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const jwtData = await getAuthJwt();
  if (!jwtData) return null;

  await connectDB();
  const user = await UserModel.findById(
    new Types.ObjectId(jwtData.userId),
  ).lean();

  return user as unknown as User | null;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(JWT_COOKIE_NAME);
}

export async function setJwtCookie(jwtToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(JWT_COOKIE_NAME, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: JWT_TTL_SECONDS,
    path: "/",
  });
}
