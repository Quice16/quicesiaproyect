import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  getPublicQuiz,
  submitPublicQuiz,
  type PublicQuiz,
  type QuizSubmitResult,
} from "@/lib/quizzes";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/q/$slug")({
  component: TakeQuizPage,
});

function TakeQuizPage() {
  const { slug } = Route.useParams();

  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const [studentName, setStudentName] = useState("");
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicQuiz(slug);
        if (mounted) setQuiz(data);
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiError) {
            setError(err.message);
            setErrorStatus(err.status);
          } else {
            setError(err instanceof Error ? err.message : "Error desconocido");
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const handleSelect = (i: number, label: string) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [i]: label }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const arr = quiz.questions.map((q) => ({
      questionIndex: q.index,
      selectedLabel: answers[q.index] ?? "",
    }));
    setSubmitting(true);
    try {
      const r = await submitPublicQuiz(slug, {
        studentName: studentName.trim() || undefined,
        answers: arr.filter((a) => a.selectedLabel),
      });
      setResult(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al enviar";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Cargando quiz...</p>
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-destructive">
            {errorStatus === 410 ? "Quiz vencido" : "Quiz no disponible"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </Centered>
    );
  }

  if (!quiz) return null;

  const allAnswered = quiz.questions.every(
    (q) => answers[q.index] !== undefined
  );
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Universidad del Quindío
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-primary">
            {quiz.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Por <strong>{quiz.teacher.nombre}</strong>
            {quiz.teacher.programa ? ` · ${quiz.teacher.programa}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vence: {new Date(quiz.expiresAt).toLocaleString("es-CO")} ·{" "}
            {quiz.questions.length} preguntas · dificultad{" "}
            <span className="font-semibold">
              {quiz.difficulty === "easy"
                ? "fácil"
                : quiz.difficulty === "hard"
                  ? "difícil"
                  : "media"}
            </span>
          </p>
        </header>

        {!started && !result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-lg"
          >
            <h2 className="text-lg font-bold">Antes de empezar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu nombre es opcional. El quiz se evalúa cuando lo termines.
            </p>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="mt-4 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              Empezar quiz
            </button>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resultado
            </p>
            <p className="mt-2 text-5xl font-bold text-primary tabular-nums">
              {result.correct} / {result.total}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {(result.score * 100).toFixed(0)}% de respuestas correctas
            </p>
          </motion.div>
        )}

        {(started || result) && (
          <div className="space-y-5">
            {quiz.questions.map((q) => {
              const selected = answers[q.index];
              const r = result?.results.find(
                (x) => x.questionIndex === q.index
              );
              return (
                <motion.div
                  key={q.index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <p className="font-semibold">
                    {q.index + 1}. {q.question}
                  </p>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt) => {
                      const isSelected = selected === opt.label;
                      const isCorrect = r && opt.label === r.correctAnswer;
                      const isWrongPick =
                        r && isSelected && opt.label !== r.correctAnswer;
                      let cls =
                        "w-full text-left rounded-xl border px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ";
                      if (r && isCorrect)
                        cls += "border-success bg-success/10";
                      else if (isWrongPick)
                        cls += "border-destructive bg-destructive/10";
                      else if (isSelected)
                        cls += "border-primary bg-primary/10";
                      else
                        cls +=
                          "border-border bg-background hover:bg-muted cursor-pointer";
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          disabled={!!result}
                          onClick={() => handleSelect(q.index, opt.label)}
                          className={cls}
                        >
                          <span className="font-bold w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                            {opt.label}
                          </span>
                          <span>{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {r && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 border-t border-border pt-3 text-sm"
                      >
                        <p
                          className={
                            r.isCorrect
                              ? "font-semibold text-success"
                              : "font-semibold text-destructive"
                          }
                        >
                          {r.isCorrect
                            ? "✓ Correcto"
                            : `✗ Incorrecto — la respuesta es ${r.correctAnswer}`}
                        </p>
                        {r.explanation && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.explanation}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {!result && (
              <div className="sticky bottom-4 rounded-2xl border border-border bg-card p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Respondidas {answeredCount} de {quiz.questions.length}
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || answeredCount === 0}
                  className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground shadow-md hover:bg-accent/90 disabled:opacity-50"
                >
                  {submitting
                    ? "Enviando..."
                    : allAnswered
                      ? "Terminar y ver resultados"
                      : `Terminar (${quiz.questions.length - answeredCount} sin responder)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
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
