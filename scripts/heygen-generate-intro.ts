/**
 * One-shot generator for Aria's "Meet your coach" intro video.
 *
 * Renders a ~60s pre-recorded clip (NOT a per-user render — the whole point
 * of using HeyGen here is one-time cost, infinite plays). Output lands in
 * `public/videos/aria-intro.mp4` so it's served as a static asset by Vercel.
 *
 * Usage:
 *   # First time: list public avatars to pick one
 *   npx tsx scripts/heygen-generate-intro.ts --list-avatars
 *   npx tsx scripts/heygen-generate-intro.ts --list-voices
 *
 *   # Then generate (uses CONFIG below):
 *   npx tsx scripts/heygen-generate-intro.ts
 *
 *   # Or override on the CLI:
 *   npx tsx scripts/heygen-generate-intro.ts \
 *     --avatar Daisy-inskirt-20220818 --voice 1bd001e7e50f421d891986aad5158bc8
 *
 * Cost: roughly $1 for the render (Public Avatar III tier, ~60s clip).
 * Re-run any time you want to refresh the script or swap avatars.
 */

import { config as loadEnv } from "dotenv";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  generateVideo,
  getVideoStatus,
  listAvatars,
  listVoices,
} from "../src/lib/heygen/client";

loadEnv({ path: ".env.local" });
loadEnv();

// --- CONFIG ----------------------------------------------------------------
// Edit these once, commit, re-run when you want to refresh the intro.
//
// Pick avatar/voice IDs from `--list-avatars` and `--list-voices` output.
// HeyGen has hundreds of public avatars; we want something that reads as a
// professional, warm female coach (Aria's persona in dictionary.ts).

const CONFIG = {
  // Public-tier avatar. "Daisy" is one of HeyGen's long-standing public
  // defaults — change after running `--list-avatars` if you'd prefer a
  // different look.
  avatarId: process.env.HEYGEN_AVATAR_ID ?? "Daisy-inskirt-20220818",

  // Voice — "Allison", a real HeyGen English female voice (verified live
  // 2026-05). Pick a different one from `--list-voices` if you'd rather
  // a Hope, Cassidy, Jenny, etc.
  voiceId:
    process.env.HEYGEN_VOICE_ID ?? "f8c69e517f424cafaecde32dde57096b",

  // Roughly 55-65 seconds when read at conversational pace. Keep it tight —
  // students will skip a 90-second intro. Match Aria's tone in the live
  // session (warm, low-pressure, mixes affirmation with light direction).
  script: `Hi! I'm Aria, your discovery coach at LingoPure.

In a few minutes we'll have a short conversation, about fifteen minutes long, so I can understand where your English is strongest and where I can help you grow.

There are no right or wrong answers. Just be yourself, answer in whatever feels natural, and let me hear how you actually use English at work.

When you're ready, click Start session below. Talk soon!`,

  // Cream paper colour from the LingoPure palette — matches the rest of the
  // onboarding page so the video doesn't look pasted in.
  backgroundHex: "#f5efe6",

  // Output path — public assets are served as-is by Vercel CDN.
  outputPath: join(process.cwd(), "public", "videos", "aria-intro.mp4"),
};
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 10 * 60_000; // 10 min ceiling

async function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has("--list-avatars")) {
    const avatars = await listAvatars();
    console.log(`\n${avatars.length} avatars:\n`);
    for (const a of avatars.slice(0, 50)) {
      console.log(
        `  ${a.avatar_id.padEnd(40)}  ${a.avatar_name}${
          a.gender ? ` (${a.gender})` : ""
        }`
      );
    }
    if (avatars.length > 50) {
      console.log(`  ... and ${avatars.length - 50} more`);
    }
    return;
  }

  if (args.has("--list-voices")) {
    const voices = await listVoices();
    const en = voices.filter((v) =>
      (v.language ?? "").toLowerCase().startsWith("en")
    );
    console.log(`\n${en.length} English voices (of ${voices.length} total):\n`);
    for (const v of en.slice(0, 50)) {
      console.log(
        `  ${v.voice_id.padEnd(36)}  ${v.name.padEnd(28)} ${v.gender} ${
          v.language
        }`
      );
    }
    return;
  }

  // CLI overrides
  const av = (() => {
    const i = process.argv.indexOf("--avatar");
    return i >= 0 ? process.argv[i + 1] : CONFIG.avatarId;
  })();
  const vo = (() => {
    const i = process.argv.indexOf("--voice");
    return i >= 0 ? process.argv[i + 1] : CONFIG.voiceId;
  })();

  console.log(`Avatar: ${av}`);
  console.log(`Voice:  ${vo}`);
  console.log(`Script: ${CONFIG.script.length} chars`);
  console.log(`Output: ${CONFIG.outputPath}`);
  console.log("");

  console.log("Submitting render...");
  const videoId = await generateVideo({
    avatarId: av,
    voiceId: vo,
    text: CONFIG.script,
    backgroundHex: CONFIG.backgroundHex,
  });
  console.log(`  video_id = ${videoId}`);

  const start = Date.now();
  let videoUrl: string | null = null;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await getVideoStatus(videoId);
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`  [${elapsed}s] status=${status.status}`);
    if (status.status === "completed" && status.videoUrl) {
      videoUrl = status.videoUrl;
      break;
    }
    if (status.status === "failed") {
      throw new Error(`HeyGen render failed: ${status.error ?? "unknown"}`);
    }
  }
  if (!videoUrl) throw new Error("HeyGen render timed out after 10 min");

  console.log(`\nDownloading from ${videoUrl}...`);
  const dl = await fetch(videoUrl);
  if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  await mkdir(join(process.cwd(), "public", "videos"), { recursive: true });
  await writeFile(CONFIG.outputPath, buf);
  console.log(`Saved ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB → ${CONFIG.outputPath}`);
  console.log(`\nNext: commit public/videos/aria-intro.mp4 and redeploy.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
