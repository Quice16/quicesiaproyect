import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  quizCreateSchema,
  studentAttemptSchema,
  type QuizQuestion,
} from "../schemas.js";

const slugAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const generateSlug = customAlphabet(slugAlphabet, 10);

/**
 * Quita la solución y la explicación de las preguntas para que el estudiante
 * no pueda inspeccionarlas en el bundle/XHR antes de responder.
 */
function questionsForStudent(qs: QuizQuestion[]) {
  return qs.map((q, i) => ({
    index: i,
    question: q.question,
    options: q.options,
  }));
}

function isExpired(expiresAt: Date | string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

// ============= Privadas (autenticadas) =============

export const quizzesRoutes = new Hono();
quizzesRoutes.use("*", requireAuth);

quizzesRoutes.get("/", async (c) => {
  const teacher = c.get("teacher" as never) as { id: string };
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      questions: true,
    },
  });
  // No mandamos el detalle completo del array, solo la cantidad.
  const summary = quizzes.map((q) => ({
    id: q.id,
    slug: q.slug,
    title: q.title,
    difficulty: q.difficulty,
    expiresAt: q.expiresAt,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    numQuestions: Array.isArray(q.questions) ? q.questions.length : 0,
    expired: isExpired(q.expiresAt),
  }));
  return c.json({ data: summary });
});

quizzesRoutes.post("/", async (c) => {
  const teacher = c.get("teacher" as never) as { id: string };

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido en el body" }, 400);
  }

  const parsed = quizCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      400
    );
  }

  // Reintenta si por azar genera un slug colisionado (extremadamente raro)
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      const quiz = await prisma.quiz.create({
        data: {
          slug,
          title: parsed.data.title,
          difficulty: parsed.data.difficulty,
          questions: parsed.data.questions as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(parsed.data.expiresAt),
          teacherId: teacher.id,
        },
      });
      return c.json({ data: quiz }, 201);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue; // slug colisión, reintenta
      }
      console.error("[POST /quizzes]", err);
      return c.json({ error: "Error al crear el quiz" }, 500);
    }
  }
  return c.json({ error: "No se pudo generar un slug único" }, 500);
});

quizzesRoutes.get("/:id", async (c) => {
  const teacher = c.get("teacher" as never) as { id: string };
  const id = c.req.param("id");
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!quiz || quiz.teacherId !== teacher.id) {
    return c.json({ error: "Quiz no encontrado" }, 404);
  }
  return c.json({
    data: {
      ...quiz,
      expired: isExpired(quiz.expiresAt),
      numAttempts: quiz._count.attempts,
    },
  });
});

/**
 * GET /api/quizzes/:id/attempts — lista de estudiantes que respondieron.
 */
quizzesRoutes.get("/:id/attempts", async (c) => {
  const teacher = c.get("teacher" as never) as { id: string };
  const id = c.req.param("id");
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz || quiz.teacherId !== teacher.id) {
    return c.json({ error: "Quiz no encontrado" }, 404);
  }
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: id },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      studentName: true,
      correct: true,
      total: true,
      completedAt: true,
    },
  });
  return c.json({ data: attempts });
});

quizzesRoutes.delete("/:id", async (c) => {
  const teacher = c.get("teacher" as never) as { id: string };
  const id = c.req.param("id");
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz || quiz.teacherId !== teacher.id) {
    return c.json({ error: "Quiz no encontrado" }, 404);
  }
  await prisma.quiz.delete({ where: { id } });
  return c.json({ data: { id } });
});

// ============= Públicas (estudiante, sin auth) =============

export const publicQuizzesRoutes = new Hono();

publicQuizzesRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      questions: true,
      expiresAt: true,
      teacher: { select: { nombre: true, programa: true, materia: true } },
    },
  });
  if (!quiz) {
    return c.json({ error: "Quiz no encontrado" }, 404);
  }
  if (isExpired(quiz.expiresAt)) {
    return c.json(
      {
        error: "Este quiz ya venció",
        expiresAt: quiz.expiresAt,
      },
      410 // Gone
    );
  }

  return c.json({
    data: {
      slug: quiz.slug,
      title: quiz.title,
      difficulty: quiz.difficulty,
      expiresAt: quiz.expiresAt,
      teacher: quiz.teacher,
      questions: questionsForStudent(quiz.questions as QuizQuestion[]),
    },
  });
});

publicQuizzesRoutes.post("/:slug/submit", async (c) => {
  const slug = c.req.param("slug");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido en el body" }, 400);
  }

  const parsed = studentAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      400
    );
  }

  const quiz = await prisma.quiz.findUnique({ where: { slug } });
  if (!quiz) return c.json({ error: "Quiz no encontrado" }, 404);
  if (isExpired(quiz.expiresAt)) {
    return c.json({ error: "Este quiz ya venció" }, 410);
  }

  const questions = quiz.questions as QuizQuestion[];
  let correct = 0;
  const results = questions.map((q, i) => {
    const answered = parsed.data.answers.find((a) => a.questionIndex === i);
    const selected = answered?.selectedLabel ?? null;
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) correct++;
    return {
      questionIndex: i,
      selectedLabel: selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
    };
  });

  // Persistir intento para que el docente vea quién respondió
  try {
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentName: parsed.data.studentName ?? null,
        answers: parsed.data.answers as unknown as Prisma.InputJsonValue,
        correct,
        total: questions.length,
      },
    });
  } catch (err) {
    // No fallar el submit si falla la persistencia del intento.
    console.error("[POST /public/:slug/submit] no se persistió attempt:", err);
  }

  return c.json({
    data: {
      total: questions.length,
      correct,
      score: questions.length > 0 ? correct / questions.length : 0,
      results,
    },
  });
});
