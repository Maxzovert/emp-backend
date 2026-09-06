# EmployeeAI Backend

Express API - auth, employees, AI chat (LangChain + Gemini/OpenAI), Neon Postgres.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# fill DATABASE_URL, AUTH_SECRET, GOOGLE_API_KEY (or GEMINI_API_KEY)

npm run db:setup
npm run dev
```

API: http://localhost:3001

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API (loads `.env` / `.env.local`) |
| `npm start` | Production API (also serves `../frontend/dist`) |
| `npm run db:setup` | Migrate + seed employees + demo user |
