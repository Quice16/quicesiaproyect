# QuizUQGenerator

Generador académico de quizzes con IA — Universidad del Quindío.
Incluye módulo de **gestión de perfiles de docentes** con backend propio.

## Arquitectura

```
quicesiaproyect/
├─ src/                    # Frontend SPA (React + TanStack Router + Tailwind v4)
│  ├─ components/          # QuizGenerator + shadcn/ui
│  ├─ routes/              # /, /docentes, /docentes/nuevo
│  └─ lib/                 # Cliente API + helpers
├─ index.html              # Entrada SPA
├─ vite.config.ts          # Build Vite limpio (sin Cloudflare)
├─ vercel.json             # Rewrites SPA -> arregla el 404 de rutas profundas
└─ server/                 # Backend (Hono + Prisma + PostgreSQL)
   ├─ src/                 # API REST
   ├─ prisma/              # Schema + migraciones
   └─ railway.json         # Config de despliegue Railway
```

- **Frontend → Vercel** (sitio estático, SPA)
- **Backend → Railway** (Node + PostgreSQL)
- **Comunicación:** el frontend llama al backend vía `VITE_API_URL`

## Desarrollo local

### 1. Instalar dependencias

```bash
# Frontend
npm install

# Backend
cd server
npm install
```

### 2. Levantar la base de datos local

Necesitas un Postgres corriendo. Opción rápida con Docker:

```bash
docker run --name quiz-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

### 3. Configurar variables de entorno

```bash
# Raíz del proyecto (frontend)
cp .env.example .env
# Edita .env -> VITE_API_URL=http://localhost:3001

# Backend
cp server/.env.example server/.env
# Edita server/.env -> DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

### 4. Migrar y arrancar

```bash
# Backend
cd server
npm run migrate:deploy   # crea las tablas
npm run dev              # API en http://localhost:3001

# En otra terminal: Frontend
npm run dev              # SPA en http://localhost:5173
```

Abre `http://localhost:5173` y haz clic en **"Crear perfil de docente"**.

## API — endpoints disponibles

Base: `https://<railway-url>/api/teachers`

| Método | Path                  | Descripción              |
|--------|-----------------------|--------------------------|
| GET    | `/api/teachers`       | Lista todos              |
| GET    | `/api/teachers/:id`   | Obtener uno              |
| POST   | `/api/teachers`       | Crear                    |
| PATCH  | `/api/teachers/:id`   | Actualizar parcialmente  |
| DELETE | `/api/teachers/:id`   | Eliminar                 |

Health: `GET /health` → `{ "status": "ok" }`

### Modelo `Teacher`

```ts
{
  id: string;
  nombre: string;          // 2–120 chars (requerido)
  email: string;           // único, válido (requerido)
  programa?: string;       // <=120
  materia?: string;        // <=120
  bio?: string;            // <=1000
  avatarUrl?: string;      // URL, <=500
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

## Despliegue

### Backend → Railway

1. Crea un proyecto nuevo en [Railway](https://railway.app/) y conecta este repositorio.
2. **Importante:** en "Service settings", define el **Root Directory** como `server`.
3. Agrega el plugin **PostgreSQL** al proyecto. Railway inyectará `DATABASE_URL` automáticamente.
4. (Opcional) Variables de entorno del servicio:
   - `CORS_ORIGINS=https://tu-app.vercel.app,http://localhost:5173`
   - `NODE_ENV=production`
5. Railway leerá `server/railway.json`:
   - Build: `npm install && npm run build`
   - Start: `npm run migrate:deploy && npm start`
   - Healthcheck: `/health`
6. Toma la URL pública del servicio (algo como `https://xxx.up.railway.app`) — la usarás en el frontend.

### Frontend → Vercel

1. Importa el repo en [Vercel](https://vercel.com/).
2. Vercel detecta automáticamente Vite gracias a `vercel.json`. Settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Variable de entorno:
   - `VITE_API_URL` = `https://xxx.up.railway.app` (la URL de Railway, sin slash final).
4. Deploy.

### El 404 en Vercel ya está resuelto

`vercel.json` agrega un rewrite que sirve `index.html` para cualquier ruta interna:

```json
"rewrites": [
  { "source": "/((?!assets/|favicon\\.ico|robots\\.txt).*)", "destination": "/index.html" }
]
```

Esto es lo que TanStack Router (en modo SPA) necesita para que `/docentes` o `/docentes/nuevo` funcionen al recargar o entrar directo por URL.

## Cambios realizados al cambiar de Cloudflare → Vercel + Railway

- Eliminado `wrangler.jsonc`, `bunfig.toml`, `bun.lockb` (Cloudflare-only).
- Removidas dependencias `@tanstack/react-start`, `@cloudflare/vite-plugin`, `@lovable.dev/vite-tanstack-config`.
- `vite.config.ts` ahora es Vite + React + Tailwind + TanStack Router plugin.
- Agregados `index.html` y `src/main.tsx` como entrada SPA.
- `__root.tsx` simplificado (sin `shellComponent`, `HeadContent`, `Scripts` de SSR).
- Meta tags ahora viven en `index.html`.
- Nuevo subdirectorio `server/` con backend completo.

## Créditos

Diseñado por **Ing. Andrés Felipe Quiceno** y **Juan Diego Jaramillo** — Universidad del Quindío.
