-- 0017_battery_seed_prompts.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 0b assessment-battery — first-cohort prompt content + final
-- gap_scores constraint shape so voice and battery scores can co-exist
-- per (student, skill).
--
-- Seeds two equivalent-difficulty prompts per task type at B2 (the LingoPure
-- target floor). Both prompts in each variant_bucket are interchangeable for
-- attempt 1 vs re-test. role_id is null = generic; per-role prompts can be
-- layered on later without schema changes.
--
-- All four task types are covered so the battery has content to render the
-- moment a student lands on /onboarding/battery.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 0. gap_scores: relax (student_id, skill) → (student_id, skill, source) ─
-- The voice scorer writes source='discovery'; the battery scorer writes
-- source='battery_task'. Both rows must be able to coexist for audit; the
-- dashboard reads `where is_canonical = true` to pick exactly one per skill.
do $$
declare
  v_constraint text;
begin
  select c.conname into v_constraint
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'gap_scores'
     and c.contype = 'u'
     and (
       select array_agg(a.attname order by k.ord)
         from unnest(c.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     ) = array['student_id'::name, 'skill'::name];
  if v_constraint is not null then
    execute format('alter table public.gap_scores drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.gap_scores
  drop constraint if exists gap_scores_student_skill_source_key;
alter table public.gap_scores
  add constraint gap_scores_student_skill_source_key
  unique (student_id, skill, source);

-- ─── 1. email_writing ──────────────────────────────────────────────────────
insert into public.discovery_task_prompts
  (task_type, role_id, difficulty_band, variant_bucket, prompt_public, prompt_private)
values
  (
    'email_writing', null, 'B2', 'b2-soft-ask',
    jsonb_build_object(
      'scenario',
        'A client (Mark Reynolds, Procurement Director, AusFresh Pty Ltd) emailed yesterday confirming Q3 volumes but stalled on the Q4 commitment because their forecast hasn''t been signed off. Your manager wants you to keep the conversation alive without sounding pushy and without conceding anything on price.',
      'persona',
        'You are the account lead. Mark is a long-standing client; the relationship matters more than this one quarter.',
      'target_word_count',
        jsonb_build_object('min', 120, 'max', 220),
      'instructions',
        'Write the email reply you would send. Aim for a professional, warm tone. Submit when you are happy with it.'
    ),
    jsonb_build_object(
      'rubric_anchors', jsonb_build_object(
        'register_tone',
          'B2 target: professional and warm; no slang; hedging is appropriate ("just wanted to check in", "whenever it suits"). Avoid both stiff/template language and over-familiar tone.',
        'structural_integrity',
          'Greeting referencing Mark by name; one-line acknowledgement of Q3 confirmation; soft probe on Q4 timing without demanding a date; offer to help (e.g. share latest forecast inputs); polite sign-off with name.',
        'strategic_content',
          'Must keep the door open for Q4 without conceding price or applying pressure. Strong responses subtly anchor the deadline (e.g. "before our planning lock on the 15th") without naming it as an ultimatum.',
        'lexical_range',
          'Expects business vocabulary in context: forecast, commitment, sign-off, timeline, alignment, planning cycle. Repeated reach for "good", "nice", "ok" drags the score down.'
      )
    )
  ),
  (
    'email_writing', null, 'B2', 'b2-soft-ask',
    jsonb_build_object(
      'scenario',
        'A teammate (Jenny Park, Logistics Manager) sent you a long email yesterday explaining that the Vietnamese supplier has missed the last two shipping windows and is asking for a rate increase. She is frustrated and wants you to "just deal with it". You need to push back on the rate increase without losing the supplier or the relationship with Jenny.',
      'persona',
        'You are the supplier-relations lead. Jenny is a peer; the supplier has been with you 4 years.',
      'target_word_count',
        jsonb_build_object('min', 120, 'max', 220),
      'instructions',
        'Write the email reply you would send to Jenny. Aim for a professional, warm tone. Submit when you are happy with it.'
    ),
    jsonb_build_object(
      'rubric_anchors', jsonb_build_object(
        'register_tone',
          'B2 target: collegial peer-to-peer register; acknowledge frustration without escalating; clear-eyed but not curt.',
        'structural_integrity',
          'Open by validating Jenny''s frustration; restate the two issues concisely; outline the specific next step (call the supplier, gather the data); commit to a timeline; sign off.',
        'strategic_content',
          'Must (a) not commit to the rate increase, (b) propose a specific investigation path, (c) avoid throwing the supplier under the bus. Strong responses separate the operational issue (missed windows) from the commercial ask (rate).',
        'lexical_range',
          'Expects: shipping window, root cause, escalation, mitigation, lead time, relationship. Repeated "good", "bad", "problem" drags the score down.'
      )
    )
  );

-- ─── 2. listen_paraphrase ──────────────────────────────────────────────────
-- audio_url points to our streaming TTS route. The student never sees the
-- transcript text — the route reads prompt_private.transcript via service
-- role and pipes it through ElevenLabs TTS.
insert into public.discovery_task_prompts
  (task_type, role_id, difficulty_band, variant_bucket, prompt_public, prompt_private)
values
  (
    'listen_paraphrase', null, 'B2', 'b2-quality-issue',
    jsonb_build_object(
      'instructions',
        'You will hear a 30-40 second voicemail from a colleague. You can only play it ONCE. Then type the three key points you heard, in your own words.',
      'plays_allowed', 1
      -- audio_url is set by the application from the prompt id, not stored
      -- here, so the seed row stays portable across environments.
    ),
    jsonb_build_object(
      'transcript',
        'Hi, it''s Sarah from Sydney. Just a heads-up — we''re seeing some quality variance on the last two pangasius shipments, fillet thickness specifically, running about eight percent under spec. Not catastrophic, the buyers haven''t pushed back yet, but I want it on your radar before Monday''s QBR. Can you have your QA team pull the production batch records and ping me by EOD Friday? Thanks.',
      'key_points', jsonb_build_array(
        'Quality variance on the last two pangasius shipments — fillet thickness about 8% under spec',
        'No buyer complaints yet, but Sarah wants it on your radar before Monday''s QBR',
        'Action: have your QA team pull the production batch records and reply by EOD Friday'
      )
    )
  ),
  (
    'listen_paraphrase', null, 'B2', 'b2-quality-issue',
    jsonb_build_object(
      'instructions',
        'You will hear a 30-40 second voicemail from a colleague. You can only play it ONCE. Then type the three key points you heard, in your own words.',
      'plays_allowed', 1
    ),
    jsonb_build_object(
      'transcript',
        'Hey, it''s David. Quick one — the new finance system rolled out this morning, but procurement raised a flag: any PO above fifty thousand now needs a second approver before it goes through. Means about a third of our weekly POs will be stuck waiting. We need you to nominate someone on your team as the secondary approver by Wednesday, otherwise our supplier payments will start backing up next week. Cheers.',
      'key_points', jsonb_build_array(
        'New finance-system rule: POs above $50,000 require a second approver',
        'Roughly a third of weekly POs will be blocked without action',
        'Action: nominate a secondary approver on your team by Wednesday or supplier payments back up next week'
      )
    )
  );

-- ─── 3. read_summarise ─────────────────────────────────────────────────────
insert into public.discovery_task_prompts
  (task_type, role_id, difficulty_band, variant_bucket, prompt_public, prompt_private)
values
  (
    'read_summarise', null, 'B2', 'b2-buried-ask',
    jsonb_build_object(
      'instructions',
        'Read the email below carefully — there is no time limit. Then write a 3-4 sentence summary in your own words: what is the surface ask, and is there anything else going on underneath?',
      'body',
        E'Hi team,\n\nFollowing up on the Q4 SKU review — could you confirm the final list before Tuesday''s budget meeting? I just want to make sure we''re aligned before things get locked in for the year.\n\nWhile you''re looking at it, the finance team has been asking some questions about the lower-volume lines (the three under 2,000 units a quarter). They''re not pushing for anything yet, but they''ve flagged the unit economics as ''worth a conversation'' and would like a paragraph from us on whether each one earns its slot for FY26. Nothing urgent — just helpful context for the meeting.\n\nAppreciate it.\n\nLeanne'
    ),
    jsonb_build_object(
      'surface_ask',
        'Confirm the final Q4 SKU list before Tuesday''s budget meeting.',
      'subtext',
        'Finance is questioning whether the three lower-volume lines (each under 2,000 units/quarter) should remain in FY26. Leanne is using soft language ("worth a conversation", "nothing urgent") but is effectively asking the team to defend each one. The "summary" is really a request for an SKU-rationalisation case.',
      'expected_summary_outline',
        'A strong summary names: (1) the explicit ask (confirm Q4 list), (2) the implicit ask (defend the 3 low-volume SKUs / unit economics review), (3) recognises the soft language as indirection, not casualness.'
    )
  ),
  (
    'read_summarise', null, 'B2', 'b2-buried-ask',
    jsonb_build_object(
      'instructions',
        'Read the email below carefully — there is no time limit. Then write a 3-4 sentence summary in your own words: what is the surface ask, and is there anything else going on underneath?',
      'body',
        E'Hi all,\n\nReally appreciate the work on the Singapore launch — the numbers in week one have been encouraging, and the team feedback has been positive.\n\nA quick admin one for Friday if you have a moment: could you send through the updated headcount sheet for the regional team, including any contractors currently on board? We''re putting together the FY26 op plan and want to make sure we''ve got an accurate picture going in.\n\nOn that note, the leadership group has been asking some general questions around span of control across the region — nothing specific to your team, but if you have any thinking on how the structure could evolve as we scale, it would be useful context for the planning conversation.\n\nThanks,\nMichael'
    ),
    jsonb_build_object(
      'surface_ask',
        'Send the updated headcount sheet (including contractors) by Friday for the FY26 op plan.',
      'subtext',
        'Leadership is examining "span of control" — that is corporate code for whether managers are managing too few or too many people, often a precursor to a restructure. Michael is inviting the team to pre-empt the conversation by surfacing their own structural thinking. The compliment in paragraph 1 is rapport-setting, not the point.',
      'expected_summary_outline',
        'A strong summary names: (1) the explicit ask (send headcount sheet by Friday), (2) the implicit ask (be ready to defend the team structure / propose evolution), (3) recognises "span of control" language as a restructure-readiness signal.'
    )
  );

-- ─── 4. vocab_cloze ────────────────────────────────────────────────────────
-- Packs 8 items into one prompt row. The student answers each in turn; one
-- discovery_task_responses row is written for the whole set with
-- response_json.answers[]. Items in the same variant_bucket are
-- equivalent-difficulty so re-test pulls a different bucket member.
insert into public.discovery_task_prompts
  (task_type, role_id, difficulty_band, variant_bucket, prompt_public, prompt_private)
values
  (
    'vocab_cloze', null, 'B2', 'b2-business-register',
    jsonb_build_object(
      'instructions',
        'Pick the option that best fits each sentence. There is one best answer per item. The choices look similar — read carefully.',
      'items', jsonb_build_array(
        jsonb_build_object('id','vc1','stem','We need to ____ the contract before the Q3 deadline.','options', jsonb_build_array('finalise','finish','end','close')),
        jsonb_build_object('id','vc2','stem','Their proposal is ____ what we discussed last week.','options', jsonb_build_array('exactly','precisely','accurately','strictly')),
        jsonb_build_object('id','vc3','stem','I''d like to ____ the meeting to next Tuesday if everyone''s available.','options', jsonb_build_array('reschedule','remove','redo','recall')),
        jsonb_build_object('id','vc4','stem','The supplier has ____ the timeline by two weeks due to a port closure.','options', jsonb_build_array('pushed back','put down','put off','pushed off')),
        jsonb_build_object('id','vc5','stem','Could you ____ the budget figures one more time before I forward them?','options', jsonb_build_array('verify','validate','vouch','vet')),
        jsonb_build_object('id','vc6','stem','The team is ____ to deliver the report by Friday.','options', jsonb_build_array('on track','on time','on point','on board')),
        jsonb_build_object('id','vc7','stem','We''ve flagged the issue ____ to legal for review.','options', jsonb_build_array('directly','straight','squarely','exactly')),
        jsonb_build_object('id','vc8','stem','Can you ____ the action items from yesterday''s call?','options', jsonb_build_array('summarise','shorten','simplify','sum up'))
      )
    ),
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('id','vc1','correct','finalise','difficulty_weight',1.0,'rationale','"Finalise" is the standard B2B verb for putting a contract in its final form. "Finish/end/close" all denote conclusion of an activity, not formalising an agreement.'),
        jsonb_build_object('id','vc2','correct','exactly','difficulty_weight',1.2,'rationale','"Exactly what we discussed" is the natural collocation. "Precisely" is close but more formal/measurement-flavoured; "accurately" implies factual correctness; "strictly" is wrong register here.'),
        jsonb_build_object('id','vc3','correct','reschedule','difficulty_weight',0.8,'rationale','"Reschedule" = move to a different time. The other options change different things ("remove" cancels, "redo" repeats, "recall" retrieves).'),
        jsonb_build_object('id','vc4','correct','pushed back','difficulty_weight',1.2,'rationale','"Pushed back the timeline" = delayed it. "Put off" works for an event but is awkward with timeline; "put down" and "pushed off" are not idiomatic.'),
        jsonb_build_object('id','vc5','correct','verify','difficulty_weight',1.0,'rationale','"Verify" = confirm correctness; the standard verb for double-checking budget figures. "Validate" is closer to approving fitness-for-purpose; "vouch" needs "for"; "vet" is broader background-check usage.'),
        jsonb_build_object('id','vc6','correct','on track','difficulty_weight',1.0,'rationale','"On track to deliver" = on schedule. "On time" is an outcome, not a forward-looking status; "on point" = sharp/relevant; "on board" = aligned.'),
        jsonb_build_object('id','vc7','correct','directly','difficulty_weight',1.4,'rationale','"Flagged directly to legal" = sent straight to them with no intermediary. "Straight" is informal; "squarely" implies forcefulness; "exactly" doesn''t collocate.'),
        jsonb_build_object('id','vc8','correct','summarise','difficulty_weight',1.0,'rationale','"Summarise the action items" = give a short version. "Sum up" works in speech but is informal; "shorten" implies reducing length, not extracting key points; "simplify" implies making easier to understand.')
      )
    )
  ),
  (
    'vocab_cloze', null, 'B2', 'b2-business-register',
    jsonb_build_object(
      'instructions',
        'Pick the option that best fits each sentence. There is one best answer per item. The choices look similar — read carefully.',
      'items', jsonb_build_array(
        jsonb_build_object('id','vc1','stem','I''d like to ____ a few minutes at the end of the call to discuss next steps.','options', jsonb_build_array('set aside','put away','hold up','keep back')),
        jsonb_build_object('id','vc2','stem','The board ____ the proposal pending further analysis.','options', jsonb_build_array('deferred','delayed','denied','dropped')),
        jsonb_build_object('id','vc3','stem','Can you ____ this to the Sydney team — they need it for tomorrow.','options', jsonb_build_array('forward','pass','send out','redirect')),
        jsonb_build_object('id','vc4','stem','Our Q2 numbers are slightly ____ what we forecast.','options', jsonb_build_array('above','over','beyond','past')),
        jsonb_build_object('id','vc5','stem','We''ll need to ____ approval from the regional office before signing.','options', jsonb_build_array('seek','search','find','look for')),
        jsonb_build_object('id','vc6','stem','The new policy ____ from the first of next month.','options', jsonb_build_array('takes effect','takes place','takes off','takes on')),
        jsonb_build_object('id','vc7','stem','Could you ____ Maria on the latest figures before her client meeting?','options', jsonb_build_array('brief','inform','tell','update')),
        jsonb_build_object('id','vc8','stem','The supplier has ____ a 5% rate increase for next year.','options', jsonb_build_array('proposed','suggested','put up','put forward'))
      )
    ),
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('id','vc1','correct','set aside','difficulty_weight',1.2,'rationale','"Set aside time" = reserve time. "Put away" = store; "hold up" = delay or rob; "keep back" = withhold.'),
        jsonb_build_object('id','vc2','correct','deferred','difficulty_weight',1.4,'rationale','"Deferred" = formally postponed for later consideration. "Delayed" implies unwanted slowing; "denied" = refused; "dropped" = abandoned.'),
        jsonb_build_object('id','vc3','correct','forward','difficulty_weight',0.8,'rationale','"Forward" = standard email verb for sending on. "Pass" needs "on to"; "send out" = broadcast widely; "redirect" implies it was misaddressed.'),
        jsonb_build_object('id','vc4','correct','above','difficulty_weight',1.4,'rationale','"Above forecast" is the established business-English collocation. "Over" works in speech but is less formal in written reporting; "beyond" and "past" sound off-register.'),
        jsonb_build_object('id','vc5','correct','seek','difficulty_weight',1.0,'rationale','"Seek approval" is fixed business collocation. "Search" needs an object you find; "find" implies it''s already there; "look for" is informal.'),
        jsonb_build_object('id','vc6','correct','takes effect','difficulty_weight',1.2,'rationale','"Takes effect" = becomes operative. "Takes place" = happens (event); "takes off" = becomes successful or departs; "takes on" = accepts/hires.'),
        jsonb_build_object('id','vc7','correct','brief','difficulty_weight',1.2,'rationale','"Brief Maria on" = give a focused update before an event. "Inform" is more general; "tell" is too informal; "update" works but lacks the pre-event implication.'),
        jsonb_build_object('id','vc8','correct','proposed','difficulty_weight',1.0,'rationale','"Proposed" is the formal verb for putting forward a commercial change. "Suggested" is softer/optional; "put up" and "put forward" both fit but "proposed" is the conventional best fit in commercial register.')
      )
    )
  );
