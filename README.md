# Aura CRM

**Live Application URL**: [https://aura-backend-t8ni.onrender.com](https://aura-backend-t8ni.onrender.com)

Aura CRM is an AI-native mini CRM for a D2C fashion brand, Noir & Thread. It includes a Node/Express backend, PostgreSQL schema and seed data, a separate stubbed channel service, and a React/Vite frontend.

## Architecture

```text
React/Vite UI
   |
   v
aura-backend API  ----->  PostgreSQL
   |
   | campaign batches
   v
aura-channel
   |
   | lifecycle callbacks
   v
/api/receipts/callback
```

## Services

- `aura-backend`: Express REST API, PostgreSQL migrations, Claude SSE chat, static frontend serving
- `aura-channel`: stateless delivery simulator
- `aura-frontend`: React 18, Tailwind, Zustand, Recharts, Lucide

## Local Run

```bash
cd aura-channel
npm install
npm run dev

cd ../aura-backend
npm install
npm run dev

cd ../aura-frontend
npm install
npm run dev
```

For a single backend-hosted frontend build:

```bash
cd aura-frontend
npm install
npm run build
cd ../aura-backend
npm install
node scripts/copy-frontend.js
npm start
```

## Deployment URLs

Fill these after Render deployment:

- Backend/frontend: `https://aura-backend-t8ni.onrender.com`
- Channel: `(Deployed as a separate private/public service on Render)`

## Render Deployment

Create two Render web services from `aura-backend/render.yaml` and `aura-channel/render.yaml`. Add a PostgreSQL instance and set `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CHANNEL_SERVICE_URL`, `CRM_BASE_URL`, and `INTERNAL_API_KEY` on the backend.
