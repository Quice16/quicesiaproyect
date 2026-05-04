-- Wipe the test data from the previous schema. The single record was a smoke
-- test without password and cannot be salvaged for the auth-enabled model.
DELETE FROM "teachers";

-- Add password_hash to teachers (NOT NULL, no default — table must be empty).
ALTER TABLE "teachers" ADD COLUMN "password_hash" TEXT NOT NULL;

-- Quizzes table.
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "questions" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quizzes_slug_key" ON "quizzes"("slug");
CREATE INDEX "quizzes_teacher_id_idx" ON "quizzes"("teacher_id");
CREATE INDEX "quizzes_expires_at_idx" ON "quizzes"("expires_at");

ALTER TABLE "quizzes"
  ADD CONSTRAINT "quizzes_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
