-- 0031: LingoPure 2K — durable assessment-audio storage (ISS-016).
-- Private bucket for learner response audio. Server writes objects via the
-- service role; clients never get direct object access — the /audio upload
-- route audits + writes, and playback/transcription use signed URLs via the
-- service role. Private by default: audio is personal data (consent-gated).

insert into storage.buckets (id, name, public)
values ('2k-assessment-audio', '2k-assessment-audio', false)
on conflict (id) do nothing;

-- No public storage policies: object access is service-role only. This mirrors
-- the dataroom pattern (0020) — clients get signed URLs, never the bucket.

-- Audiences for the listener/owner rows are enforced by the route, not storage.