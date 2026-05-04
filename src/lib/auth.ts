import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

const TOKEN_KEY = "quicesia_jwt_v1";
const TEACHER_KEY = "quicesia_teacher_v1";

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

interface AuthState {
  token: string | null;
  teacher: Teacher | null;
}

type Listener = (state: AuthState) => void;
const listeners = new Set<Listener>();

function readState(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const teacherRaw = localStorage.getItem(TEACHER_KEY);
    return {
      token: token || null,
      teacher: teacherRaw ? (JSON.parse(teacherRaw) as Teacher) : null,
    };
  } catch {
    return { token: null, teacher: null };
  }
}

function writeState(state: AuthState) {
  try {
    if (state.token) {
      localStorage.setItem(TOKEN_KEY, state.token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (state.teacher) {
      localStorage.setItem(TEACHER_KEY, JSON.stringify(state.teacher));
    } else {
      localStorage.removeItem(TEACHER_KEY);
    }
  } catch {
    // localStorage may be unavailable (Safari private mode); silently ignore.
  }
  for (const l of listeners) l(state);
}

export function getAuthToken(): string | null {
  return readState().token;
}

export function getCurrentTeacher(): Teacher | null {
  return readState().teacher;
}

export function setAuth(token: string, teacher: Teacher) {
  writeState({ token, teacher });
}

export function clearAuth() {
  writeState({ token: null, teacher: null });
}

/**
 * React hook que escucha cambios de auth y rerenderea.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => readState());
  useEffect(() => {
    const onChange = (s: AuthState) => setState(s);
    listeners.add(onChange);
    // sincronizar entre pestañas
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === TEACHER_KEY) {
        setState(readState());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return state;
}

// ============= API calls =============

interface AuthResponse {
  data: { token: string; teacher: Teacher };
}

export async function register(input: {
  nombre: string;
  email: string;
  password: string;
  programa?: string;
  materia?: string;
}): Promise<Teacher> {
  const res = await api.post<AuthResponse>("/api/auth/register", input);
  setAuth(res.data.token, res.data.teacher);
  return res.data.teacher;
}

export async function login(email: string, password: string): Promise<Teacher> {
  const res = await api.post<AuthResponse>("/api/auth/login", {
    email,
    password,
  });
  setAuth(res.data.token, res.data.teacher);
  return res.data.teacher;
}

export async function refreshTeacher(): Promise<Teacher | null> {
  try {
    const res = await api.get<{ data: Teacher }>("/api/auth/me");
    const cur = readState();
    if (cur.token) {
      setAuth(cur.token, res.data);
    }
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearAuth();
    }
    return null;
  }
}

export function logout() {
  clearAuth();
}
