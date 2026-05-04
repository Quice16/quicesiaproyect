import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import {
  hashPassword,
  requireAuth,
  signTeacherToken,
  verifyPassword,
} from "../auth.js";
import { loginSchema, registerSchema } from "../schemas.js";

export const authRoutes = new Hono();

/**
 * Devuelve un teacher al cliente sin el passwordHash y con shape estable.
 */
function publicTeacher(t: {
  id: string;
  nombre: string;
  email: string;
  programa: string | null;
  materia: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  return {
    id: t.id,
    nombre: t.nombre,
    email: t.email,
    programa: t.programa,
    materia: t.materia,
    bio: t.bio,
    avatarUrl: t.avatarUrl,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/**
 * POST /api/auth/register — crea un docente con contraseña y devuelve token.
 */
authRoutes.post("/register", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido en el body" }, 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      400
    );
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const teacher = await prisma.teacher.create({
      data: {
        nombre: rest.nombre,
        email: rest.email,
        programa: rest.programa,
        materia: rest.materia,
        passwordHash,
      },
    });
    const token = await signTeacherToken({
      id: teacher.id,
      email: teacher.email,
    });
    return c.json({ data: { token, teacher: publicTeacher(teacher) } }, 201);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return c.json({ error: "Ese correo ya está registrado" }, 409);
    }
    console.error("[POST /auth/register]", err);
    return c.json({ error: "Error interno al registrar" }, 500);
  }
});

/**
 * POST /api/auth/login — verifica password, devuelve token.
 */
authRoutes.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido en el body" }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos inválidos" }, 400);
  }

  const teacher = await prisma.teacher.findUnique({
    where: { email: parsed.data.email },
  });
  // Mensaje genérico en ambos casos para no filtrar si el email existe
  if (!teacher) {
    return c.json({ error: "Email o contraseña incorrectos" }, 401);
  }
  const ok = await verifyPassword(parsed.data.password, teacher.passwordHash);
  if (!ok) {
    return c.json({ error: "Email o contraseña incorrectos" }, 401);
  }

  const token = await signTeacherToken({
    id: teacher.id,
    email: teacher.email,
  });
  return c.json({ data: { token, teacher: publicTeacher(teacher) } });
});

/**
 * GET /api/auth/me — devuelve el teacher autenticado.
 */
authRoutes.get("/me", requireAuth, async (c) => {
  const teacher = c.get("teacher" as never) as ReturnType<
    typeof publicTeacher
  >;
  return c.json({ data: teacher });
});
