import { useState, useEffect } from "react";
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

type Provider = "openai" | "anthropic";

const STORAGE_KEY = "quiz_ai_config_v1";

const difficultyDescriptions: Record<string, string> = {
  easy: "preguntas básicas de comprensión y memorización",
  medium: "preguntas de aplicación y análisis de conceptos",
  hard: "preguntas de evaluación crítica, inferencia y casos complejos",
};

function buildPrompt(text: string, difficulty: string, numQuestions: number) {
  return `Eres un generador experto de exámenes educativos. A partir del siguiente texto, crea EXACTAMENTE ${numQuestions} preguntas de opción múltiple en español, de dificultad ${difficulty} (${difficultyDescriptions[difficulty]}).

Cada pregunta debe tener 4 opciones (A, B, C, D), una sola respuesta correcta, y una explicación breve.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto adicional) con esta estructura exacta:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "options": [
        {"label": "A", "text": "opción A"},
        {"label": "B", "text": "opción B"},
        {"label": "C", "text": "opción C"},
        {"label": "D", "text": "opción D"}
      ],
      "correctAnswer": "A",
      "explanation": "por qué esta es la respuesta correcta"
    }
  ]
}

TEXTO:
"""
${text}
"""`;
}

function extractJson(raw: string): { questions: QuizQuestion[] } {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No se pudo interpretar la respuesta de la IA como JSON.");
  }
}

async function callOpenAI(apiKey: string, prompt: string): Promise<QuizQuestion[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Devuelve solo JSON válido, sin markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  return parsed.questions;
}

async function callAnthropic(apiKey: string, prompt: string): Promise<QuizQuestion[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text ?? "";
  const parsed = extractJson(content);
  return parsed.questions;
}

export default function QuizGenerator() {
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(true);

  // Cargar configuración guardada (solo si el usuario eligió recordar)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
        if (parsed.provider) setProvider(parsed.provider);
        setRememberKey(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistConfig = (key: string, prov: Provider, remember: boolean) => {
    try {
      if (remember && key) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey: key, provider: prov }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Pega un texto para generar el quiz.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Ingresa tu API key del proveedor de IA.");
      return;
    }

    // Validación básica de formato
    if (provider === "openai" && !apiKey.startsWith("sk-")) {
      setError("La API key de OpenAI debe empezar con 'sk-'.");
      return;
    }
    if (provider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
      setError("La API key de Claude debe empezar con 'sk-ant-'.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSelectedAnswers({});
    setShowAnswers({});
    setQuestions([]);

    try {
      const prompt = buildPrompt(text, difficulty, numQuestions);
      const generated =
        provider === "openai"
          ? await callOpenAI(apiKey.trim(), prompt)
          : await callAnthropic(apiKey.trim(), prompt);

      if (!Array.isArray(generated) || generated.length === 0) {
        throw new Error("La IA no devolvió preguntas válidas. Intenta con un texto más largo.");
      }

      setQuestions(generated);
      setShowConfig(false);
      persistConfig(apiKey.trim(), provider, rememberKey);
    } catch (err) {
      console.error("Error generando quiz:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al conectar con la IA. Verifica tu API key."
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

  const providerInfo: Record<Provider, { name: string; url: string; placeholder: string }> = {
    openai: {
      name: "OpenAI (GPT-4o mini)",
      url: "https://platform.openai.com/api-keys",
      placeholder: "sk-...",
    },
    anthropic: {
      name: "Anthropic (Claude 3.5 Haiku)",
      url: "https://console.anthropic.com/settings/keys",
      placeholder: "sk-ant-...",
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Input Panel */}
      <section className="lg:col-span-2 bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-6 tracking-tight">
          Generar Quiz con IA
        </h2>

        <div className="space-y-5">
          {/* AI Config */}
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
              Configuración de IA
            </button>

            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4">
                    {/* Provider */}
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Proveedor de IA
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(providerInfo) as Provider[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setProvider(p)}
                            className={`p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                              provider === p
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-foreground hover:bg-muted"
                            }`}
                          >
                            {providerInfo[p].name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* API Key */}
                    <div>
                      <label
                        htmlFor="api-key"
                        className="block text-sm font-semibold text-foreground mb-2"
                      >
                        Tu API Key
                      </label>
                      <input
                        id="api-key"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 placeholder:text-muted-foreground text-sm font-mono"
                        placeholder={providerInfo[provider].placeholder}
                      />
                      <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberKey}
                            onChange={(e) => setRememberKey(e.target.checked)}
                            className="rounded border-border"
                          />
                          Recordar en este navegador
                        </label>
                        <a
                          href={providerInfo[provider].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Obtener API key →
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        🔒 Tu API key se usa solo desde tu navegador para llamar al proveedor. No se envía a ningún servidor intermedio.
                      </p>
                    </div>
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
              Pega tu contenido o palabra clave
            </label>
            <textarea
              id="content-input"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-4 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all duration-200 placeholder:text-muted-foreground"
              placeholder="Ingresa tus notas, un artículo, un capítulo, o simplemente una palabra clave / tema (ej: 'Revolución Francesa', 'Fotosíntesis', 'Ciclo del agua')..."
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
              disabled={!text.trim() || !apiKey.trim() || isGenerating}
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
                <p className="break-words">{error}</p>
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
            <li>Elige tu proveedor de IA (OpenAI o Claude)</li>
            <li>Pega tu API key personal</li>
            <li>Escribe un texto o palabra clave</li>
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
