# XenTeck Speed-to-Lead System

**Sub-5-second lead response with timestamped proof.**

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                                 │
├─────────────────────────────────────────────────────────────────────┤
│   /api/capture (Edge)  →  /api/router  →  /api/sms + /api/email    │
│        < 150ms              < 200ms          Parallel dispatch       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      UPSTASH REDIS                                  │
│   Lead Ledger  │  Dedupe Cache  │  Availability Cache               │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/ShaunandDavid/xenteck-speed-to-lead.git
cd xenteck-speed-to-lead
npm install
```

### 2. Set Up Upstash Redis (FREE)

1. Go to [upstash.com](https://upstash.com)
2. Create account → Create Redis database
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 3. Set Up Telnyx (Pay-as-you-go)

1. Go to [portal.telnyx.com](https://portal.telnyx.com)
2. Create an API key
3. Buy/assign a sending phone number

### 4. Set Up Google OAuth (FREE)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → Enable Gmail API + Calendar API
3. Create OAuth credentials
4. Get refresh token using OAuth playground

### 5. Configure Environment

```bash
cp .env.example .env.local
# Fill in all values
```

### 6. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect GitHub repo to Vercel dashboard for auto-deploy.

## API Endpoints

### POST /api/capture
Entry point for leads. Returns in < 150ms.

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "source": "website",
  "headache": "Need faster lead response"
}
```

Response:
```json
{
  "status": "received",
  "leadId": "lead_1702000000000_4567",
  "capture_latency_ms": 45,
  "timestamp": "2024-12-08T12:00:00.000Z"
}
```

### GET /api/stats
Dashboard metrics.

### GET /api/book?days=7
Available booking slots.

### POST /api/book
Confirm a booking.

## Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| Capture | p95 < 150ms | Initial lead receipt |
| Router | p95 < 200ms | Dedupe + dispatch |
| Total | p99 < 5s | Lead received → first touch |

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── capture/route.ts   ← Edge function, entry point
│   │   ├── router/route.ts    ← Hot router, dedupe
│   │   ├── sms/route.ts       ← Telnyx SMS
│   │   ├── email/route.ts     ← Gmail API
│   │   ├── book/route.ts      ← Calendar booking
│   │   └── stats/route.ts     ← Dashboard metrics
│   ├── book/
│   │   └── [leadId]/page.tsx  ← Booking UI
│   └── page.tsx               ← Dashboard
└── lib/
    ├── redis.ts               ← Upstash helpers
    └── types.ts               ← TypeScript types
```

## Cost Breakdown

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | $0 |
| Upstash Redis | Free | $0 (10k commands/day) |
| Telnyx | Pay-as-you-go | ~$0.0079/SMS |
| Gmail API | Free | $0 |
| Google Calendar | Free | $0 |

**Infrastructure: $0/month**
**Per lead: ~$0.02** (SMS cost)

## Webhook Integration

Point your forms/CRMs to:
```
POST https://your-domain.vercel.app/api/capture
Content-Type: application/json
```

Works with:
- Webflow forms
- Typeform webhooks
- HubSpot workflows
- GHL webhooks
- Zapier/Make.com
- Any HTTP POST

## License

Proprietary - XenTeck / Level 7 Media LLC
