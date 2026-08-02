---
name: OpenAI Integration Setup
description: How the Replit AI Integrations OpenAI proxy was wired into LifeGuard AI — voice AI and real chat completions.
---

# OpenAI Integration in LifeGuard AI

## What was done
- Provisioned via `setupReplitAIIntegrations({ providerSlug: "openai" })` — sets `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` automatically.
- Template libs copied from `.local/skills/ai-integrations-openai/templates/lib/` into `lib/`.
- Two new packages: `lib/integrations-openai-ai-server/` (Express/Node) and `lib/integrations-openai-ai-react/` (hooks).
- DB tables: `conversations` and `messages` (in `lib/db/src/schema/` — re-exported from schema index).

## Routes
- All OpenAI routes live in `artifacts/api-server/src/routes/openai/index.ts` mounted at `/api/openai/...`.
- Text SSE: POST `/api/openai/conversations/:id/messages` — streams `gpt-5.6-luna` completions.
- Voice SSE: POST `/api/openai/conversations/:id/voice-messages` — uses `voiceChatStream()` with `gpt-audio`.
- Express body limit raised to `50mb` in `app.ts` for audio payloads.

## Frontend
- Chat page (`artifacts/lifeguard-ai/src/pages/Chat.tsx`) uses SSE fetch (not React Query) for streaming.
- Voice uses `useVoiceRecorder` + `useVoiceStream` from `@workspace/integrations-openai-ai-react/audio`.
- Audio worklet at `artifacts/lifeguard-ai/public/audio-playback-worklet.js`.
- `WORKLET_PATH` constructed from `import.meta.env.BASE_URL` to handle proxy path.

## Key gotchas
- `voiceChatStream()` returns `AsyncIterable<{ type: "transcript" | "audio"; data: string }>` — no `"user_transcript"` event type from server side.
- `useListOpenaiMessages(id ?? 0)` — pass `0` when no conversation yet (returns empty); avoid passing `{ query: { enabled } }` options as `UseQueryOptions` requires `queryKey` in TanStack v5.
- `lib/integrations-openai-ai-react` needs `@types/react` and `@types/node` in devDependencies, and the `useVoiceRecorder` MediaStreamTrack type must be explicit: `(t: MediaStreamTrack) => t.stop()`.
- Zod v3 + Orval v8.23: always patch `zod.int()` → `zod.number()` after codegen.

**Why:** `useVoiceStream` handles audio playback internally via AudioWorklet PCM16 streaming — do not try to play audio chunks manually.
