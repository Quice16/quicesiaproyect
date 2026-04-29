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

type Provider = "local" | "openai" | "anthropic" | "deepseek" | "gemini" | "mistral";

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
  return extractJson(content).questions;
}

async function callDeepSeek(apiKey: string, prompt: string): Promise<QuizQuestion[]> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
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
    throw new Error(`DeepSeek ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  return extractJson(data.choices?.[0]?.message?.content ?? "").questions;
}

async function callGemini(apiKey: string, prompt: string): Promise<QuizQuestion[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  return extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").questions;
}

async function callMistral(apiKey: string, prompt: string): Promise<QuizQuestion[]> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
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
    throw new Error(`Mistral ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  return extractJson(data.choices?.[0]?.message?.content ?? "").questions;
}

// ============= Generador LOCAL (sin API key, sin IA) =============
const STOPWORDS = new Set(
  "a al algo algun alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aqui asi aun aunque cada como con contra cual cuales cuando cuanta cuantas cuanto cuantos de del desde donde dos el ella ellas ellos en entre era erais eramos eran eras eres es esa esas ese eso esos esta estaba estaban estado estamos estan estar estas este esto estos estoy fue fueron fui ha habia habian han has hasta hay he hizo la las le les lo los mas me mi mientras mis mucho muchos muy nada ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero poco por porque pues que quien quienes se sea sean segun ser si sido siempre sin sino sobre solo somos son soy su sus tambien tan tanto te tiene tienen toda todas todo todos tras tu tus un una unas uno unos vosotros voy y ya yo".split(
    " "
  )
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 280);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateLocalQuiz(
  text: string,
  difficulty: string,
  numQuestions: number
): QuizQuestion[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    throw new Error(
      "El modo sin IA necesita un texto con varias oraciones completas (mínimo 2-3 frases). Pega un párrafo más extenso o usa un proveedor de IA."
    );
  }

  const wordFreq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of tokenize(s)) {
      if (w.length < 5 || STOPWORDS.has(w)) continue;
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
    }
  }
  const vocab = Array.from(wordFreq.keys());
  if (vocab.length < 4) {
    throw new Error(
      "El texto es demasiado corto o repetitivo para el modo sin IA. Agrega más contenido."
    );
  }

  const minLen = difficulty === "hard" ? 6 : difficulty === "medium" ? 5 : 4;
  const candidateSentences = shuffle(sentences).slice(0, numQuestions * 3);
  const questions: QuizQuestion[] = [];
  const usedKeywords = new Set<string>();

  for (const sentence of candidateSentences) {
    if (questions.length >= numQuestions) break;
    const words = tokenize(sentence).filter(
      (w) => w.length >= minLen && !STOPWORDS.has(w) && !usedKeywords.has(w)
    );
    if (words.length === 0) continue;
    words.sort((a, b) => (wordFreq.get(b) ?? 0) - (wordFreq.get(a) ?? 0));
    const keyword = words[0];
    usedKeywords.add(keyword);

    // Buscar la palabra original con sus tildes/mayúsculas en la oración
    const sentenceWords = sentence.split(/\b/);
    const original = sentenceWords.find(
      (w) =>
        w
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") === keyword
    );
    if (!original) continue;

    const blanked = sentence.replace(original, "_____");
    if (blanked === sentence) continue;

    const distractors = shuffle(
      vocab.filter((w) => w !== keyword && Math.abs(w.length - keyword.length) <= 4)
    ).slice(0, 3);
    if (distractors.length < 3) continue;

    const allOptions = shuffle([original, ...distractors]);
    const labels = ["A", "B", "C", "D"];
    const options: QuizOption[] = allOptions.map((text, i) => ({ label: labels[i], text }));
    const correctLabel = options.find(
      (o) => o.text.toLowerCase() === original.toLowerCase()
    )!.label;

    questions.push({
      question: `Completa la oración según el texto: "${blanked}"`,
      options,
      correctAnswer: correctLabel,
      explanation: `La palabra correcta es "${original}" según el texto original.`,
    });
  }

  if (questions.length === 0) {
    throw new Error(
      "No se pudieron generar preguntas en modo sin IA. Intenta con un texto más largo y descriptivo."
    );
  }
  return questions;
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
  const [quizFinished, setQuizFinished] = useState(false);

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
      setError("Pega un texto o palabra clave para generar el quiz.");
      return;
    }
    if (provider !== "local" && !apiKey.trim()) {
      setError("Ingresa tu API key del proveedor seleccionado o usa el modo 'Sin IA'.");
      return;
    }

    // Validación básica de formato (solo IA en línea)
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
    setQuizFinished(false);

    try {
      const prompt = buildPrompt(text, difficulty, numQuestions);
      const key = apiKey.trim();
      let generated: QuizQuestion[] = [];

      switch (provider) {
        case "local":
          generated = generateLocalQuiz(text, difficulty, numQuestions);
          break;
        case "openai":
          generated = await callOpenAI(key, prompt);
          break;
        case "anthropic":
          generated = await callAnthropic(key, prompt);
          break;
        case "deepseek":
          generated = await callDeepSeek(key, prompt);
          break;
        case "gemini":
          generated = await callGemini(key, prompt);
          break;
        case "mistral":
          generated = await callMistral(key, prompt);
          break;
      }

      if (!Array.isArray(generated) || generated.length === 0) {
        throw new Error("No se generaron preguntas válidas. Intenta con un texto más largo.");
      }

      setQuestions(generated);
      setShowConfig(false);
      if (provider !== "local") persistConfig(key, provider, rememberKey);
    } catch (err) {
      console.error("Error generando quiz:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al generar el quiz. Verifica tu API key o el texto."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAnswer = (qIndex: number, label: string) => {
    if (quizFinished) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: label }));
  };

  const handleFinishQuiz = () => {
    const reveal: Record<number, boolean> = {};
    questions.forEach((_, i) => {
      reveal[i] = true;
    });
    setShowAnswers(reveal);
    setQuizFinished(true);
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

  const providerInfo: Record<
    Provider,
    { name: string; short: string; url: string; placeholder: string; needsKey: boolean }
  > = {
    local: {
      name: "Sin IA · Modo local (gratis)",
      short: "Sin IA (local)",
      url: "",
      placeholder: "",
      needsKey: false,
    },
    openai: {
      name: "OpenAI · GPT-4o mini",
      short: "OpenAI",
      url: "https://platform.openai.com/api-keys",
      placeholder: "sk-...",
      needsKey: true,
    },
    anthropic: {
      name: "Anthropic · Claude 3.5 Haiku",
      short: "Claude",
      url: "https://console.anthropic.com/settings/keys",
      placeholder: "sk-ant-...",
      needsKey: true,
    },
    deepseek: {
      name: "DeepSeek · deepseek-chat",
      short: "DeepSeek",
      url: "https://platform.deepseek.com/api_keys",
      placeholder: "sk-...",
      needsKey: true,
    },
    gemini: {
      name: "Google · Gemini 2.0 Flash",
      short: "Gemini",
      url: "https://aistudio.google.com/app/apikey",
      placeholder: "AIza...",
      needsKey: true,
    },
    mistral: {
      name: "Mistral · mistral-small",
      short: "Mistral",
      url: "https://console.mistral.ai/api-keys/",
      placeholder: "...",
      needsKey: true,
    },
  };

  const currentProvider = providerInfo[provider];

  const hasQuiz = questions.length > 0;
  const resetQuiz = () => {
    setQuestions([]);
    setSelectedAnswers({});
    setShowAnswers({});
    setError(null);
    setShowConfig(true);
    setQuizFinished(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
      {/* Main Panel: muestra configuración O las preguntas generadas */}
      <section className="lg:col-span-2 bg-card rounded-2xl p-6 lg:p-8 shadow-lg border border-border">
        {hasQuiz ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight font-heading">
                Quiz Generado ({questions.length})
              </h2>
              <button
                type="button"
                onClick={resetQuiz}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground font-semibold text-sm border border-border hover:bg-muted/70 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Nuevo Quiz
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((q, qIndex) => {
                const isRevealed = showAnswers[qIndex];
                return (
                  <motion.div
                    key={qIndex}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: qIndex * 0.05 }}
                    className="rounded-2xl p-5 lg:p-6 border border-border bg-background"
                  >
                    <p className="font-semibold text-base lg:text-lg text-foreground mb-4">
                      {qIndex + 1}. {q.question}
                    </p>

                    <div className="space-y-3">
                      {q.options.map((opt) => {
                        const isSelected = selectedAnswers[qIndex] === opt.label;
                        const isCorrect = opt.label === q.correctAnswer;
                        let optionClasses =
                          "w-full text-left px-5 py-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ";
                        if (isRevealed && isCorrect) {
                          optionClasses += "border-success bg-success/10 text-foreground";
                        } else if (isRevealed && isSelected && !isCorrect) {
                          optionClasses += "border-destructive bg-destructive/10 text-foreground";
                        } else if (isSelected) {
                          optionClasses += "border-primary bg-primary/10 text-foreground";
                        } else {
                          optionClasses +=
                            "border-border bg-card text-foreground hover:bg-muted hover:border-muted-foreground/30 cursor-pointer";
                        }
                        return (
                          <button
                            key={opt.label}
                            onClick={() => handleSelectAnswer(qIndex, opt.label)}
                            disabled={!!isRevealed}
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
                      {isRevealed && (
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
                );
              })}
            </div>

            {/* Botón Terminar Quiz / Resumen */}
            {!quizFinished ? (
              <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Has respondido <span className="font-bold text-foreground">{Object.keys(selectedAnswers).length}</span> de <span className="font-bold text-foreground">{questions.length}</span> preguntas.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFinishQuiz}
                  disabled={Object.keys(selectedAnswers).length === 0}
                  className="px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {allAnswered ? "Terminar Quiz y ver resultados" : "Terminar Quiz (algunas sin responder)"}
                </motion.button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 pt-6 border-t border-border"
              >
                <div className="rounded-2xl p-5 bg-primary/5 border border-primary/20 text-center">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resultado final</p>
                  <p className="text-4xl font-bold text-primary mt-2 tabular-nums">
                    {score} / {questions.length}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Correctas: <span className="text-success font-bold">{score}</span> · Incorrectas: <span className="text-destructive font-bold">{Object.keys(selectedAnswers).length - score}</span> · Sin responder: <span className="font-bold">{questions.length - Object.keys(selectedAnswers).length}</span>
                  </p>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-6 tracking-tight">
              Generar Quiz
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
              Configuración del modelo
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
                    {/* Provider dropdown */}
                    <div>
                      <label
                        htmlFor="provider-select"
                        className="block text-sm font-semibold text-foreground mb-2"
                      >
                        Modelo / Proveedor
                      </label>
                      <select
                        id="provider-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as Provider)}
                        className="w-full appearance-none p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-all duration-200"
                      >
                        <optgroup label="Sin cuenta ni API key">
                          <option value="local">🆓 Sin IA · Modo local (gratis)</option>
                        </optgroup>
                        <optgroup label="IA en línea (requiere API key)">
                          <option value="openai">OpenAI · GPT-4o mini</option>
                          <option value="anthropic">Anthropic · Claude 3.5 Haiku</option>
                          <option value="deepseek">DeepSeek · deepseek-chat</option>
                          <option value="gemini">Google · Gemini 2.0 Flash</option>
                          <option value="mistral">Mistral · mistral-small</option>
                        </optgroup>
                      </select>
                      {provider === "local" && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          ℹ️ El <strong>modo local</strong> genera preguntas de
                          completar la oración usando únicamente el texto que pegues.
                          No usa internet, no requiere API key y es 100% gratuito.
                          Funciona mejor con párrafos largos y descriptivos.
                        </p>
                      )}
                    </div>

                    {/* API Key (oculto en modo local) */}
                    {currentProvider.needsKey && (
                      <div>
                        <label
                          htmlFor="api-key"
                          className="block text-sm font-semibold text-foreground mb-2"
                        >
                          Tu API Key de {currentProvider.short}
                        </label>
                        <input
                          id="api-key"
                          type="password"
                          autoComplete="off"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full p-3 border border-border rounded-xl text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 placeholder:text-muted-foreground text-sm font-mono"
                          placeholder={currentProvider.placeholder}
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
                            href={currentProvider.url}
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
                    )}
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
              disabled={!text.trim() || (currentProvider.needsKey && !apiKey.trim()) || isGenerating}
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
                  {provider === "local" ? "Generando..." : "Generando con IA..."}
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
          </>
        )}
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

            {/* Desglose por pregunta */}
            {questions.length > 0 && Object.keys(selectedAnswers).length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Desglose por pregunta
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, i) => {
                    const answered = selectedAnswers[i] !== undefined;
                    const correct = answered && selectedAnswers[i] === q.correctAnswer;
                    let cls =
                      "aspect-square rounded-lg flex items-center justify-center text-xs font-bold border transition-all duration-200 ";
                    if (!answered) {
                      cls += "bg-muted text-muted-foreground border-border";
                    } else if (correct) {
                      cls += "bg-success/15 text-success border-success/40";
                    } else {
                      cls += "bg-destructive/15 text-destructive border-destructive/40";
                    }
                    return (
                      <div
                        key={i}
                        className={cls}
                        title={
                          !answered
                            ? `Pregunta ${i + 1}: sin responder`
                            : correct
                              ? `Pregunta ${i + 1}: correcta`
                              : `Pregunta ${i + 1}: incorrecta (correcta: ${q.correctAnswer})`
                        }
                      >
                        {answered ? (correct ? "✓" : "✗") : i + 1}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-2 mt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-success font-semibold">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    Correctas: {score}
                  </span>
                  <span className="flex items-center gap-1.5 text-destructive font-semibold">
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    Incorrectas: {Object.keys(selectedAnswers).length - score}
                  </span>
                </div>
              </div>
            )}

            {allAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 border-t border-border"
              >
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm font-medium">Puntuación final</span>
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

      </aside>
    </div>
  );
}
