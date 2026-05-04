import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import {
  deleteTeacher,
  listTeachers,
  type Teacher,
} from "@/lib/teachers";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/docentes/")({
  component: DocentesListPage,
});

function DocentesListPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTeachers();
      setTeachers(data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error desconocido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (teacher: Teacher) => {
    if (
      !window.confirm(
        `¿Eliminar al docente "${teacher.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setDeletingId(teacher.id);
    try {
      await deleteTeacher(teacher.id);
      toast.success(`Docente "${teacher.nombre}" eliminado.`);
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el docente."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Volver al inicio
            </Link>
            <h1 className="mt-2 font-heading text-3xl font-bold text-primary">
              Docentes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Cargando..."
                : `${teachers.length} ${teachers.length === 1 ? "docente registrado" : "docentes registrados"}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
            <Link
              to="/docentes/nuevo"
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              + Nuevo docente
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Error al cargar docentes</p>
            <p className="mt-1 text-xs leading-relaxed">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Verifica que el backend Railway esté vivo y que VITE_API_URL apunte a la URL correcta.
            </p>
          </div>
        )}

        {!loading && !error && teachers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-base font-semibold text-foreground">
              Aún no hay docentes registrados
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea el primer perfil para empezar.
            </p>
            <Link
              to="/docentes/nuevo"
              className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              Crear primer docente
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnimatePresence>
            {teachers.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading text-lg font-bold text-primary">
                    {t.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.avatarUrl}
                        alt={t.nombre}
                        className="h-full w-full rounded-xl object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      initials(t.nombre)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">
                      {t.nombre}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.email}
                    </p>
                    {(t.programa || t.materia) && (
                      <p className="mt-2 text-xs text-foreground/70">
                        {[t.programa, t.materia].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {t.bio && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {t.bio}
                      </p>
                    )}
                    <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Creado {new Date(t.createdAt).toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={deletingId === t.id}
                    className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                  >
                    {deletingId === t.id ? "..." : "Eliminar"}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
