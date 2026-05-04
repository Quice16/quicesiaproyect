import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { login } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormInput = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormInput) => {
    setSubmitting(true);
    try {
      const teacher = await login(values.email, values.password);
      toast.success(`Hola, ${teacher.nombre}`);
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
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Inicio
          </Link>
          <h1 className="font-heading text-3xl font-bold text-primary">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Solo docentes registrados
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lg"
          noValidate
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-semibold"
            >
              Correo institucional
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="docente@uniquindio.edu.co"
              {...register("email")}
              className={inputCls(!!errors.email)}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className={inputCls(!!errors.password)}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="font-semibold text-primary hover:underline">
              Regístrate
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
