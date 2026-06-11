# Aura Backend

Express and PostgreSQL API for Aura CRM. It serves customer, segment, campaign, analytics, receipt, and AI chat endpoints, and can also serve the built React frontend from `public/`.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set `DATABASE_URL`, `CHANNEL_SERVICE_URL`, `CRM_BASE_URL`, `INTERNAL_API_KEY`, and optionally `ANTHROPIC_API_KEY`. On startup, `server.js` calls `db/migrate.js`, which creates tables and seeds demo data for Noir & Thread.

## API Reference

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/api/customers` | Paginated customers with `tier`, `city`, `search` filters |
| GET | `/api/customers/:id` | Customer plus recent orders |
| POST | `/api/customers` | Create customer |
| POST | `/api/customers/bulk-import` | Import customer array |
| GET | `/api/segments` | List segments |
| POST | `/api/segments` | Create segment |
| POST | `/api/segments/preview` | Preview unsaved rules |
| GET | `/api/segments/:id/preview` | Preview saved segment |
| POST | `/api/segments/:id/refresh` | Refresh segment count |
| GET | `/api/campaigns` | List campaigns |
| GET | `/api/campaigns/:id` | Campaign detail and status breakdown |
| POST | `/api/campaigns` | Create draft campaign |
| POST | `/api/campaigns/:id/launch` | Launch campaign through channel service |
| GET | `/api/campaigns/:id/communications` | Campaign sends |
| POST | `/api/receipts/callback` | Delivery callback receiver |
| POST | `/api/ai/chat` | SSE Claude chat |
| GET | `/api/analytics/overview` | Dashboard metrics |
| GET | `/api/analytics/campaigns` | Campaign performance list |
| GET | `/api/analytics/messages-by-day` | 30-day message chart |

Responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": "...", "code": "..." }`.

## Schema

Tables: `customers`, `orders`, `segments`, `campaigns`, `communications`, `communication_events`, and `chat_messages`. `communication_events` makes callbacks idempotent with a `(communication_id, status)` primary key.

## Campaign Loop

```text
Marketer launches draft
  -> backend resolves segment rules into parameterized SQL
  -> backend inserts communications and personalizes messages
  -> backend POSTs batches of 50 to aura-channel
  -> channel immediately accepts and simulates lifecycle
  -> channel POSTs callbacks to /api/receipts/callback
  -> backend records event once and increments campaign counters
```
