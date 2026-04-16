import { createFileRoute } from "@tanstack/react-router";
import QuizGenerator from "../components/QuizGenerator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "QuizForge — Generador de Quizzes desde Texto" },
      {
        name: "description",
        content:
          "Transforma cualquier texto en cuestionarios de opción múltiple. Ideal para estudiantes, educadores y autodidactas.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 lg:mb-14 gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight font-heading">
              QuizForge
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Transforma texto en quizzes interactivos
            </p>
          </div>
        </header>

        {/* Main Content */}
        <QuizGenerator />
      </div>
    </div>
  );
}
