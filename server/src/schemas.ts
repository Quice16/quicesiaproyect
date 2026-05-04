import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

// ============= Auth =============

export const registerSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  password: z.string().min(8).max(200),
  programa: optionalString(120),
  materia: optionalString(120),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  programa: optionalString(120),
  materia: optionalString(120),
  bio: optionalString(1000),
  avatarUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

// ============= Quizzes =============

export const quizOptionSchema = z.object({
  label: z.string().min(1).max(4),
  text: z.string().min(1).max(500),
});

export const quizQuestionSchema = z.object({
  question: z.string().min(3).max(2000),
  options: z.array(quizOptionSchema).min(2).max(8),
  correctAnswer: z.string().min(1).max(4),
  explanation: z.string().max(2000).optional().default(""),
});

export const quizCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  questions: z.array(quizQuestionSchema).min(1).max(50),
  // ISO8601 string. We refine that it's in the future.
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .refine(
      (v) => new Date(v).getTime() > Date.now(),
      "La fecha de vencimiento debe ser futura"
    ),
});

export const studentAttemptSchema = z.object({
  studentName: z.string().trim().min(1).max(120).optional(),
  answers: z
    .array(
      z.object({
        questionIndex: z.number().int().min(0),
        selectedLabel: z.string().min(1).max(4),
      })
    )
    .min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type QuizCreateInput = z.infer<typeof quizCreateSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type StudentAttemptInput = z.infer<typeof studentAttemptSchema>;
