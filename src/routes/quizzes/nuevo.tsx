import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth } from "@/lib/auth";
import { createQuiz, type QuizQuestion } from "@/lib/quizzes";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/quizzes/nuevo")({
  component: NuevoQuizPage,
});

// ============= Tipos y storage =============

type Provider = "local" | "openai" | "anthropic" | "gemini";
const KEY_STORE = "quiz_ai_config_v1";

const providerInfo: Record<
  Provider,
  { name: string; placeholder: string; needsKey: boolean; url: string }
> = {
  local: {
    name: "Sin IA · Modo local (gratis)",
    placeholder: "",
    needsKey: false,
    url: "",
  },
  openai: {
    name: "OpenAI · GPT-4o mini",
    placeholder: "sk-...",
    needsKey: true,
    url: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic · Claude 3.5 Haiku",
    placeholder: "sk-ant-...",
    needsKey: true,
    url: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    name: "Google · Gemini 2.0 Flash",
    placeholder: "AIza...",
    needsKey: true,
    url: "https://aistudio.google.com/app/apikey",
  },
};

// ============= Generador IA / local =============

function buildPrompt(text: string, difficulty: string, numQuestions: number) {
  const map: Record<string, string> = {
    easy: "preguntas básicas de comprensión y memorización",
    medium: "preguntas de aplicación y análisis",
    hard: "preguntas de evaluación crítica e inferencia",
  };
  return `Eres un generador experto de exámenes. A partir del texto, crea EXACTAMENTE ${numQuestions} preguntas de opción múltiple en español, de dificultad ${difficulty} (${map[difficulty]}).
Cada pregunta debe tener 4 opciones (A, B, C, D), una sola correcta, y una explicación breve.
Responde ÚNICAMENTE con un JSON válido (sin markdown):
{"questions":[{"question":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctAnswer":"A","explanation":"..."}]}

TEXTO:
"""
${text}
"""`;
}

function extractJson(raw: string): { questions: QuizQuestion[] } {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("La IA no devolvió JSON válido");
  }
}

async function callOpenAI(key: string, prompt: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Devuelve solo JSON válido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return extractJson(d.choices?.[0]?.message?.content ?? "").questions;
}

async function callAnthropic(key: string, prompt: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return extractJson(d.content?.[0]?.text ?? "").questions;
}

