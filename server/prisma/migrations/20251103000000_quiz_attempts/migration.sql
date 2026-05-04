-- Tabla de intentos de estudiantes (uno por submit).
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "student_name" TEXT,
    "answers" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts"("quiz_id");
CREATE INDEX "quiz_attempts_completed_at_idx" ON "quiz_attempts"("completed_at");

ALTER TABLE "quiz_attempts"
  ADD CONSTRAINT "quiz_attempts_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
