import { createFileRoute } from "@tanstack/react-router";
import QuizGenerator from "../components/QuizGenerator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "QuizUQGenerator — Generador de Quizzes UQ" },
      {
        name: "description",
        content:
          "Generador de quizzes con IA para fines académicos — Universidad del Quindío.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="relative min-h-screen bg-background antialiased overflow-hidden">
      {/* Marca de agua diagonal repetida */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 select-none opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-30deg, transparent 0 120px, rgba(0,0,0,0.001) 120px 121px)",
        }}
      >
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-16 gap-y-24 -rotate-[30deg] scale-150 text-primary font-bold text-base whitespace-nowrap">
          {Array.from({ length: 60 }).map((_, i) => (
            <span key={i}>
              Diseñado por Ing. Andrés Felipe Quiceno y Juan Diego Jaramillo · Universidad del Quindío · Para fines Académicos
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 lg:mb-14 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-2xl shadow-lg shrink-0">
              UQ
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight font-heading">
                QuizUQGenerator
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Universidad del Quindío · Generador académico de quizzes con IA
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <QuizGenerator />

        {/* Footer / Créditos */}
        <footer className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-sm font-semibold text-primary">
            Diseñado por Ing. Andrés Felipe Quiceno y Juan Diego Jaramillo
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Universidad del Quindío · Para fines Académicos
          </p>
        </footer>
      </div>
    </div>
  );
}
