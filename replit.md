# LifeGuard AI

A mobile-first installable PWA emergency and health assistant. Uses the device's accelerometer and GPS to detect falls and crashes in real time, triggers a 15-second emergency countdown, broadcasts GPS coordinates, and provides an AI-powered conversational companion for safety guidance and first aid.

## Run & Operate

- `pnpm --filter @workspace/lifeguard-ai run dev` — run the frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, TanStack Query, wouter, Recharts, framer-motion
- API: Express 5, Node.js
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v3), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- PWA: Web App Manifest + Service Worker (cache-first, offline ready)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for API contracts
- `lib/db/src/schema/` — Database schema (emergencySessions, contacts, chatSessions, chatMessages, gpsBroadcasts)
- `artifacts/api-server/src/routes/` — Express route handlers (emergency, contacts, chat, gps, stats)
- `artifacts/api-server/src/lib/aiCompanion.ts` — Rule-based AI response engine for chat
- `artifacts/api-server/src/lib/serialize.ts` — Date serializer (Drizzle → ISO strings for Zod)
- `artifacts/lifeguard-ai/src/pages/` — React pages (Dashboard, Emergency, Chat, Contacts, History)
- `artifacts/lifeguard-ai/src/hooks/` — Custom hooks: useSensorEngine, useGpsEngine, useEmergencyCountdown
- `artifacts/lifeguard-ai/public/manifest.json` — PWA manifest
- `artifacts/lifeguard-ai/public/sw.js` — Service worker (offline caching)

## Architecture decisions

- **Zod v3 + Orval v8.23**: Orval generates `zod.int()` (Zod v4 API) for integer fields; workaround is to use `type: number` in the OpenAPI spec and patch the generated file post-codegen (see `serializeDates` issue).
- **serializeDates helper**: Drizzle returns `Date` objects for timestamp columns, but Orval-generated Zod schemas expect ISO strings. All route handlers wrap DB results with `serializeDates()` from `artifacts/api-server/src/lib/serialize.ts` before calling `.parse()`.
- **Stable hook refs**: `useGpsEngine` and `useEmergencyCountdown` use `useRef` internally for mutable state (`watchId`, `isActive`) so their returned callbacks are stable across renders and don't trigger infinite `useEffect` loops.
- **Rule-based AI**: Chat AI companion uses a keyword/context matcher in `aiCompanion.ts`. Replace with a real LLM via Replit AI Integrations for production use.
- **Dark-mode only**: The app enforces dark mode as default — appropriate for an emergency safety tool.

## Product

- **Dashboard**: Live SAFE/ALERT status, pulsing SOS button, GPS location widget, stats summary, recent emergency log
- **Sensor Engine (/emergency)**: Real-time accelerometer waveform (Recharts), fall/crash detection (25 m/s² threshold), 15-second countdown overlay with cancel/confirm
- **AI Chat (/chat)**: Conversational safety companion with first aid guidance, quick-prompt chips, session history
- **Contacts (/contacts)**: Emergency contact manager with primary contact designation
- **History (/history)**: Log of past emergency events with status badges and GPS coordinates

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen`, then patch `lib/api-zod/src/generated/api.ts` replacing `zod.int()` with `zod.number()` (Zod v3 compat).
- `type: integer` in the OpenAPI spec triggers `zod.int()` generation — always use `type: number` instead.
- Sensor hooks (`useSensorEngine`, `useGpsEngine`) must keep their returned callbacks stable (via refs) to avoid infinite render loops in components that put them in `useEffect` dependency arrays.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
