import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import {
  createTeacher,
  teacherCreateSchema,
  type TeacherCreateInput,
} from "@/lib/teachers";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/docentes/nuevo")({
  component: NuevoDocentePage,
});

function NuevoDocentePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<TeacherCreateInput>({
    resolver: zodResolver(teacherCreateSchema),
    mode: "onBlur",
    defaultValues: {
      nombre: "",
      email: "",
      programa: "",
      materia: "",
      bio: "",
      avatarUrl: "",
    },
  });

  const onSubmit = async (values: TeacherCreateInput) => {
    setSubmitting(true);
    try {
      const teacher = await createTeacher(values);
      toast.success(`Docente "${teacher.nombre}" creado correctamente.`);
      reset();
      navigate({ to: "/docentes" });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message, {
          description: err.status ? `HTTP ${err.status}` : undefined,
        });
      } else {
        toast.error(
          err instanceof Error ? err.message : "Error desconocido"
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Volver al inicio
            </Link>
            <h1 className="mt-2 font-heading text-3xl font-bold text-primary">
              Crear perfil de docente
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Universidad del Quindío · Registro de docentes
            </p>
          </div>
          <Link
            to="/docentes"
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Ver listado
          </Link>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-lg"
          noValidate
        >
          <Field
            label="Nombre completo *"
            htmlFor="nombre"
            error={errors.nombre?.message}
          >
            <input
              id="nombre"
              type="text"
              autoComplete="name"
              placeholder="Andrés Felipe Quiceno"
              {...register("nombre")}
              className={inputCls(!!errors.nombre)}
            />
          </Field>

          <Field
            label="Correo electrónico institucional *"
            htmlFor="email"
            error={errors.email?.message}
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="docente@uniquindio.edu.co"
              {...register("email")}
              className={inputCls(!!errors.email)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Programa / Facultad"
              htmlFor="programa"
              error={errors.programa?.message}
            >
              <input
                id="programa"
                type="text"
                placeholder="Ingeniería de Sistemas"
                {...register("programa")}
                className={inputCls(!!errors.programa)}
              />
            </Field>
            <Field
              label="Materia / Área"
              htmlFor="materia"
              error={errors.materia?.message}
            >
              <input
                id="materia"
                type="text"
                placeholder="Algoritmos y Estructuras"
                {...register("materia")}
                className={inputCls(!!errors.materia)}
              />
            </Field>
          </div>

          <Field
            label="URL de avatar (opcional)"
            htmlFor="avatarUrl"
            error={errors.avatarUrl?.message}
          >
            <input
              id="avatarUrl"
              type="url"
              placeholder="https://..."
              {...register("avatarUrl")}
              className={inputCls(!!errors.avatarUrl)}
            />
          </Field>

          <Field
            label="Biografía / Descripción (opcional)"
            htmlFor="bio"
            error={errors.bio?.message}
          >
            <textarea
              id="bio"
              rows={4}
              placeholder="Breve descripción del docente, áreas de interés, etc."
              {...register("bio")}
              className={inputCls(!!errors.bio) + " resize-none"}
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => reset()}
              disabled={submitting}
              className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={submitting || !isValid}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Guardando..." : "Crear docente"}
            </button>
          </div>
        </motion.form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Los datos se envían al backend Railway vía{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">
            POST /api/teachers
          </code>
        </p>
      </div>
    </div>
  );
}

function inputCls(invalid: boolean) {
  const base =
    "w-full rounded-xl border bg-background p-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary";
  return invalid
    ? `${base} border-destructive focus:ring-destructive`
    : `${base} border-border focus:border-transparent`;
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-semibold text-foreground"
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
