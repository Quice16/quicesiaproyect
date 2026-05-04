import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { useAuth } from "@/lib/auth";
import {
  getMyQuiz,
  listAttempts,
  studentUrl,
  type Quiz,
  type QuizAttempt,
} from "@/lib/quizzes";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/quizzes/$id")({
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { id } = Route.useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [q, a] = await Promise.all([getMyQuiz(id), listAttempts(id)]);
      setQuiz(q);
      setAttempts(a);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Este quiz no existe o no es tuyo.");
      } else {
        setError(err instanceof Error ? err.message : "Error al cargar");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const handleCopy = async () => {
    if (!quiz) return;
    const url = studentUrl(quiz.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      window.prompt("Copia el link:", url);
    }
  };

  if (loading) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </Centered>
    );
  }

  if (error || !quiz) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold">No se pudo cargar</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error ?? "Quiz no encontrado"}
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Volver al dashboard
          </Link>
        </div>
      </Centered>
    );
  }

  const url = studentUrl(quiz.slug);
  const finished = attempts.length;
  const avgScore =
    finished > 0
      ? attempts.reduce((sum, a) => sum + a.correct / a.total, 0) / finished
      : 0;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Mis quizzes
            </Link>
            <h1 className="mt-2 font-heading text-3xl font-bold text-primary">
              {quiz.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {quiz.questions.length}{" "}
              {quiz.questions.length === 1 ? "pregunta" : "preguntas"} ·
              dificultad <strong>{labelDifficulty(quiz.difficulty)}</strong> ·
              vence{" "}
              <span
                className={
                  quiz.expired
                    ? "text-destructive font-semibold"
                    : "text-foreground font-semibold"
                }
              >
                {formatDate(quiz.expiresAt)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {refreshing ? "..." : "Refrescar"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Vista previa
            </a>
          </div>
        </header>

        {/* Share + métricas */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Link para estudiantes
            </p>
            <div className="mt-2 flex flex-col sm:flex-row items-stretch gap-2">
              <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs font-mono">
                {url}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Copiar
              </button>
            </div>
            {quiz.expired && (
              <p className="mt-2 text-xs text-destructive">
                ⚠ Este quiz ya venció — el link devuelve 410 y los estudiantes ya no pueden responder.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Han terminado" value={finished} />
            <Stat
              label="Promedio"
              value={
                finished > 0 ? `${(avgScore * 100).toFixed(0)}%` : "—"
              }
            />
          </div>
        </section>

        {/* Lista de estudiantes */}
        <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Respuestas de estudiantes</h2>
            <span className="text-xs text-muted-foreground">
              {finished} {finished === 1 ? "intento" : "intentos"}
            </span>
          </div>
          {finished === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aún nadie ha respondido este quiz. Comparte el link y refresca la página cuando esperes resultados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Estudiante</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2">Terminó</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, i) => {
                    const pct = (a.correct / a.total) * 100;
                    return (
                      <motion.tr
                        key={a.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border last:border-b-0 hover:bg-muted/40"
                      >
                        <td className="py-3 pr-3 text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="py-3 pr-3">
                          {a.studentName || (
                            <span className="italic text-muted-foreground">
                              Anónimo
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-semibold tabular-nums">
                          {a.correct} / {a.total}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={scoreCls(pct)}>{pct.toFixed(0)}%</span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {formatDate(a.completedAt)}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Preguntas + respuestas */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">
            Preguntas y respuestas correctas
          </h2>
          <div className="space-y-4">
            {quiz.questions.map((q, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-background p-4"
              >
                <p className="font-semibold">
                  {i + 1}. {q.question}
                </p>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((opt) => {
                    const isCorrect = opt.label === q.correctAnswer;
                    return (
                      <div
                        key={opt.label}
                        className={
                          isCorrect
                            ? "flex items-center gap-3 rounded-lg border border-success bg-success/10 px-3 py-2 text-sm"
                            : "flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                        }
                      >
                        <span className="font-bold w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 text-xs">
                          {opt.label}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isCorrect && (
                          <span className="text-xs font-semibold text-success">
                            ✓ Correcta
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                    <strong>Explicación:</strong> {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {children}
    </div>
  );
}

function labelDifficulty(d: string) {
  return d === "easy" ? "fácil" : d === "hard" ? "difícil" : "media";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function scoreCls(pct: number) {
  if (pct >= 70) return "font-semibold text-success";
  if (pct >= 50) return "font-semibold text-accent";
  return "font-semibold text-destructive";
}
