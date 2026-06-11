# Aura Channel

Stateless delivery simulator for Aura CRM. It accepts batches at `POST /send`, returns immediately, then posts lifecycle callbacks to the CRM.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Service health check |
| POST | `/send` | Accepts `{ communications, callback_url }` |

## Delivery Model

- 90% delivered
- 60% opened after delivery
- 30% clicked after open
- 15% converted after click
- Failed callbacks stop the lifecycle

Callbacks are sent as:

```json
{
  "updates": [
    { "communication_id": "uuid", "status": "delivered", "timestamp": "2026-06-11T00:00:00.000Z" }
  ]
}
```

If the first callback attempt fails, the service retries once after two seconds.
