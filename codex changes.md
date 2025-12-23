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
