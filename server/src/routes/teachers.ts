import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { teacherCreateSchema, teacherUpdateSchema } from "../schemas.js";

export const teachersRoutes = new Hono();

/**
 * GET /api/teachers — lista todos los docentes (orden descendente por creación)
 */
teachersRoutes.get("/", async (c) => {
  const teachers = await prisma.teacher.findMany({
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: teachers });
});

/**
 * GET /api/teachers/:id
 */
teachersRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) {
    return c.json({ error: "Docente no encontrado" }, 404);
  }
  return c.json({ data: teacher });
});

/**
 * POST /api/teachers — crea un perfil de docente
 */
teachersRoutes.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido en el body" }, 400);
  }

  const parsed = teacherCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const teacher = await prisma.teacher.create({ data: parsed.data });
    return c.json({ data: teacher }, 201);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return c.json({ error: "Ese correo ya está registrado" }, 409);
    }
    console.error("[POST /api/teachers] error:", err);
    return c.json({ error: "Error interno al crear el docente" }, 500);
  }
});

/**
 * PATCH /api/teachers/:id
 */
teachersRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido en el body" }, 400);
  }

  const parsed = teacherUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const teacher = await prisma.teacher.update({
      where: { id },
      data: parsed.data,
    });
    return c.json({ data: teacher });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return c.json({ error: "Docente no encontrado" }, 404);
      }
      if (err.code === "P2002") {
        return c.json({ error: "Ese correo ya está registrado" }, 409);
      }
    }
    console.error("[PATCH /api/teachers/:id] error:", err);
    return c.json({ error: "Error interno al actualizar el docente" }, 500);
  }
});

/**
 * DELETE /api/teachers/:id
 */
teachersRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await prisma.teacher.delete({ where: { id } });
    return c.json({ data: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return c.json({ error: "Docente no encontrado" }, 404);
    }
    console.error("[DELETE /api/teachers/:id] error:", err);
    return c.json({ error: "Error interno al eliminar el docente" }, 500);
  }
});
