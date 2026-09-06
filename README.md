# EmployeeAI — Backend

Express API for EmployeeAI: authentication, employee CRUD, and LangChain AI chat (Gemini by default, OpenAI optional), backed by Neon Postgres.

**Live:** [https://emp-backend-4wcb.onrender.com](https://emp-backend-4wcb.onrender.com)  
**Health:** [https://emp-backend-4wcb.onrender.com/health](https://emp-backend-4wcb.onrender.com/health)

Companion UI: see [`../frontend`](../frontend) · [https://employeeai-blue.vercel.app](https://employeeai-blue.vercel.app)

---

## Stack

| Piece | Choice |
|-------|--------|
| Runtime | Node.js (ESM) |
| Framework | Express 5 |
| Database | Neon Postgres (`@neondatabase/serverless`) |
| Auth | `bcryptjs` + `jose` JWT cookie (`employeeai_session`) |
| AI | LangChain + `@langchain/google-genai` / `@langchain/openai` |
| CORS | `cors` + `FRONTEND_URL` allowlist |
| Deploy | Render |

If `DATABASE_URL` is missing or Neon is down, employee reads fall back to an in-memory demo store. Auth still requires a real database.

---

## Folder structure

```
backend/
├── index.js              # Express app entry
├── routes/
│   ├── auth.js           # /api/auth/*
│   ├── employees.js      # /api/employees/*
│   └── chat.js           # /api/chat (SSE)
├── db/                   # Neon client, employees, users, seed helpers
├── data/                 # Demo employee data / store
├── lib/auth/             # session JWT + password hashing
├── services/
│   ├── authService.js
│   └── ai/               # model, prompts, context, aiService
├── utils/
├── scripts/              # migrate, seed, run-with-env
├── .env.example
└── package.json
```

---

## Prerequisites

- Node.js **18+** (20+ recommended)
- npm
- [Neon](https://neon.tech) Postgres connection string
- Gemini API key ([Google AI Studio](https://aistudio.google.com/)) **or** OpenAI API key

---

## Setup

```bash
cd backend
cp .env.example .env
```

Fill `.env` (see below), then:

```bash
npm install
npm run db:setup
npm run dev
```

API listens on **http://localhost:3001** (or `PORT`).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes* | Neon Postgres URL (*needed for auth + persisted employees) |
| `AUTH_SECRET` | Yes | Secret used to sign JWTs |
| `PORT` | No | Default `3001` (Render injects `PORT`) |
| `FRONTEND_URL` | Prod | Allowed CORS origin(s), comma-separated. Example: `https://employeeai-blue.vercel.app` |
| `CLIENT_URL` | No | Alias of `FRONTEND_URL` |
| `NODE_ENV` | Prod | `production` on Render |
| `AI_PROVIDER` | No | `gemini` (default) or `openai` |
| `AI_MODEL_NAME` | No | Default `gemini-3.5-flash-lite` |
| `GOOGLE_API_KEY` | Gemini | Preferred Gemini key |
| `GEMINI_API_KEY` | Gemini | Alternate Gemini key |
| `OPENAI_API_KEY` | OpenAI | When `AI_PROVIDER=openai` |
| `FRONTEND_DIST` | No | Optional path to a built SPA `index.html` to serve from this process |

Example `.env`:

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=replace-with-a-long-random-string
PORT=3001
FRONTEND_URL=http://localhost:5173

AI_PROVIDER=gemini
AI_MODEL_NAME=gemini-3.5-flash-lite
GOOGLE_API_KEY=your-key
```

Never commit `.env`. Use `.env.example` as the template.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with `.env` / `.env.local` via `scripts/run-with-env.mjs` |
| `npm start` | Start server (uses process env — for Render) |
| `npm run db:migrate` | Create `employees` table |
| `npm run db:seed` | Upsert demo employees (`-- --reset` clears first) |
| `npm run db:seed-users` | Ensure `users` table + demo account |
| `npm run db:setup` | migrate + seed employees + seed users |

---

## API reference

### Health

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | Keep-alive for Render / uptime pings |
| `GET` | `/api/health` | Same payload |

Response shape: `{ ok, status, uptime, timestamp }`.

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/register` | Body: `name`, `email`, `password`, optional `department`, `position` → sets cookie |
| `POST` | `/login` | Body: `email`, `password` → sets cookie |
| `POST` | `/logout` | Clears cookie |
| `GET` | `/me` | Current user or `401` |
| `PATCH` | `/profile` | Update name/email/department/position |

Session cookie: `employeeai_session` (HTTP-only). In production with `FRONTEND_URL` set, cookies use `SameSite=None; Secure` for cross-site clients. Prefer Vercel `/api` rewrites so cookies stay same-site.

### Employees — `/api/employees`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Query: `q`, `department` → list + departments metadata |
| `POST` | `/` | Create employee |
| `PATCH` | `/:id` | Update `status` (`active` \| `away` \| `inactive`) |
| `DELETE` | `/:id` | Delete employee |

### Chat — `/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Body: `{ message, history?, stream? }` |

- Default `stream: true` → SSE (`text/event-stream`) with events: `status`, `token`, `done`, `error`
- `stream: false` → JSON `{ success, message, meta }`

AI context is built from employee records (no emails), with a short cache (~30s). Model thinking is disabled for lower latency.

---

## Demo user (after `db:seed-users`)

| Field | Value |
|-------|--------|
| Email | `john.carter@employeeai.app` |
| Password | `password123` |

---

## Production behavior

- **CORS** — whitelist from `FRONTEND_URL` / `CLIENT_URL`; localhost origins allowed in non-production
- **Static SPA** — only if a built `index.html` exists under `FRONTEND_DIST`, `./public`, or `../frontend/dist`; otherwise API-only (typical on Render)
- **Start command on Render** — `npm start`
- **Health check path** — `/health`

---

## Deploy (Render)

1. Create a **Web Service**
2. Root directory: `backend`
3. Build: `npm install`
4. Start: `npm start`
5. Env: `DATABASE_URL`, `AUTH_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, AI keys + `AI_PROVIDER` / `AI_MODEL_NAME`
6. Health check: `/health`
7. Once: run `npm run db:setup` against the same database (local machine or Render shell)

Optional: ping `/health` on a schedule to reduce free-tier spin-down.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Missing DATABASE_URL` | Ensure `.env` has no UTF-8 BOM; `run-with-env` loads `.env.local` or `.env` |
| Login fails / 401 | Run `npm run db:seed-users`; confirm `AUTH_SECRET` is stable across restarts |
| CORS errors from Vercel | Set `FRONTEND_URL=https://employeeai-blue.vercel.app` (no trailing slash) and redeploy |
| AI errors | Check `GOOGLE_API_KEY` / `GEMINI_API_KEY` or `OPENAI_API_KEY`; verify model id |
| AI slow | Use `gemini-3.5-flash-lite`; Render cold starts add latency on first request |
| `ENOENT` … `frontend/dist` | Safe to ignore on API-only deploys — static serving is skipped when dist is missing |

---

## Related

- Frontend README: [`../frontend/README.md`](../frontend/README.md)
- Monorepo overview: [`../README.md`](../README.md)
