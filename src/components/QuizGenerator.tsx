import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizOption {
  label: string;
  text: string;
}

interface QuizQuestion {
  question: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
}

function generateQuestionsFromText(text: string, difficulty: string): QuizQuestion[] {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length < 3) {
    return [
      {
        question: "¿Cuál es el tema principal del texto proporcionado?",
        options: [
          { label: "A", text: "Un análisis económico detallado" },
          { label: "B", text: "El contenido proporcionado por el usuario" },
          { label: "C", text: "Una teoría científica avanzada" },
          { label: "D", text: "Un evento histórico específico" },
        ],
        correctAnswer: "B",
        explanation:
          "El texto se refiere al contenido ingresado por el usuario, que es la base para generar las preguntas del cuestionario.",
      },
    ];
  }

  const questions: QuizQuestion[] = [];
  const usedIndexes = new Set<number>();

  const numQuestions = Math.min(5, Math.floor(sentences.length / 2));

  for (let i = 0; i < numQuestions; i++) {
    let idx = Math.floor(Math.random() * sentences.length);
    while (usedIndexes.has(idx)) {
      idx = (idx + 1) % sentences.length;
    }
    usedIndexes.add(idx);

    const keySentence = sentences[idx];
    const words = keySentence.split(/\s+/);
    const keyPhrase =
      words.length > 5
        ? words.slice(0, Math.ceil(words.length / 2)).join(" ") + "..."
        : keySentence;

    const questionTemplates =
      difficulty === "easy"
        ? [
            `¿Qué menciona el texto sobre "${keyPhrase}"?`,
            `Según el texto, ¿cuál de las siguientes afirmaciones es correcta?`,
            `¿Cuál es una idea presente en el texto?`,
          ]
        : difficulty === "hard"
          ? [
              `Analiza críticamente: ¿qué implicación tiene "${keyPhrase}"?`,
              `¿Cuál sería la conclusión más precisa respecto a "${keyPhrase}"?`,
              `¿Qué inferencia se puede hacer a partir de "${keyPhrase}"?`,
            ]
          : [
              `¿Qué se puede entender del texto sobre "${keyPhrase}"?`,
              `Con base en el texto, ¿cuál afirmación sobre "${keyPhrase}" es correcta?`,
              `¿Cuál de las siguientes opciones refleja mejor "${keyPhrase}"?`,
            ];

    const template = questionTemplates[i % questionTemplates.length];

    const correctText =
      keySentence.length > 80 ? keySentence.slice(0, 80) + "..." : keySentence;

    const distractors = sentences
      .filter((_, si) => si !== idx)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((s) => (s.length > 80 ? s.slice(0, 80) + "..." : s));

    while (distractors.length < 3) {
      distractors.push("Ninguna de las anteriores es correcta");
    }

    const labels = ["A", "B", "C", "D"];
    const correctPosition = Math.floor(Math.random() * 4);

    const options: QuizOption[] = [];
    let distractorIdx = 0;
    for (let j = 0; j < 4; j++) {
      if (j === correctPosition) {
        options.push({ label: labels[j], text: correctText });
      } else {
        options.push({
          label: labels[j],
          text: distractors[distractorIdx] || "Opción no disponible",
        });
        distractorIdx++;
      }
    }

    questions.push({
      question: template,
      options,
      correctAnswer: labels[correctPosition],
      explanation: `La respuesta correcta se encuentra en el fragmento: "${correctText}". Esta información fue extraída directamente del texto proporcionado.`,
    });
  }

  return questions;
}

