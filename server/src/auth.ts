import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { MiddlewareHandler } from "hono";
import { prisma } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  console.warn(
    "[auth] JWT_SECRET no está definido. Configúralo en Railway antes de producción."
  );
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días
const JWT_ALG = "HS256" as const;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
}

export async function signTeacherToken(teacher: {
  id: string;
  email: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: teacher.id,
    email: teacher.email,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  return sign(payload, JWT_SECRET, JWT_ALG);
}

export async function verifyTeacherToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const payload = (await verify(token, JWT_SECRET, JWT_ALG)) as unknown as TokenPayload;
    if (!payload?.sub || !payload?.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware Hono: extrae JWT del header Authorization y attachea
 * el teacher al context. Si no hay token o es inválido, responde 401.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "No autenticado" }, 401);
  }
  const token = header.slice("Bearer ".length).trim();
  const payload = await verifyTeacherToken(token);
  if (!payload) {
    return c.json({ error: "Token inválido o expirado" }, 401);
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      nombre: true,
      email: true,
      programa: true,
      materia: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!teacher) {
    return c.json({ error: "Cuenta no encontrada" }, 401);
  }

  c.set("teacher", teacher);
  await next();
};

export type AuthedTeacher = {
  id: string;
  nombre: string;
  email: string;
  programa: string | null;
  materia: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};
