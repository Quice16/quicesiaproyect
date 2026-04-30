// Sync check: commit para verificar integración con GitHub
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

const STARS = [
  { top: "8%", left: "12%", size: 2, delay: "0s" },
  { top: "15%", left: "78%", size: 3, delay: "1.2s" },
  { top: "22%", left: "45%", size: 1.5, delay: "2.4s" },
  { top: "32%", left: "88%", size: 2, delay: "0.6s" },
  { top: "42%", left: "8%", size: 2.5, delay: "1.8s" },
  { top: "55%", left: "62%", size: 1.5, delay: "3s" },
  { top: "62%", left: "30%", size: 2, delay: "0.3s" },
  { top: "70%", left: "92%", size: 3, delay: "2.1s" },
  { top: "78%", left: "18%", size: 2, delay: "1.5s" },
  { top: "85%", left: "70%", size: 1.5, delay: "0.9s" },
  { top: "12%", left: "55%", size: 1.5, delay: "2.7s" },
  { top: "48%", left: "38%", size: 2, delay: "1s" },
  { top: "90%", left: "48%", size: 2, delay: "2.3s" },
  { top: "5%", left: "92%", size: 1.5, delay: "1.7s" },
  { top: "38%", left: "72%", size: 2.5, delay: "0.4s" },
];

function Index() {
  return (
    <div className="relative min-h-screen bg-background antialiased overflow-hidden">
      {/* Fondo astro/educativo: gradiente + nebulosas + grilla + estrellas */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        {/* Gradientes base */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), radial-gradient(ellipse 70% 50% at 100% 100%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 60%), linear-gradient(180deg, var(--background) 0%, color-mix(in oklab, var(--primary) 4%, var(--background)) 100%)",
          }}
        />

        {/* Grilla académica con máscara radial */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            color: "var(--primary)",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 30%, black 40%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 30%, black 40%, transparent 90%)",
          }}
        />

        {/* Nebulosas suaves */}
        <div
          className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--primary) 60%, transparent), transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-25"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent), transparent 70%)",
          }}
        />

        {/* Estrellas titilantes */}
        <div className="absolute inset-0">
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-primary"
              style={{
                top: s.top,
                left: s.left,
                width: `${s.size}px`,
                height: `${s.size}px`,
                opacity: 0.5,
                boxShadow: "0 0 8px currentColor",
                animation: `twinkle 4s ease-in-out ${s.delay} infinite`,
              }}
            />
          ))}
        </div>

        <style>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 0.9; transform: scale(1.2); }
          }
        `}</style>
      </div>

      {/* Marca de agua discreta en esquina */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-3 right-4 z-10 text-[10px] text-muted-foreground/70 font-medium tracking-wide select-none hidden sm:block"
      >
        UQ · Para fines Académicos
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
