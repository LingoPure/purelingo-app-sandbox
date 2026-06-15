# LCI Bridge (Live Interpreter) — build state

**Date:** 2026-06-15
**Branch:** `feat/lci-bridge-interpreter` (NOT yet merged/deployed)
**Scope decided:** Route A — single-device, turn-based interpreter on LingoPure's
own stack (Whisper STT + Claude translate + ElevenLabs TTS). Route C (sidecar to
Zoom/Teams) is the documented later phase. Route B (own call app) rejected.

## DONE + VERIFIED (committed)

- `src/app/api/interpret/route.ts` — POST route: STT (gpt-4o-transcribe) → Claude
  Haiku translate (any direction, business register) → ElevenLabs multilingual
  TTS. Returns `{sourceText, translatedText, audioUrl}`. Public, fails loud.
- `src/app/lci-bridge/page.tsx` + `lci-bridge-client.tsx` — public page at
  **`/lci-bridge`**. Press-and-hold capture, EN⇄中文 picker, dual-text + auto-play,
  running conversation log. Mic-denied is explicit (no silent dead-end), mobile
  autoplay primed on first press, voice-leg failure degrades to text. Explanatory
  header + real tab title. Brand tokens (navy/paper/cream/gold/coral).
- `package.json`/`package-lock.json` — installed `@caistech/sayfix-embed` (was
  declared in b7a77e5 but never installed → 500'd whole app in local dev).

**Local verification (dev server, real APIs):**
- `/lci-bridge` → 200, correct title, header renders.
- `/api/interpret` no-audio → clean 400 JSON.
- **End-to-end en→zh PROVEN:** English wav → STT → `我们可以在六月交付第一批订单。
  价格和条款目前仍在审核中。` → 134KB Mandarin audio. (The mockup's exact scenario.)
- Reverse zh→en not locally testable (no Chinese SAPI voice) but it's the same
  direction-agnostic route with params swapped.

## NEXT STEPS (to demo tonight)

1. **Deploy** the branch to Vercel (preview or merge to main for prod
   `lingo-pure-ai.vercel.app/lci-bridge`). Ensure prod has `OPENAI_API_KEY`,
   `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (all already used by LingoPure).
2. **URL-SHARE GATE (blocking):** run `/naive-tester` against the deployed
   `/lci-bridge`, fix any ❌, then record the PASS via gate-check before the URL
   goes to anyone. Do NOT share the link until this passes.
3. Test on a real phone: mic permission prompt, autoplay, both directions.

## KNOWN / FLAGGED

- Committed `.npmrc` token is **expired** (401). Local install used the
  `GITHUB_PACKAGES_TOKEN` env. CI/Vercel use their own token. Rotate the .npmrc
  token separately.
- Cost runs on LingoPure's own keys (not BYOK). Fine for a founder demo; gate
  behind auth / BYOK before external rollout (R10/R12).
- Dev server may still be running on localhost:3000.
