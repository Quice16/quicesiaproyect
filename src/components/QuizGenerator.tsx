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

async function fetchQuestionsFromN8n(
  webhookUrl: string,
  text: string,
  difficulty: string,
  numQuestions: number
): Promise<QuizQuestion[]> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, difficulty, numQuestions }),
  });

  if (!response.ok) {
    throw new Error(`Error del servidor: ${response.status}`);
  }

  const data = await response.json();

  // n8n puede devolver la respuesta en distintos formatos según configuración
  // Intentamos parsear el JSON de la respuesta de IA
  let questions: QuizQuestion[];

  if (data.questions && Array.isArray(data.questions)) {
    questions = data.questions;
  } else if (typeof data === "string") {
    const parsed = JSON.parse(data);
    questions = parsed.questions;
  } else if (data.output && typeof data.output === "string") {
    // OpenAI node en n8n a veces devuelve { output: "..." }
    const cleaned = data.output.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    questions = parsed.questions;
  } else if (data.message?.content) {
    const cleaned = data.message.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    questions = parsed.questions;
  } else if (Array.isArray(data)) {
    // Si n8n devuelve un array directamente
    if (data[0]?.questions) {
      questions = data[0].questions;
    } else if (data[0]?.output) {
      const cleaned = data[0].output.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      questions = parsed.questions;
    } else {
      throw new Error("Formato de respuesta no reconocido");
    }
  } else {
    // Último intento: buscar en todo el objeto
    const raw = JSON.stringify(data);
    const match = raw.match(/"questions"\s*:\s*\[/);
    if (match) {
      const startIdx = raw.indexOf(match[0]);
      const sub = raw.slice(startIdx - 1);
      const parsed = JSON.parse("{" + sub.slice(0, sub.lastIndexOf("]") + 2));
      questions = parsed.questions;
    } else {
      throw new Error("No se encontraron preguntas en la respuesta. Revisa la configuración del nodo Respond to Webhook en n8n.");
    }
  }

  // Validar estructura mínima
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("La IA no generó preguntas válidas. Intenta con un texto más largo.");
  }

  return questions;
}

export default function QuizGenerator() {
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(true);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    if (!webhookUrl.trim()) {
      setError("Ingresa la URL del webhook de n8n.");
      return;
    }

    try {
      const parsed = new URL(webhookUrl.trim());
      if (parsed.protocol !== "https:") {
        setError("La URL del webhook debe usar HTTPS para proteger tu contenido.");
        return;
      }
    } catch {
      setError("La URL del webhook no es válida.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSelectedAnswers({});
    setShowAnswers({});
    setQuestions([]);

    try {
      const generated = await fetchQuestionsFromN8n(webhookUrl, text, difficulty, numQuestions);
      setQuestions(generated);
      setShowConfig(false);
    } catch (err) {
      console.error("Error generando quiz:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al conectar con n8n. Verifica la URL y que el workflow esté activo."
      );
    } finally {
      setIsGenerating(false);
    }
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

  const difficultyLabels: Record<string, string> = {
    easy: "Fácil",
    medium: "Medio",
    hard: "Difícil",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Input Panel */}
      <section className="lg:col-span-2 bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-6 tracking-tight">
          Generar Quiz con IA
        </h2>

        <div className="space-y-5">
          {/* Webhook Config */}
          <div>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 text-sm font-semibold text-primary mb-2 hover:underline"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${showConfig ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Configuración de n8n
            </button>

            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
                    <label
                      htmlFor="webhook-url"
                      className="block text-sm font-semibold text-foreground"
                    >
                      URL del Webhook de n8n
                    </label>
                    <input
                      id="webhook-url"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 placeholder:text-muted-foreground text-sm"
                      placeholder="https://tu-instancia.n8n.cloud/webhook/..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Pega aquí la URL de producción del nodo Webhook de tu flujo en n8n.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text Input */}
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
              placeholder="Ingresa tus notas de clase, artículos, capítulos de libro o cualquier texto educativo para generar preguntas de opción múltiple con IA..."
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label
                  htmlFor="difficulty-select"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Dificultad
                </label>
                <select
                  id="difficulty-select"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full sm:w-40 appearance-none p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-all duration-200"
                >
                  <option value="easy">Fácil</option>
                  <option value="medium">Medio</option>
                  <option value="hard">Difícil</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="num-questions"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Preguntas
                </label>
                <select
                  id="num-questions"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full sm:w-28 appearance-none p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-all duration-200"
                >
                  {[5, 8, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={!text.trim() || !webhookUrl.trim() || isGenerating}
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
                  Generando con IA...
                </span>
              ) : (
                "Generar Quiz"
              )}
            </motion.button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm"
              >
                <p className="font-semibold mb-1">Error al generar</p>
                <p>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
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
            {questions.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm font-medium">Dificultad</span>
                <span className="text-sm font-semibold text-accent">
                  {difficultyLabels[difficulty] || difficulty}
                </span>
              </div>
            )}
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
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {score === questions.length
                    ? "🎉 ¡Perfecto!"
                    : score >= questions.length * 0.7
                      ? "👏 ¡Muy bien!"
                      : score >= questions.length * 0.5
                        ? "📚 ¡Sigue estudiando!"
                        : "💪 ¡No te rindas!"}
                </p>
              </motion.div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
          <h3 className="text-xl font-bold text-primary mb-3 font-heading">Cómo usar</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Configura tu webhook de n8n con IA</li>
            <li>Pega la URL del webhook</li>
            <li>Pega un texto educativo</li>
            <li>Selecciona dificultad y número de preguntas</li>
            <li>Haz clic en "Generar Quiz"</li>
            <li>¡Responde y revisa tus resultados!</li>
          </ol>
        </div>

        {questions.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setQuestions([]);
              setSelectedAnswers({});
              setShowAnswers({});
              setError(null);
            }}
            className="w-full py-3 px-6 rounded-xl bg-muted text-foreground font-semibold text-sm border border-border hover:bg-muted/70 transition-colors duration-200"
          >
            Nuevo Quiz
          </motion.button>
        )}
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
              Quiz Generado ({questions.length} preguntas)
            </h2>

            {questions.map((q, qIndex) => (
              <motion.div
                key={qIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.08 }}
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
