// Read-only: report the discovery agent's current post-call webhook binding.
// Run: node --env-file=<prod-env> scripts/check-agent-binding.mjs
const KEY = process.env.ELEVENLABS_API_KEY;
const AGENT = process.env.ELEVENLABS_AGENT_ID;
if (!KEY || !AGENT) {
  console.error('need ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID in env');
  process.exit(1);
}
const a = await (await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT}`, { headers: { 'xi-api-key': KEY } })).json();
const ps = a?.platform_settings || {};
const woBind = ps?.workspace_overrides?.webhooks?.post_call_webhook_id ?? null;
const topBind = ps?.post_call_webhook_id ?? null;
console.log(`agent ${AGENT} (${a?.name ?? '?'})`);
console.log(`  workspace_overrides.webhooks.post_call_webhook_id = ${woBind}`);
console.log(`  top_level.post_call_webhook_id (ignored by EL)      = ${topBind}`);
console.log(woBind ? '  => BOUND correctly (honoured field set)' : '  => NOT bound via the honoured field');
