# LingoPure — Test Protocol

**Audience:** Thao, Dan, Shamni
**Date:** September 2026
**Environment:** Vercel Sandbox (`uovbwccvxgdghqvlpuql` Supabase)
**Status:** Ready for execution

---

## 1. What We're Testing

LingoPure is a Business English platform for Vietnam and Southeast Asia. It has three service packages — **1:1 Tutoring**, **Tutor + AI**, and **Full BPO** — but all three share the **same universal learner flow**. Only the data sources feeding the curriculum differ.

This protocol walks you through every portal and every critical flow. Tick each step as you go.

---

## 2. Before You Start

### 2.1 Access

| Item | Detail |
|---|---|
| **App URL** | `https://<vercel-sandbox-url>` — provided by Dennis before each session |
| **Supabase project** | `uovbwccvxgdghqvlpuql` (LingoPure Sandbox, Mumbai region) |
| **Test account** | `dennis@factory2key.com.au` |
| **Password** | Stored in the team password manager — **never written here** |

### 2.2 Devices

- **Desktop:** Chrome (latest) on Windows or Mac
- **Mobile:** Safari on iPhone OR Chrome on Android
- Test both desktop and mobile for every portal

### 2.3 Dependencies

The following services must be running for the app to function correctly:

| Service | What it does | Status check |
|---|---|---|
| **OmniRoute** or **Anthropic** | LLM for scoring, lessons, i18n | Lesson submit returns 200, not 500 |
| **Resend** | All outgoing emails | Check inbox after signup/demo |
| **ElevenLabs** | Voice discovery session (Aria) | Discovery session launches without error |
| **Supabase** | Database, auth, RLS | Login works, data loads |

### 2.4 How to Report Bugs

For every bug you find, record:

1. **What you did** (the exact steps)
2. **What you expected** to happen
3. **What actually happened** (include screenshot)
4. **Which portal** (Student / Employer / Investor / Admin / Marketing)
5. **Device + browser** (e.g., "Chrome 131 on Windows 11")

Submit via the SayFix widget (if visible on screen) or email to the team.

---

## 3. Student Portal

This is the core learner experience — what every student sees after signing up.

### 3.1 Signup

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.1.1 | Go to `/signup` | Page loads with name, email, password fields | ☐ |
| 3.1.2 | Fill in the form and submit | Account created, redirected to onboarding | ☐ |
| 3.1.3 | Check email inbox | Confirmation/magic-link email arrives within 2 minutes | ☐ |

### 3.2 Discovery Session (Voice)

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.2.1 | Go to `/onboarding` | "Meet Aria" page loads with 6 dimensions explained | ☐ |
| 3.2.2 | Confirm your role + native language | Language picker works, role confirmed | ☐ |
| 3.2.3 | Click "Start discovery session" | ElevenLabs voice session launches in-browser | ☐ |
| 3.2.4 | Speak with Aria for ~20 minutes | Conversation flows naturally, Aria asks about your role, goals, challenges | ☐ |
| 3.2.5 | Session ends | Redirected to dashboard or battery | ☐ |

**Note:** The discovery session requires a working microphone. Use headphones to avoid echo. If the session fails to launch, check that ElevenLabs is configured and the browser has microphone permission.

### 3.3 Battery (Assessment Tasks)

After the discovery session, four tasks run in sequence:

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.3.1 | Email writing task | Write a business email (~250-400 words), submit, see progress bar | ☐ |
| 3.3.2 | Listen & paraphrase task | Play audio clip once, type 3 key points, submit | ☐ |
| 3.3.3 | Read & summarise task | Read a business email, write 3-4 sentence summary, submit | ☐ |
| 3.3.4 | Vocabulary cloze task | Fill in blanks / pick the correct word (8-10 items), submit | ☐ |
| 3.3.5 | After all 4 tasks | Redirected to dashboard with scores | ☐ |

**Note:** If a task fails to load or submit, note the task name and the error message. Tasks can be interrupted and resumed — close the tab at task 2, reopen, and check that task 2 resumes (not restarts from task 1).

