import { api } from "./api";
import { z } from "zod";

export interface QuizOption {
  label: string;
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  numQuestions: number;
  expired: boolean;
}

export interface Quiz extends QuizSummary {
  questions: QuizQuestion[];
}

export interface PublicQuestion {
  index: number;
  question: string;
  options: QuizOption[];
}

export interface PublicQuiz {
  slug: string;
  title: string;
  difficulty: string;
  expiresAt: string;
  teacher: { nombre: string; programa: string | null; materia: string | null };
  questions: PublicQuestion[];
}

export interface QuizSubmitResult {
  total: number;
  correct: number;
  score: number;
  results: {
    questionIndex: number;
    selectedLabel: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export const quizCreateClientSchema = z.object({
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  difficulty: z.enum(["easy", "medium", "hard"]),
  expiresAt: z
    .string()
    .min(1, "Selecciona la fecha de vencimiento")
    .refine(
      (v) => {
        const t = Date.parse(v);
        return Number.isFinite(t) && t > Date.now();
      },
      "La fecha debe ser futura"
    ),
});

export type QuizCreateInput = z.infer<typeof quizCreateClientSchema> & {
  questions: QuizQuestion[];
};

export async function listMyQuizzes() {
  return (await api.get<{ data: QuizSummary[] }>("/api/quizzes")).data;
}

export async function createQuiz(input: QuizCreateInput) {
  return (
    await api.post<{ data: Quiz }>("/api/quizzes", {
      ...input,
      // datetime-local entrega "YYYY-MM-DDTHH:mm" sin timezone — convertimos a ISO UTC.
      expiresAt: new Date(input.expiresAt).toISOString(),
    })
  ).data;
}

export async function deleteQuiz(id: string) {
  return api.delete<{ data: { id: string } }>(`/api/quizzes/${id}`);
}

export async function getMyQuiz(id: string) {
  return (await api.get<{ data: Quiz }>(`/api/quizzes/${id}`)).data;
}

export async function getPublicQuiz(slug: string) {
  return (await api.get<{ data: PublicQuiz }>(`/api/public/quizzes/${slug}`))
    .data;
}

export async function submitPublicQuiz(
  slug: string,
  input: {
    studentName?: string;
    answers: { questionIndex: number; selectedLabel: string }[];
  }
) {
  return (
    await api.post<{ data: QuizSubmitResult }>(
      `/api/public/quizzes/${slug}/submit`,
      input
    )
  ).data;
}

/**
 * Construye la URL pública para que el docente la copie y la mande a estudiantes.
 */
export function studentUrl(slug: string): string {
  if (typeof window === "undefined") return `/q/${slug}`;
  return `${window.location.origin}/q/${slug}`;
}
