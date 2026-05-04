import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth, logout, refreshTeacher } from "@/lib/auth";
import {
  deleteQuiz,
  listMyQuizzes,
  studentUrl,
  type QuizSummary,
} from "@/lib/quizzes";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { token, teacher } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" });
      return;
    }
    refreshTeacher();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMyQuizzes();
      setQuizzes(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        navigate({ to: "/login" });
        return;
      }
      setError(
        err instanceof Error ? err.message : "Error al cargar quizzes"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (q: QuizSummary) => {
    if (!window.confirm(`¿Eliminar "${q.title}"? El link dejará de funcionar.`))
      return;
    setDeletingId(q.id);
    try {
      await deleteQuiz(q.id);
      setQuizzes((prev) => prev.filter((x) => x.id !== q.id));
      toast.success("Quiz eliminado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (q: QuizSummary) => {
    const url = studentUrl(q.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      window.prompt("Copia el link:", url);
    }
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  if (!teacher) {
    return null; // mientras redirige
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-primary">
              Mis quizzes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hola, <span className="font-semibold text-foreground">{teacher.nombre}</span> · {teacher.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
            <Link
              to="/quizzes/nuevo"
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              + Crear quiz
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Error</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {!loading && !error && quizzes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-base font-semibold">Aún no has creado ningún quiz</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea uno y comparte el link con tus estudiantes.
            </p>
            <Link
              to="/quizzes/nuevo"
              className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              Crear mi primer quiz
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnimatePresence>
            {quizzes.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">
                      {q.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.numQuestions} {q.numQuestions === 1 ? "pregunta" : "preguntas"} · dificultad{" "}
                      <span className="font-semibold">{labelDifficulty(q.difficulty)}</span>
                    </p>
                  </div>
                  {q.expired ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                      Vencido
                    </span>
                  ) : (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                      Activo
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Vence: {formatDate(q.expiresAt)}
                </p>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <code className="flex-1 truncate text-xs font-mono text-foreground">
                    /q/{q.slug}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(q)}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Copiar
                  </button>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <a
                    href={studentUrl(q.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Vista previa →
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(q)}
                    disabled={deletingId === q.id}
                    className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                  >
                    {deletingId === q.id ? "..." : "Eliminar"}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function labelDifficulty(d: string) {
  return d === "easy" ? "fácil" : d === "hard" ? "difícil" : "medio";
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
