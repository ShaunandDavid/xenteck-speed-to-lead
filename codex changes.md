# Codex Changes

## 2025-12-23

### Capture API: accept form posts (faster client integrations)
- Added a `LeadPayload` type and a `parseBody()` helper to handle:
  - `application/json`
  - `application/x-www-form-urlencoded`
  - `multipart/form-data`
  - Text fallback (tries JSON, then URL-encoded)
- Updated `POST /api/capture` to use `parseBody()` instead of `req.json()`, so plain HTML forms and `sendBeacon` URL-encoded payloads work without extra client-side JSON formatting.

Files:
- `src/app/api/capture/route.ts`

### First touch latency (fastest channel wins)
- Router now measures `first_touch_latency_ms` (earliest successful SMS or email) and uses it for the 5s target.
- Stats + dashboard now report first-touch latency for metrics and recent leads.

Files:
- `src/app/api/router/route.ts`
- `src/app/api/stats/route.ts`
- `src/app/page.tsx`
- `src/lib/types.ts`
- `src/lib/redis.ts`

### Build fix: form data parsing
- Replaced `formData.entries()` iteration with `formData.forEach()` to avoid TS downlevel iteration errors.

Files:
- `src/app/api/capture/route.ts`
