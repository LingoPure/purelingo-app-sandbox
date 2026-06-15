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

## STATUS: SHIPPED + GATE GREEN (2026-06-15)

- **LIVE:** https://lingo-pure-ai.vercel.app/lci-bridge (prod, commit 5f9fb88,
  deployment dpl_8WWroSp2X4LXkkV1rLFashCSzsRq).
- **Prod end-to-end PROVEN:** English audio → `我们对您的报价很满意，希望能尽快签署
  合同。` + Mandarin audio. All three keys present in prod.
- **naive-tester PASS recorded** (slug `lingo-pure-ai`), url-share gate = ALLOWED.
- **Fixed blockers from first pass:** SayFix pill overlapping the talk button
  (hidden on this page via ConditionalSayFix), mic-error UX (actionable +
  resets), captions ≥16px. Mobile re-test = GO, all standards ✅.

## STILL WORTH DOING (not blocking tonight)

1. **Smoke-test one full turn on the ACTUAL presentation device** (a phone with a
   real mic) — testers confirmed everything except the live mic round-trip
   (their browser had no mic); the server pipeline is proven, but confirm the
   browser mic-grant + playback on the real device before going live in the room.
2. Use **headphones or low speaker volume** so the spoken translation doesn't
   echo back into the next capture.
3. Minor: 11px kicker label ("LINGOPURE · LCI BRIDGE") is sub-12px; demo banner
   eats ~17% of mobile height (global chrome, not page-specific).

## KNOWN / FLAGGED

- Committed `.npmrc` token is **expired** (401). Local install used the
  `GITHUB_PACKAGES_TOKEN` env. CI/Vercel use their own token. Rotate the .npmrc
  token separately.
- Cost runs on LingoPure's own keys (not BYOK). Fine for a founder demo; gate
  behind auth / BYOK before external rollout (R10/R12).
- Dev server may still be running on localhost:3000.
