import { z } from "zod";
import { api, type ApiResponse } from "./api";

/**
 * Esquemas compartidos con el backend.
 * Mantén los strings/longitudes alineados con server/src/schemas.ts.
 */
export const teacherCreateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo inválido")
    .max(180, "Máximo 180 caracteres"),
  programa: z.string().trim().max(120).optional().or(z.literal("")),
  materia: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  avatarUrl: z
    .string()
    .trim()
    .url("Debe ser una URL válida")
    .optional()
    .or(z.literal("")),
});

export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;

export interface Teacher {
  id: string;
  nombre: string;
  email: string;
  programa: string | null;
  materia: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Limpia campos opcionales vacíos antes de enviar al backend.
 */
function normalize(input: TeacherCreateInput) {
  const out: Record<string, string | undefined> = {
    nombre: input.nombre.trim(),
    email: input.email.trim().toLowerCase(),
  };
  for (const key of ["programa", "materia", "bio", "avatarUrl"] as const) {
    const v = input[key];
    if (v && v.trim()) out[key] = v.trim();
  }
  return out;
}

export async function listTeachers() {
  const res = await api.get<ApiResponse<Teacher[]>>("/api/teachers");
  return res.data;
}

export async function getTeacher(id: string) {
  const res = await api.get<ApiResponse<Teacher>>(`/api/teachers/${id}`);
  return res.data;
}

export async function createTeacher(input: TeacherCreateInput) {
  const res = await api.post<ApiResponse<Teacher>>(
    "/api/teachers",
    normalize(input)
  );
  return res.data;
}

export async function updateTeacher(id: string, input: Partial<TeacherCreateInput>) {
  const res = await api.patch<ApiResponse<Teacher>>(
    `/api/teachers/${id}`,
    normalize(input as TeacherCreateInput)
  );
  return res.data;
}

export async function deleteTeacher(id: string) {
  return api.delete<ApiResponse<{ id: string }>>(`/api/teachers/${id}`);
}