### 3.4 Dashboard

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.4.1 | View dashboard | Gap radar visible, 6 skill scores shown (0-1000 scale) | ☐ |
| 3.4.2 | Check skill bars | Each bar shows: numeric score, LP-18 band (e.g. B2.3), CEFR band (e.g. B2) | ☐ |
| 3.4.3 | Check "Now" vs "Target" badges | Two badges at the top showing current level and target level | ☐ |
| 3.4.4 | Check recommended plan | Gap-driven lesson recommendations appear (email sprint, speak & score, or class) | ☐ |
| 3.4.5 | Check gamification | XP counter, streak counter, progress bar visible | ☐ |
| 3.4.6 | Check certification card | Shows whether you're eligible for CEFR exam | ☐ |
| 3.4.7 | Check "Next class" section | Shows scheduled class or "No class scheduled" message | ☐ |
| 3.4.8 | Check "Recent activity" | Activity feed visible (may be empty for new accounts) | ☐ |

### 3.5 Lessons

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.5.1 | Click "Start lesson" on an email sprint recommendation | Lesson page loads with scenario, task, timer | ☐ |
| 3.5.2 | Write an email and submit | Email is scored, feedback appears, XP awarded, scores update on dashboard | ☐ |
| 3.5.3 | Click "Start lesson" on a speak & score recommendation | Recording interface loads, browser asks for microphone permission | ☐ |
| 3.5.4 | Record 60-90 seconds and submit | Audio is transcribed, scored, feedback appears, XP awarded | ☐ |
| 3.5.5 | Return to dashboard | Updated scores reflected in skill bars and gap radar | ☐ |

### 3.6 Progress Check-in

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.6.1 | Run a progress check-in | Scores refresh, new data point appears on trend chart | ☐ |
| 3.6.2 | Check progress chart | Trend line shows movement over time (first check-in shows "This is your first check-in") | ☐ |

### 3.7 Settings

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 3.7.1 | Go to Settings | Name, email displayed correctly | ☐ |
| 3.7.2 | Change name | Save works, new name persists | ☐ |
| 3.7.3 | Change password | Old password required, new password works on next login | ☐ |

---

## 4. Employer Portal

This is what the company admin sees — managing their team's learning.

### 4.1 Login & Overview

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.1.1 | Go to `/login?redirectTo=/employer` | Login page loads | ☐ |
| 4.1.2 | Sign in with employer admin credentials | Redirected to `/employer` cohort overview | ☐ |
| 4.1.3 | Check overview tiles | Active students, lessons completed, live classes, certified, at-target — all show numbers | ☐ |
| 4.1.4 | Check cohort gap radar | Radar chart visible showing team-wide skill gaps | ☐ |
| 4.1.5 | Check role coverage cards | Roles created by the org are listed with baseline scores | ☐ |
| 4.1.6 | Check activity feed | Recent activity across the team is listed | ☐ |

### 4.2 Staff Management

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.2.1 | Go to Staff tab | Staff list loads with names, emails, roles | ☐ |
| 4.2.2 | Click "Invite staff" | Form appears for name, email, department, role assignment | ☐ |
| 4.2.3 | Fill in invite form and submit | Invitation email sent (check Resend), invitee appears in staff list as "pending" | ☐ |
| 4.2.4 | Go to "Import" tab | CSV upload interface loads | ☐ |

### 4.3 Roles

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.3.1 | Go to Roles tab | Role list loads (may be empty for new orgs) | ☐ |
| 4.3.2 | Click "Create role" | Two options: AI consultant interview OR manual entry | ☐ |
| 4.3.3 | Select AI consultant | 5-minute voice interview launches to determine role baselines | ☐ |
| 4.3.4 | OR select manual entry | 6 slider inputs for speaking, listening, writing, reading, vocab, presenting | ☐ |
| 4.3.5 | Submit role | Role appears in list with baseline scores | ☐ |
| 4.3.6 | Click into a role | Detail page shows baseline comparison and student coverage | ☐ |

### 4.4 Departments

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.4.1 | Go to Departments tab | Department list loads | ☐ |
| 4.4.2 | Create/edit a department | Department saves and appears in list | ☐ |

