import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { register as doRegister } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const schema = z.object({
  nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(180),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(200, "Máximo 200 caracteres"),
  programa: z.string().trim().max(120).optional().or(z.literal("")),
  materia: z.string().trim().max(120).optional().or(z.literal("")),
});
type FormInput = z.infer<typeof schema>;

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
});

function RegistroPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: "",
      email: "",
      password: "",
      programa: "",
      materia: "",
    },
  });

  const onSubmit = async (values: FormInput) => {
    setSubmitting(true);
    try {
      const teacher = await doRegister({
        nombre: values.nombre,
        email: values.email,
        password: values.password,
        programa: values.programa || undefined,
        materia: values.materia || undefined,
      });
      toast.success(`Cuenta creada para ${teacher.nombre}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error desconocido";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Inicio
          </Link>
          <h1 className="font-heading text-3xl font-bold text-primary">
            Crear cuenta de docente
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Universidad del Quindío · Registro de docentes
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-lg"
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
              {...register("nombre")}
              className={inputCls(!!errors.nombre)}
            />
          </Field>

          <Field
            label="Correo institucional *"
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

          <Field
            label="Contraseña *"
            htmlFor="password"
            error={errors.password?.message}
            hint="Mínimo 8 caracteres"
          >
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className={inputCls(!!errors.password)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                placeholder="Algoritmos"
                {...register("materia")}
                className={inputCls(!!errors.materia)}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear cuenta"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link
              to="/login"
              className="font-semibold text-primary hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

function inputCls(invalid: boolean) {
  const base =
    "w-full rounded-xl border bg-background p-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary";
  return invalid
    ? `${base} border-destructive focus:ring-destructive`
    : `${base} border-border`;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
