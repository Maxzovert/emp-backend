# EmployeeAI — Backend

Express API for EmployeeAI: authentication, employee CRUD, per-user **AI provider settings** (Gemini / OpenAI), and LangChain chat — backed by Neon Postgres.

> **Add your own API key.** Copy `.env.example` → `.env` and set `GOOGLE_API_KEY` / `OPENAI_API_KEY` with **your** credentials, or leave them blank and have each user paste a key under **Settings → AI models**. Do not commit real keys.

**Live:** [https://emp-backend-4wcb.onrender.com](https://emp-backend-4wcb.onrender.com)  
**Health:** [https://emp-backend-4wcb.onrender.com/health](https://emp-backend-4wcb.onrender.com/health)

Companion UI: see [`../frontend`](../frontend) · [https://employeeai-blue.vercel.app](https://employeeai-blue.vercel.app)  
Full HTTP reference: [`../API.md`](../API.md)

---

## Stack

| Piece | Choice |
|-------|--------|
| Runtime | Node.js (ESM) |
| Framework | Express 5 |
| Database | Neon Postgres (`@neondatabase/serverless`) |
| Auth | `bcryptjs` + `jose` JWT cookie (`employeeai_session`) |
| AI | LangChain + `@langchain/google-genai` / `@langchain/openai` |
| Secrets | AES-256-GCM encryption for user API keys (`lib/auth/secrets.js`) |
| CORS | `cors` + `FRONTEND_URL` allowlist |
| Deploy | Render |

If `DATABASE_URL` is missing, employee reads can fall back to an in-memory demo store. **Auth and AI settings require a real database.**

---

## Folder structure

```
backend/
├── index.js
├── routes/
│   ├── auth.js           # auth + /ai-settings
│   ├── employees.js
│   └── chat.js           # SSE chat (uses resolveChatModelConfig)
├── db/
│   ├── users.js          # profile + encrypted AI keys + schema migrate
│   ├── employees.js
│   └── …
├── lib/auth/
│   ├── session.js
│   ├── password.js
│   └── secrets.js        # encrypt/decrypt user API keys
├── services/
│   ├── authService.js
│   └── ai/               # model factory, prompts, context, stream
├── scripts/
├── .env.example
└── package.json
```

---

## Prerequisites

- Node.js **18+** (20+ recommended)
- npm
- Neon Postgres URL
- **Your own** Gemini and/or OpenAI API key (for chat — via `.env` and/or Settings UI)

---

## Setup

```bash
cd backend
cp .env.example .env
# fill DATABASE_URL, AUTH_SECRET
# add YOUR OWN GOOGLE_API_KEY and/or OPENAI_API_KEY (or leave blank and use Settings → AI models)

npm install
npm run db:setup
npm run dev
```

API: **http://localhost:3001**

On first authenticated AI-settings request, `users` gains columns:

- `ai_provider`
- `gemini_api_key_enc`
- `openai_api_key_enc`

### Get API keys

| Provider | Where to create **your** key |
|----------|------------------------------|
| Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) |

Paste the key into `.env`, or sign in to the app and save it under **Settings → AI models**.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes* | Neon URL |
| `AUTH_SECRET` | Yes | JWT signing **and** AI key encryption material |
| `PORT` | No | Default `3001` |
| `FRONTEND_URL` | Prod | CORS origins (comma-separated) |
| `AI_PROVIDER` | No | Fallback default: `gemini` or `openai` |
| `AI_MODEL_NAME` | No | Default `gemini-3.5-flash-lite` |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Optional* | **Your own** Gemini key (unlocks Gemini globally) |
| `OPENAI_API_KEY` | Optional* | **Your own** OpenAI key (unlocks OpenAI globally) |
| `NODE_ENV` | Prod | `production` |
| `FRONTEND_DIST` | No | Optional SPA static path |

\*Chat needs a key in env **or** a per-user key saved in Settings. Always use keys you own.

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=replace-with-a-long-random-string
PORT=3001
FRONTEND_URL=http://localhost:5173

AI_PROVIDER=gemini
AI_MODEL_NAME=gemini-3.5-flash-lite
# Replace with YOUR keys — never commit real values
GOOGLE_API_KEY=your-own-gemini-api-key
# OPENAI_API_KEY=your-own-openai-api-key
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with `.env` |
| `npm start` | Production (Render) |
| `npm run db:migrate` | Employees schema |
| `npm run db:seed` | Demo employees |
| `npm run db:seed-users` | Users + demo account |
| `npm run db:setup` | migrate + seeds |

---

## API reference (summary)

### Health

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/api/health` |

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/register` | Create user + cookie |
| `POST` | `/login` | Login + cookie |
| `POST` | `/logout` | Clear cookie |
| `GET` | `/me` | Current user |
| `PATCH` | `/profile` | Update profile |
| `GET` | `/ai-settings` | Provider list, lock/active state (**auth required**) |
| `PATCH` | `/ai-settings` | Set provider / save or clear keys (**auth required**) |

#### AI settings shapes

**GET** returns (keys never included):

```json
{
  "success": true,
  "settings": {
    "provider": "gemini",
    "providers": [
      {
        "id": "gemini",
        "label": "Gemini",
        "configured": true,
        "locked": false,
        "hasUserKey": true,
        "source": "user"
      },
      {
        "id": "openai",
        "label": "OpenAI",
        "configured": false,
        "locked": true,
        "hasUserKey": false,
        "source": null
      }
    ]
  }
}
```

`source`: `"user"` | `"server"` | `null`.

**PATCH** body (all optional):

```json
{
  "provider": "openai",
  "geminiApiKey": "AIza…",
  "openaiApiKey": "sk-…",
  "clearGemini": false,
  "clearOpenai": false
}
```

Selecting a **locked** provider → `400`. User keys are encrypted with AES-256-GCM before storage.

### Employees — `/api/employees`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | `?q=&department=` |
| `POST` | `/` | Create |
| `PATCH` | `/:id` | Status: `active` \| `away` \| `inactive` |
| `DELETE` | `/:id` | Delete |

### Chat — `/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | `{ message, history?, stream? }` |

Resolution order for the model:

1. Signed-in user’s `ai_provider` + decrypted user key (if any)  
2. Else server env key for that provider  
3. Else fallback to whichever server provider is available  
4. If none → `503` with a message to configure Settings → AI models (**add your own API key**)  

SSE events when `stream` is true (default): `status`, `token`, `done`, `error`.  
`meta.provider` is included on successful replies.

---

## Demo user (after `db:seed-users`)

| Field | Value |
|-------|--------|
| Email | `john.carter@employeeai.app` |
| Password | `password123` |

Use this account (or any registered user) to open **Settings → AI models** and **add your own API key**.

---

## Production behavior

- **CORS** — `FRONTEND_URL` / `CLIENT_URL`; localhost allowed in non-prod  
- **Static SPA** — only if `frontend/dist` (or `FRONTEND_DIST`) exists; otherwise API-only  
- **Render start** — `npm start`  
- **Health check** — `/health`

---

## Deploy (Render)

1. Root directory: `backend`
2. Build: `npm install` · Start: `npm start`
3. Env: `DATABASE_URL`, `AUTH_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, plus **your own** AI keys if you want server-wide unlock
4. Health: `/health`
5. Once: `npm run db:setup` on the same database

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| AI settings 401 | User must be signed in |
| Provider locked | **Add your own API key** in Settings, or set server `GOOGLE_API_KEY` / `OPENAI_API_KEY` to a key you own |
| Chat 503 not configured | No usable key — paste yours in Settings or `.env` |
| Cannot switch to OpenAI | Unlock OpenAI first, then PATCH `provider` |
| Encryption / decrypt fails | Keep `AUTH_SECRET` stable; changing it invalidates stored user keys |
| CORS from Vercel | Set `FRONTEND_URL` to the exact frontend origin |

---

## Related

- Frontend README: [`../frontend/README.md`](../frontend/README.md)
- Root README: [`../README.md`](../README.md)
- API instructions: [`../API.md`](../API.md)