### 4.5 Student Detail

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.5.1 | Go to Students tab | Student roster loads with scores | ☐ |
| 4.5.2 | Click into a student | Detail page shows: gap bars, profile, target level, learning style | ☐ |
| 4.5.3 | Check Phase 0b artefacts tab | Battery task results visible (if completed) | ☐ |
| 4.5.4 | Check recent lessons | Lesson history shown | ☐ |

### 4.6 Teachers

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.6.1 | Go to Teachers tab | Teacher list loads | ☐ |
| 4.6.2 | Click into a teacher | Assignments visible (primary + specialist students) | ☐ |

### 4.7 Candidates (Recruitment Filter)

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 4.7.1 | Go to Candidates tab | Candidate console loads | ☐ |
| 4.7.2 | Click "Invite candidate" | Form appears: candidate email, role assignment | ☐ |
| 4.7.3 | Send invite | Email with magic link sent to candidate | ☐ |
| 4.7.4 | Candidate clicks link | Lands on `/screen/[token]` — sees company name, role, "Start assessment" CTA | ☐ |
| 4.7.5 | Candidate completes assessment | Results appear in employer's Candidates tab | ☐ |

---

## 5. Investor Portal

This is the investment dataroom — for potential investors to explore the business.

### 5.1 Login & Ask

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 5.1.1 | Go to `/investor/login` | Login page loads (invite-only, no public signup) | ☐ |
| 5.1.2 | Sign in with investor credentials | Redirected to `/investor/ask` | ☐ |
| 5.1.3 | Ask a question about the business | Cited answer appears with source references | ☐ |
| 5.1.4 | Ask a follow-up question | Answer references prior context | ☐ |

### 5.2 Documents

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 5.2.1 | Go to Documents tab | File browser loads with categories (financials, legal, technology, GTM, market, team) | ☐ |
| 5.2.2 | Open a document | Watermarked PDF loads, access is logged | ☐ |

### 5.3 NDA Gate

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 5.3.1 | Go to `/investor/nda` | NDA page loads | ☐ |
| 5.3.2 | Accept NDA | Tier upgrades to "restricted" — deeper documents now visible | ☐ |
| 5.3.3 | Return to Documents | Restricted sources appear alongside main sources | ☐ |

### 5.4 Reports

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 5.4.1 | Go to Reports tab | Report generation interface loads | ☐ |
| 5.4.2 | Generate a report | Report synthesised from dataroom, watermarked PDF available | ☐ |

---

## 6. Marketing Pages

These are the public-facing pages — what a potential customer sees before signing up.

### 6.1 Homepage

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 6.1.1 | Go to `/` | Hero section loads with headline and CTAs | ☐ |
| 6.1.2 | Scroll through sections | Fork (companies/individuals), How it works, Proof, Outcomes, Final CTA — all render | ☐ |
| 6.1.3 | Check nav links | "For companies", "For individuals", "Method", "The report" — all navigate correctly | ☐ |
| 6.1.4 | Check footer | Company info, legal, links, "Languages" display | ☐ |
| 6.1.5 | Click "Start free assessment" CTA | Navigates to `/signup` | ☐ |

### 6.2 Language Toggle

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 6.2.1 | Click language pill in nav | Dropdown shows language options with flags | ☐ |
| 6.2.2 | Select "Tiếng Việt" | Nav links, hero, fork, how-it-works, proof, outcomes, final CTA, footer — all translate to Vietnamese | ☐ |
| 6.2.3 | `<html lang="vi">` | Language attribute on the page changes | ☐ |
| 6.2.4 | Switch back to English | Everything reverts to English | ☐ |

### 6.3 Book a Demo

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 6.3.1 | Go to `/book-a-demo` | Showcase page with 3-step wizard loads | ☐ |
| 6.3.2 | Complete step 1 (your details) | Name, email, company, role fields validate | ☐ |
| 6.3.3 | Complete step 2 (team details) | Team size, current English level, goals fields | ☐ |
| 6.3.4 | Complete step 3 (what you need) | Package interest, timeline, additional notes | ☐ |
| 6.3.5 | Submit | Confirmation appears, booking saved to database | ☐ |
| 6.3.6 | Check email | Two emails arrive: internal alert (to sales) + customer confirmation | ☐ |