async function callGemini(key: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return extractJson(d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").questions;
}

const STOP = new Set(
  "a al algo algun ante antes aqui asi como con cual cuando de del desde donde el ella ellos en entre era es esa eso esta este esto fue fueron ha han hasta la las le les lo los mas me mi muy nada ni no nos o para pero por porque que se sea sin sobre solo son su sus tambien tan tanto te tiene tienen toda todas todo todos un una unas uno unos y ya".split(
    " "
  )
);

function tokenize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateLocal(
  text: string,
  difficulty: string,
  num: number
): QuizQuestion[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 280);
  if (sentences.length === 0)
    throw new Error(
      "El modo local necesita varias oraciones completas. Pega un párrafo más largo."
    );

  const freq = new Map<string, number>();
  for (const s of sentences)
    for (const w of tokenize(s))
      if (w.length >= 5 && !STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const vocab = [...freq.keys()];
  if (vocab.length < 4) throw new Error("Texto demasiado corto/repetitivo");

  const minLen = difficulty === "hard" ? 6 : difficulty === "medium" ? 5 : 4;
  const candidates = shuffle(sentences).slice(0, num * 3);
  const out: QuizQuestion[] = [];
  const used = new Set<string>();
  for (const s of candidates) {
    if (out.length >= num) break;
    const ws = tokenize(s).filter(
      (w) => w.length >= minLen && !STOP.has(w) && !used.has(w)
    );
    if (!ws.length) continue;
    ws.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
    const kw = ws[0];
    used.add(kw);
    const original = s
      .split(/\b/)
      .find(
        (w) =>
          w
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") === kw
      );
    if (!original) continue;
    const blanked = s.replace(original, "_____");
    if (blanked === s) continue;
    const distractors = shuffle(
      vocab.filter((w) => w !== kw && Math.abs(w.length - kw.length) <= 4)
    ).slice(0, 3);
    if (distractors.length < 3) continue;
    const opts = shuffle([original, ...distractors]).map((t, i) => ({
      label: ["A", "B", "C", "D"][i],
      text: t,
    }));
    const correct = opts.find(
      (o) => o.text.toLowerCase() === original.toLowerCase()
    )!.label;
    out.push({
      question: `Completa la oración: "${blanked}"`,
      options: opts,
      correctAnswer: correct,
      explanation: `La palabra correcta es "${original}".`,
    });
  }
  if (!out.length) throw new Error("No se pudieron generar preguntas");
  return out;
}

// ============= Componente página =============

function NuevoQuizPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) navigate({ to: "/login" });
  }, [token, navigate]);

  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  );
  const [numQuestions, setNumQuestions] = useState(5);
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => defaultExpiry());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORE);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.apiKey) setApiKey(p.apiKey);
        if (p.provider) setProvider(p.provider);
        setRememberKey(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  const info = providerInfo[provider];
  const expiresValid = useMemo(() => {
    const t = Date.parse(expiresAt);
    return Number.isFinite(t) && t > Date.now();
  }, [expiresAt]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setGenError("Pega contenido para generar el quiz");
      return;
    }
    if (info.needsKey && !apiKey.trim()) {
      setGenError("Ingresa tu API key o usa el modo local");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      let qs: QuizQuestion[];
      const prompt = buildPrompt(text, difficulty, numQuestions);
      const k = apiKey.trim();
      if (provider === "local") qs = generateLocal(text, difficulty, numQuestions);
      else if (provider === "openai") qs = await callOpenAI(k, prompt);
      else if (provider === "anthropic") qs = await callAnthropic(k, prompt);
      else qs = await callGemini(k, prompt);

      if (!Array.isArray(qs) || qs.length === 0)
        throw new Error("La IA no devolvió preguntas");

      setQuestions(qs);
      if (rememberKey && info.needsKey)
        localStorage.setItem(
          KEY_STORE,
          JSON.stringify({ apiKey: k, provider })
        );
      else if (!rememberKey) localStorage.removeItem(KEY_STORE);
      toast.success(`Generadas ${qs.length} preguntas`);
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : "Error al generar"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      toast.error("Genera el quiz primero");
      return;
    }
    if (title.trim().length < 2) {
      toast.error("Pon un título de al menos 2 caracteres");
      return;
    }
    if (!expiresValid) {
      toast.error("La fecha de vencimiento debe ser futura");
      return;
    }
    setSaving(true);
    try {
      const quiz = await createQuiz({
        title: title.trim(),
        difficulty,
        expiresAt,
        questions,
      });
      toast.success("Quiz guardado", {
        description: `Link: /q/${quiz.slug}`,
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al guardar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Mis quizzes
            </Link>
            <h1 className="mt-2 font-heading text-3xl font-bold text-primary">
              Crear quiz
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Genera con IA, configura el vencimiento y comparte el link.
            </p>
          </div>
        </header>

        {/* Paso 1 — generador */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">1. Generar preguntas</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Modelo
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm"
                >
                  {(Object.keys(providerInfo) as Provider[]).map((p) => (
                    <option key={p} value={p}>
                      {providerInfo[p].name}
                    </option>
                  ))}
                </select>
              </div>

              {info.needsKey && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">
                    API key
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={info.placeholder}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-mono"
                  />
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={rememberKey}
                        onChange={(e) => setRememberKey(e.target.checked)}
                      />
                      Recordar
                    </label>
                    {info.url && (
                      <a
                        href={info.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        Obtener →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Contenido del quiz
              </label>
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Pega aquí tus notas, capítulo, artículo, palabra clave..."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Dificultad
                </label>
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as "easy" | "medium" | "hard")
                  }
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <option value="easy">Fácil</option>
                  <option value="medium">Medio</option>
                  <option value="hard">Difícil</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  N° preguntas
                </label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm"
                >
                  {[5, 8, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !text.trim()}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-md hover:bg-accent/90 disabled:opacity-50"
              >
                {generating ? "Generando..." : "Generar"}
              </button>
            </div>

            {genError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {genError}
              </div>
            )}
          </div>

          <AnimatePresence>
            {questions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6"
              >
                <p className="mb-3 text-sm font-semibold text-success">
                  ✓ {questions.length} preguntas listas
                </p>
                <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border p-4 space-y-3">
                  {questions.map((q, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-semibold">
                        {i + 1}. {q.question}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Respuesta correcta: <strong>{q.correctAnswer}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Paso 2 — guardar */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">2. Configurar y compartir</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Título del quiz *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Quiz unidad 3 — Algoritmos"
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Vence el *
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Después de esta fecha el link queda invalido. Por defecto: 24h.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={
                saving ||
                questions.length === 0 ||
                title.trim().length < 2 ||
                !expiresValid
              }
              className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : questions.length === 0
                  ? "Genera el quiz primero"
                  : "Guardar y obtener link"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function defaultExpiry() {
  // datetime-local quiere "YYYY-MM-DDTHH:mm" en hora local
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