export default function QuizGenerator() {
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setSelectedAnswers({});
    setShowAnswers({});

    setTimeout(() => {
      const generated = generateQuestionsFromText(text, difficulty);
      setQuestions(generated);
      setIsGenerating(false);
    }, 800);
  };

  const handleSelectAnswer = (qIndex: number, label: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: label }));
    setShowAnswers((prev) => ({ ...prev, [qIndex]: true }));
  };

  const score = questions.length
    ? questions.filter((q, i) => selectedAnswers[i] === q.correctAnswer).length
    : 0;
  const allAnswered =
    questions.length > 0 && Object.keys(selectedAnswers).length === questions.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Input Panel */}
      <section className="lg:col-span-2 bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-6 tracking-tight">
          Generar Quiz desde Texto
        </h2>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="content-input"
              className="block text-sm font-semibold text-foreground mb-2"
            >
              Pega tu contenido aquí
            </label>
            <textarea
              id="content-input"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-4 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all duration-200 placeholder:text-muted-foreground"
              placeholder="Ingresa tus notas de clase, artículos, capítulos de libro o cualquier texto educativo para generar preguntas de opción múltiple..."
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
            <div className="w-full sm:w-auto">
              <label
                htmlFor="difficulty-select"
                className="block text-sm font-semibold text-foreground mb-2"
              >
                Nivel de dificultad
              </label>
              <select
                id="difficulty-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full sm:w-48 appearance-none p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-all duration-200"
              >
                <option value="easy">Fácil</option>
                <option value="medium">Medio</option>
                <option value="hard">Difícil</option>
              </select>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={!text.trim() || isGenerating}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generando...
                </span>
              ) : (
                "Generar Quiz"
              )}
            </motion.button>
          </div>
        </div>
      </section>

      {/* Stats Panel */}
      <aside className="space-y-6">
        <div className="bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
          <h3 className="text-xl font-bold text-primary mb-4 font-heading">
            Estado del Quiz
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm font-medium">Preguntas</span>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {questions.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm font-medium">Respondidas</span>
              <span className="text-2xl font-bold text-primary tabular-nums">
                {Object.keys(selectedAnswers).length}
              </span>
            </div>
            {allAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 border-t border-border"
              >
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm font-medium">Puntuación</span>
                  <span className="text-2xl font-bold text-accent tabular-nums">
                    {score}/{questions.length}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(score / questions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-accent"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
          <h3 className="text-xl font-bold text-primary mb-3 font-heading">
            Cómo usar
          </h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Pega un texto educativo (notas, artículo, capítulo)</li>
            <li>Selecciona el nivel de dificultad</li>
            <li>Haz clic en "Generar Quiz"</li>
            <li>Responde las preguntas y revisa tus resultados</li>
          </ol>
        </div>
      </aside>

      {/* Questions Section */}
      <AnimatePresence>
        {questions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-3 space-y-6"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight font-heading">
              Quiz Generado
            </h2>

            {questions.map((q, qIndex) => (
              <motion.div
                key={qIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.1 }}
                className="bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border"
              >
                <p className="font-semibold text-lg text-foreground mb-4">
                  {qIndex + 1}. {q.question}
                </p>

                <div className="space-y-3">
                  {q.options.map((opt) => {
                    const isSelected = selectedAnswers[qIndex] === opt.label;
                    const isCorrect = opt.label === q.correctAnswer;
                    const isRevealed = showAnswers[qIndex];

                    let optionClasses =
                      "w-full text-left px-5 py-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 ";

                    if (isRevealed && isCorrect) {
                      optionClasses +=
                        "border-success bg-success/10 text-foreground";
                    } else if (isRevealed && isSelected && !isCorrect) {
                      optionClasses +=
                        "border-destructive bg-destructive/10 text-foreground";
                    } else if (isSelected) {
                      optionClasses +=
                        "border-primary bg-primary/10 text-foreground";
                    } else {
                      optionClasses +=
                        "border-border bg-background text-foreground hover:bg-muted hover:border-muted-foreground/30 cursor-pointer";
                    }

                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleSelectAnswer(qIndex, opt.label)}
                        disabled={!!showAnswers[qIndex]}
                        className={optionClasses}
                      >
                        <span className="font-bold text-sm w-7 h-7 flex items-center justify-center rounded-lg bg-muted shrink-0">
                          {opt.label}
                        </span>
                        <span className="text-sm">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showAnswers[qIndex] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 pt-4 border-t border-border"
                    >
                      <p
                        className={`font-semibold text-sm mb-2 ${
                          selectedAnswers[qIndex] === q.correctAnswer
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        {selectedAnswers[qIndex] === q.correctAnswer
                          ? "✓ ¡Correcto!"
                          : `✗ Incorrecto — La respuesta correcta es: ${q.correctAnswer}`}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <strong>Explicación:</strong> {q.explanation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