### 6.4 Sub-Pages

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 6.4.1 | `/for-companies` | B2B landing page loads with relevant CTA | ☐ |
| 6.4.2 | `/for-individuals` | B2C landing page loads with relevant CTA | ☐ |
| 6.4.3 | `/method` | Methodology page loads | ☐ |
| 6.4.4 | `/company` | Company information page loads | ☐ |
| 6.4.5 | `/privacy` | Privacy policy page loads | ☐ |
| 6.4.6 | `/terms` | Terms of service page loads | ☐ |

---

## 7. Assessment Flows (Advanced)

These tests cover the full 2K assessment engine — the most complex part of the platform.

### 7.1 2K Assessment

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 7.1.1 | Start assessment from `/assessment` | 25-question journey begins, question 1 of 25 shown | ☐ |
| 7.1.2 | Record audio for questions 1-5 (LOCATE stage) | Audio records, uploads, next question loads | ☐ |
| 7.1.3 | Complete through RESOLVE stage (Q6-15) | Questions get progressively harder, audio continues recording | ☐ |
| 7.1.4 | Complete through PERTURB stage (Q16-20) | Edge-case questions, challenging scenarios | ☐ |
| 7.1.5 | Complete CONFIRM stage (Q21-25) | Final questions, assessment completes | ☐ |
| 7.1.6 | Check results at `/assessment/results/[id]` | Three sections render: (1) Where You Stand, (2) What's Holding You Back, (3) How To Improve | ☐ |

### 7.2 Battery Report Email

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 7.2.1 | Complete all 4 battery tasks | Battery marks as complete | ☐ |
| 7.2.2 | Check email inbox (within 5 minutes) | Battery report email arrives with LP-18 scores and "Book a demo" CTA | ☐ |
| 7.2.3 | Click "Book a demo" link in email | Navigates to `/book-a-demo` | ☐ |

---

## 8. Email Verification

| Step | Action | Expected result | Tick |
|---|---|---|---|
| 8.1 | Signup email | Confirmation email arrives from `LingoPure <noreply@lingopure.com>` | ☐ |
| 8.2 | Magic-link login | Click link in email → logged in, redirected to dashboard | ☐ |
| 8.3 | Battery report | LP-18 scores + Book-a-demo CTA in email | ☐ |
| 8.4 | Demo booking confirmation | Customer-facing email confirms booking details | ☐ |
| 8.5 | Staff invite | Invitee receives magic-link to join the platform | ☐ |
| 8.6 | Candidate invite | Candidate receives link to `/screen/[token]` | ☐ |

---

## 9. Mobile Responsive Check

Test these on a mobile device (Safari or Chrome):

| Step | What to check | Tick |
|---|---|---|
| 9.1 | Homepage renders correctly, no horizontal scroll | ☐ |
| 9.2 | Nav collapses to hamburger menu, drawer opens/closes | ☐ |
| 9.3 | Signup form is usable (inputs full-width, buttons reachable) | ☐ |
| 9.4 | Dashboard loads, gap radar resizes, skill bars readable | ☐ |
| 9.5 | Lessons are usable (email input, audio recording works) | ☐ |
| 9.6 | Employer portal loads, navigation works | ☐ |
| 9.7 | Language toggle works on mobile | ☐ |

---

## 10. Sign-off

| Tester | Date | Portals tested | Overall pass/fail | Notes |
|---|---|---|---|---|
| | | | ☐ Pass / ☐ Fail | |
| | | | ☐ Pass / ☐ Fail | |
| | | | ☐ Pass / ☐ Fail | |

### Per-Section Pass/Fail

| Section | Thao | Dan | Shamni |
|---|---|---|---|
| 3. Student Portal | ☐ | ☐ | ☐ |
| 4. Employer Portal | ☐ | ☐ | ☐ |
| 5. Investor Portal | ☐ | ☐ | ☐ |
| 6. Marketing Pages | ☐ | ☐ | ☐ |
| 7. Assessment Flows | ☐ | ☐ | ☐ |
| 8. Email Verification | ☐ | ☐ | ☐ |
| 9. Mobile Responsive | ☐ | ☐ | ☐ |

---

*Document generated September 2026. For questions, contact Dennis.*
