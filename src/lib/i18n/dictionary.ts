/**
 * LingoPure UI dictionary — 6 languages.
 *
 * SCOPE: navigation chrome, button labels, page titles, instructions,
 * status pills. ENGLISH-ONLY by design: lesson prompts, transcripts,
 * gap-score evidence, profile_json content, model rewrites — anything
 * that IS the English learning content. The product is "learn business
 * English"; a fully translated dashboard would undercut the proposition.
 *
 * Keys use dot notation grouped by surface. Adding a new key: add it
 * to `en` first (source of truth), then provide translations. Missing
 * translations fall back to English via the t() helper.
 */

export const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms", name: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "th", name: "ภาษาไทย", flag: "🇹🇭" },
  { code: "km", name: "ភាសាខ្មែរ", flag: "🇰🇭" },
  { code: "lo", name: "ພາສາລາວ", flag: "🇱🇦" },
  { code: "my", name: "မြန်မာ", flag: "🇲🇲" },
  { code: "ta", name: "தமிழ்", flag: "🇸🇬" },
  { code: "zh", name: "中文 (简体)", flag: "🇨🇳" },
  { code: "en", name: "English", flag: "🇬🇧" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];
export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(s: string | null | undefined): s is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === s);
}

export function languageNameOf(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}

type Dict = Record<string, string>;

const en: Dict = {
  // ── Brand + nav ────────────────────────────────────────────────────────
  "nav.dashboard": "Dashboard",
  "nav.lessons": "Lessons",
  "nav.signOut": "Sign out",
  "nav.signIn": "Sign in",
  "nav.signUp": "Create account",
  "nav.langPrefix": "Language",

  // ── Home ───────────────────────────────────────────────────────────────
  "home.kicker": "Business English for Southeast Asia",
  "home.headline": "Close your team's English gap, and prove it.",
  "home.lead":
    "An AI-first business English platform for B2B teams in Vietnam and Southeast Asia. Voice assessment, live classes, micro-lessons, and CEFR certification — measurable outcomes, not teaching hours.",
  "home.ctaPrimary": "Get started",
  "home.ctaSecondary": "I already have an account",
  "demo.bannerLead":
    "This is a strategic platform demo — not the real LingoPure service.",
  "demo.bannerCta": "Visit the real LingoPure →",

  // ── Login ──────────────────────────────────────────────────────────────
  "login.heading": "Welcome back",
  "login.lead": "Sign in to continue your learning journey.",
  "login.fieldEmail": "Email",
  "login.fieldPassword": "Password",
  "login.submit": "Sign in",
  "login.signupPrompt": "New to LingoPure?",
  "login.signupLink": "Create an account",

  // ── Signup ─────────────────────────────────────────────────────────────
  "signup.heading": "Create your account",
  "signup.lead": "Two minutes to set up. Your discovery session starts straight after.",
  "signup.fieldFullName": "Full name",
  "signup.fieldEmail": "Email",
  "signup.fieldPassword": "Password (8+ characters)",
  "signup.submit": "Create account",
  "signup.loginPrompt": "Already have an account?",
  "signup.loginLink": "Sign in",

  // ── Onboarding gateway ─────────────────────────────────────────────────
  "onboarding.kicker": "Phase 0 — Discovery session",
  "onboarding.heading": "A 20–35 minute conversation, not a test",
  "onboarding.lead":
    "Our voice AI walks you through six dimensions to build your initial gap profile. Speak naturally — there are no wrong answers, only data we use to personalise everything that comes next.",
  "onboarding.coverHeading": "What we cover",
  "onboarding.dim1Label": "Language capability",
  "onboarding.dim1Body": "Speaking, listening, reading, intent comprehension.",
  "onboarding.dim2Label": "Role & seniority",
  "onboarding.dim2Body": "Job title, department, decision-making level.",
  "onboarding.dim3Label": "Responsibilities",
  "onboarding.dim3Body": "Daily tasks requiring English; reporting lines.",
  "onboarding.dim4Label": "Interaction audit",
  "onboarding.dim4Body": "Email, calls, meetings, presentations, reports.",
  "onboarding.dim5Label": "Target level",
  "onboarding.dim5Body": "Employer requirement or career target.",
  "onboarding.dim6Label": "Learning style",
  "onboarding.dim6Body": "Feedback preference, session length, time available.",
  "onboarding.readyHeading": "Ready when you are",
  "onboarding.readyLead":
    "Plug in your headset, find a quiet spot, and click below to start. The conversation runs in your browser.",
  "onboarding.startButton": "Start discovery session",
  "onboarding.connecting": "Connecting…",
  "onboarding.headphonesNote":
    "Plug in headphones · ~25 minutes · English only after the intro",
  "onboarding.languagePickerLabel": "My native language is",
  "onboarding.langExplain":
    "Aria will greet you in your language for ~30 seconds, then switch to English for the assessment.",

  // ── Discovery agent — localized first message ──────────────────────────
  // Aria's literal first words on the call. Pre-briefed with name, role,
  // employer, target_level via dynamic variables — these get substituted
  // by ConvAI before TTS. Keep it warm and end with an open invitation
  // (NOT a "what's your name" question — we already have that).
  "discovery.firstMessage":
    "Hi {{student_name}}! I'm Aria from Lingo Pyoor. I've got the basics already — {{role_name}} at {{employer_name}}, aiming for {{target_level}}. We'll spend the next twenty or so minutes getting to know what's behind that — what your week actually looks like, where English shows up. No right or wrong answers. To start: walk me through what a typical day in your role looks like.",

  // ── Dashboard chrome ───────────────────────────────────────────────────
  "dash.kicker": "Student dashboard",
  "dash.heading": "Your gap profile",
  "dash.skillsHeading": "Skills",
  "dash.skillsTargetLabel": "Target line",
  "dash.cefrNow": "Now",
  "dash.cefrTarget": "Target",
  "dash.discoveryGateKicker": "Step 1 — Required",
  "dash.discoveryGateHeading": "Complete your discovery session",
  "dash.discoveryGateBody":
    "A 20–35 minute voice conversation establishes your baseline fluency, your role, and your target level. Everything else flows from this.",
  "dash.discoveryGateButton": "Start discovery →",
  "dash.skill.speaking": "Speaking",
  "dash.skill.listening": "Listening",
  "dash.skill.writing": "Writing",
  "dash.skill.reading": "Reading intent",
  "dash.skill.vocab": "Vocabulary",
  "dash.skill.presenting": "Presenting",
  "dash.evidenceToggle": "Evidence",
  "dash.whyTarget": "Why this target",
  "dash.howYouLearn": "How you learn",
  "dash.learningStyleTag": "Learning style",
  "gamify.title": "Progress",
  "gamify.xp": "XP earned",
  "gamify.streak": "Streak",
  "gamify.streakUnit": "days",
  "gamify.streakUnitOne": "day",
  "gamify.cta": "Earn more →",
  "dash.practiceKicker": "Practice",
  "dash.practiceHeadingEmpty": "Try a five-minute lesson",
  "dash.practiceLead":
    "Email sprints calibrated to your gap profile. Each one updates your scores in real time.",
  "dash.practiceCtaStart": "Start a lesson →",
  "dash.practiceCtaContinue": "Continue practicing →",
  "dash.nextClass": "Next class",
  "dash.nextClassEmpty":
    "No class scheduled — your coordinator will assign a teacher and slot. For demo purposes you can schedule one yourself below.",
  "dash.nextClassWith": "With",
  "dash.enterClass": "Enter class →",
  "dash.scheduleDemoClass": "Schedule a demo class",
  "dash.recentClassesHeading": "Recent classes",
  "dash.recentActivityHeading": "Recent activity",
  "dash.recentActivityEmpty":
    "Activity will appear here as you complete your discovery, attend classes, and finish micro-lessons.",
  "dash.scoreSession": "Score session",
  "dash.rescore": "Re-score",
  "dash.rescoreInProgress": "Re-scoring…",
  "dash.rescoreDone": "Re-scored ✓",

  // ── Certification card ─────────────────────────────────────────────────
  "cert.certifiedKicker": "Certified",
  "cert.certifiedHeading": "CEFR {level} certificate awarded",
  "cert.viewCertificate": "View certificate",
  "cert.scheduledKicker": "Exam scheduled",
  "cert.scheduledHeading": "Your CEFR exam is ready to take",
  "cert.scheduledBody":
    "45 minutes via TrackTest. Result returns to LingoPure automatically.",
  "cert.takeExam": "Take exam →",
  "cert.readyKicker": "Exam ready · {level}",
  "cert.readyHeading": "You're cleared to sit the {level} CEFR exam",
  "cert.readyBody":
    "Every sub-skill is at or above the {level} floor. Schedule it any time — internationally recognised certification.",
  "cert.scheduleButton": "Schedule {level} exam →",
  "cert.blockedKicker": "On track for {level}",
  "cert.blockedHeading": "Close these gaps to unlock the {level} CEFR exam",
  "cert.blockedNoScores":
    "Complete your discovery session — exam readiness depends on having scores on file.",

  // ── Employer chrome ────────────────────────────────────────────────────
  "emp.brandTag": "Employer",
  "emp.navOverview": "Overview",
  "emp.navStudents": "Students",
  "emp.loginKicker": "Employer access",
  "emp.loginHeading": "LingoPure pilot dashboard",
  "emp.loginLead":
    "Single shared access for the pilot. Production will move to per-admin accounts.",
  "emp.loginField": "Access password",
  "emp.loginSubmit": "Sign in",
  "emp.loginSubmitting": "Signing in…",

  // ── Marketing site (mkt.*) ──────────────────────────────────────────────
  // Nav links + CTA
  "mkt.nav.forCompanies": "For companies",
  "mkt.nav.forIndividuals": "For individuals",
  "mkt.nav.method": "Method",
  "mkt.nav.bookDemo": "Book a demo",
  "mkt.nav.theReport": "The report",
  "mkt.nav.cta": "Start free assessment",
  // 01 Hero
  "mkt.hero.eyebrow": "Business English · Vietnam & Southeast Asia",
  "mkt.hero.h1": "English that holds up when it actually counts.",
  "mkt.hero.lede":
    "Placement in one class. Progress you can see. Certification you can show. For teams that need to work in English, and for professionals who need to be heard in it.",
  "mkt.hero.ctaPrimary": "Start free assessment",
  "mkt.hero.ctaSecondary": "I'm looking for my team",
  "mkt.hero.micro": "Free · 45 minutes · you receive an LP-18 placement report either way",
  // 03 Problem
  "mkt.problem.eyebrow": "The situation",
  "mkt.problem.h2": "Most people here don't need more English. They need it to work under pressure.",
  "mkt.problem.quote": "I can read English fine. I freeze the moment I have to speak in the meeting.",
  // 04 Fork
  "mkt.fork.company.tag": "For companies",
  "mkt.fork.company.h3": "Your team can read the contract. Can they hold the call?",
  "mkt.fork.company.p": "Assess a whole team in a week. Get a capability baseline, not an attendance sheet — and a monthly report you can take to your board.",
  "mkt.fork.company.cta": "Try a team assessment",
  "mkt.fork.individual.tag": "For individuals",
  "mkt.fork.individual.h3": "You've done the courses. You still don't sound like yourself.",
  "mkt.fork.individual.p": "Start with one free class and a placement report that tells you exactly where you are, and exactly what's holding you back.",
  "mkt.fork.individual.cta": "Try a free demo class",
  // 05 How
  "mkt.how.eyebrow": "How it works",
  "mkt.how.h2": "Three steps, and the first one is free.",
  "mkt.how.step1.num": "STEP 01",
  "mkt.how.step1.h3": "A real class, not a sales call",
  "mkt.how.step1.p": "45 minutes with a LingoPure teacher. Live, in ClassIn. You are assessed while you speak, not by a form.",
  "mkt.how.step2.num": "STEP 02",
  "mkt.how.step2.h3": "Your LP-18 placement report",
  "mkt.how.step2.p": "Within 48 hours: your CEFR level, your micro-level placement across 18 bands, your strengths, and the specific things holding you back.",
  "mkt.how.step3.num": "STEP 03",
  "mkt.how.step3.h3": "A programme built on that report",
  "mkt.how.step3.p": "Live classes and micro-lessons targeted at your gaps. Progress re-measured as you go. CEFR-aligned certification through TrackTest.",
  // 06 Proof
  "mkt.proof.eyebrow": "What you receive",
  "mkt.proof.h2": "We don't tell you you're \"intermediate\". We show you which eighteenth.",
  "mkt.proof.lede":
    "CEFR gives you six levels. That's too coarse to act on. LP-18 splits each level into three micro-bands and maps your communication signals against them — so the next class targets something specific instead of something general.",
  "mkt.proof.cta": "See yours after one class",
  // 07 Outcomes
  "mkt.outcomes.eyebrow": "What you get",
  "mkt.outcomes.h2": "Different buyers. Different wins.",
  "mkt.outcomes.company.h3": "If you run a team",
  "mkt.outcomes.company.item1.b": "Capability you can measure",
  "mkt.outcomes.company.item1.span": "A baseline, a target, and a monthly movement figure per person — not hours attended.",
  "mkt.outcomes.company.item2.b": "Fewer expensive misunderstandings",
  "mkt.outcomes.company.item2.span": "The rework, the lost deal, the client who quietly stopped replying.",
  "mkt.outcomes.company.item3.b": "Something to show the board",
  "mkt.outcomes.company.item3.span": "Reporting that survives contact with a CFO, and certification that outlasts the employee.",
  // 08 Testimonials
  "mkt.testimonials.eyebrow": "In their words",
  "mkt.testimonials.h2": "Not testimonials. Receipts.",
  // 10 Final CTA
  "mkt.final.h2": "Find out where you actually stand. It takes 45 minutes.",
  "mkt.final.p": "One free class with a real teacher. One LP-18 placement report. No obligation to continue, and the report is yours either way.",
  "mkt.final.cta": "Try a free demo class",
  "mkt.final.microPrefix": "Companies with five or more staff — ",
  "mkt.final.microLink": "try a team assessment instead",
  // Footer
  "mkt.footer.note": "Business English for Vietnam & Southeast Asia",
  "mkt.footer.legalL1": "LingoPure Pte. Ltd. · Singapore",
  "mkt.footer.legalL2": "A subsidiary of LingoPure Limited (New Zealand)",
  "mkt.footer.legalL3": "CEFR certification delivered in partnership with TrackTest",
  "mkt.footer.colCompany": "Company",
  "mkt.footer.colContract": "Contract",
  "mkt.footer.colLanguages": "Languages",
  "mkt.footer.allRights": "All rights reserved.",
  "mkt.footer.privacy": "Privacy",
  "mkt.footer.terms": "Terms",
  "mkt.footer.contact": "Contact",
  "mkt.footer.company": "Company",
  "mkt.footer.bookDemo": "Book a demo",
};

const vi: Dict = {
  "nav.dashboard": "Bảng điều khiển",
  "nav.lessons": "Bài học",
  "nav.signOut": "Đăng xuất",
  "nav.signIn": "Đăng nhập",
  "nav.signUp": "Tạo tài khoản",
  "nav.langPrefix": "Ngôn ngữ",

  "home.kicker": "Tiếng Anh thương mại cho Đông Nam Á",
  "home.headline": "Thu hẹp khoảng cách tiếng Anh của đội ngũ — và chứng minh điều đó.",
  "home.lead":
    "Nền tảng tiếng Anh thương mại ưu tiên AI dành cho doanh nghiệp tại Việt Nam và Đông Nam Á. Đánh giá bằng giọng nói, lớp học trực tiếp, bài học siêu nhỏ và chứng chỉ CEFR — kết quả đo lường được, không phải số giờ giảng dạy.",
  "home.ctaPrimary": "Bắt đầu",
  "home.ctaSecondary": "Tôi đã có tài khoản",
  "demo.bannerLead":
    "Đây là bản demo nền tảng chiến lược — không phải dịch vụ LingoPure thật.",
  "demo.bannerCta": "Truy cập LingoPure thật →",

  "login.heading": "Chào mừng trở lại",
  "login.lead": "Đăng nhập để tiếp tục hành trình học của bạn.",
  "login.fieldEmail": "Email",
  "login.fieldPassword": "Mật khẩu",
  "login.submit": "Đăng nhập",
  "login.signupPrompt": "Bạn mới đến LingoPure?",
  "login.signupLink": "Tạo tài khoản",

  "signup.heading": "Tạo tài khoản của bạn",
  "signup.lead":
    "Mất hai phút để thiết lập. Phiên khám phá của bạn bắt đầu ngay sau đó.",
  "signup.fieldFullName": "Họ và tên",
  "signup.fieldEmail": "Email",
  "signup.fieldPassword": "Mật khẩu (ít nhất 8 ký tự)",
  "signup.submit": "Tạo tài khoản",
  "signup.loginPrompt": "Đã có tài khoản?",
  "signup.loginLink": "Đăng nhập",

  "onboarding.kicker": "Giai đoạn 0 — Phiên khám phá",
  "onboarding.heading": "Một cuộc trò chuyện 20–35 phút, không phải bài kiểm tra",
  "onboarding.lead":
    "AI giọng nói của chúng tôi sẽ hướng dẫn bạn qua sáu khía cạnh để xây dựng hồ sơ khoảng cách ban đầu. Hãy nói tự nhiên — không có câu trả lời sai, chỉ có dữ liệu chúng tôi dùng để cá nhân hoá mọi thứ tiếp theo.",
  "onboarding.coverHeading": "Những gì chúng ta sẽ trao đổi",
  "onboarding.dim1Label": "Năng lực ngôn ngữ",
  "onboarding.dim1Body": "Nói, nghe, đọc, hiểu ý định.",
  "onboarding.dim2Label": "Vai trò & cấp bậc",
  "onboarding.dim2Body": "Chức danh, phòng ban, quyền ra quyết định.",
  "onboarding.dim3Label": "Trách nhiệm",
  "onboarding.dim3Body": "Công việc hằng ngày cần tiếng Anh; tuyến báo cáo.",
  "onboarding.dim4Label": "Tương tác hằng ngày",
  "onboarding.dim4Body": "Email, cuộc gọi, họp, thuyết trình, báo cáo.",
  "onboarding.dim5Label": "Cấp độ mục tiêu",
  "onboarding.dim5Body": "Yêu cầu của công ty hoặc mục tiêu sự nghiệp.",
  "onboarding.dim6Label": "Phong cách học",
  "onboarding.dim6Body": "Sở thích phản hồi, độ dài phiên, thời gian rảnh.",
  "onboarding.readyHeading": "Sẵn sàng khi bạn muốn",
  "onboarding.readyLead":
    "Đeo tai nghe, tìm một chỗ yên tĩnh, và nhấn nút bên dưới để bắt đầu. Cuộc trò chuyện diễn ra ngay trong trình duyệt.",
  "onboarding.startButton": "Bắt đầu phiên khám phá",
  "onboarding.connecting": "Đang kết nối…",
  "onboarding.headphonesNote":
    "Đeo tai nghe · ~25 phút · Tiếng Anh sau phần giới thiệu",
  "onboarding.languagePickerLabel": "Ngôn ngữ mẹ đẻ của tôi là",
  "onboarding.langExplain":
    "Aria sẽ chào bạn bằng ngôn ngữ của bạn trong khoảng 30 giây, sau đó chuyển sang tiếng Anh để đánh giá.",

  "discovery.firstMessage":
    "Xin chào {{student_name}}! Tôi là Aria từ Lingo Pyoor. Tôi đã có thông tin cơ bản — bạn là {{role_name}} tại {{employer_name}}, với mục tiêu {{target_level}}. Chúng ta sẽ dành khoảng hai mươi phút tới để tìm hiểu sâu hơn về công việc của bạn và nơi tiếng Anh xuất hiện. Không có câu trả lời đúng hay sai. Bây giờ chúng ta hãy chuyển sang tiếng Anh — hãy nói tự nhiên và đừng lo lắng về lỗi. To start: walk me through what a typical day in your role looks like.",

  "dash.kicker": "Bảng điều khiển học viên",
  "dash.heading": "Hồ sơ khoảng cách của bạn",
  "dash.skillsHeading": "Kỹ năng",
  "dash.skillsTargetLabel": "Đường mục tiêu",
  "dash.cefrNow": "Hiện tại",
  "dash.cefrTarget": "Mục tiêu",
  "dash.discoveryGateKicker": "Bước 1 — Bắt buộc",
  "dash.discoveryGateHeading": "Hoàn thành phiên khám phá của bạn",
  "dash.discoveryGateBody":
    "Một cuộc trò chuyện bằng giọng nói 20–35 phút sẽ thiết lập mức trôi chảy nền, vai trò và cấp độ mục tiêu của bạn. Mọi thứ khác bắt nguồn từ đây.",
  "dash.discoveryGateButton": "Bắt đầu khám phá →",
  "dash.skill.speaking": "Nói",
  "dash.skill.listening": "Nghe",
  "dash.skill.writing": "Viết",
  "dash.skill.reading": "Hiểu ý định",
  "dash.skill.vocab": "Từ vựng",
  "dash.skill.presenting": "Thuyết trình",
  "dash.evidenceToggle": "Bằng chứng",
  "dash.whyTarget": "Tại sao mục tiêu này",
  "dash.howYouLearn": "Bạn học như thế nào",
  "dash.learningStyleTag": "Phong cách học",
  "gamify.title": "Tiến độ",
  "gamify.xp": "XP đã đạt",
  "gamify.streak": "Chuỗi ngày",
  "gamify.streakUnit": "ngày",
  "gamify.streakUnitOne": "ngày",
  "gamify.cta": "Tiếp tục →",
  "dash.practiceKicker": "Luyện tập",
  "dash.practiceHeadingEmpty": "Thử một bài học năm phút",
  "dash.practiceLead":
    "Bài tập viết email được hiệu chỉnh theo hồ sơ khoảng cách của bạn. Mỗi bài cập nhật điểm số theo thời gian thực.",
  "dash.practiceCtaStart": "Bắt đầu một bài →",
  "dash.practiceCtaContinue": "Tiếp tục luyện tập →",
  "dash.nextClass": "Lớp tiếp theo",
  "dash.nextClassEmpty":
    "Chưa có lớp nào — điều phối viên sẽ giao giáo viên và khung giờ. Cho mục đích demo, bạn có thể tự đặt lịch bên dưới.",
  "dash.nextClassWith": "Với",
  "dash.enterClass": "Vào lớp →",
  "dash.scheduleDemoClass": "Đặt lớp demo",
  "dash.recentClassesHeading": "Lớp gần đây",
  "dash.recentActivityHeading": "Hoạt động gần đây",
  "dash.recentActivityEmpty":
    "Hoạt động sẽ xuất hiện ở đây khi bạn hoàn thành phần khám phá, tham dự lớp, và làm các bài học siêu nhỏ.",
  "dash.scoreSession": "Chấm điểm phiên",
  "dash.rescore": "Chấm lại",
  "dash.rescoreInProgress": "Đang chấm…",
  "dash.rescoreDone": "Đã chấm lại ✓",

  "cert.certifiedKicker": "Đã chứng nhận",
  "cert.certifiedHeading": "Chứng chỉ CEFR {level} đã được trao",
  "cert.viewCertificate": "Xem chứng chỉ",
  "cert.scheduledKicker": "Đã đặt kỳ thi",
  "cert.scheduledHeading": "Kỳ thi CEFR của bạn đã sẵn sàng",
  "cert.scheduledBody":
    "45 phút qua TrackTest. Kết quả tự động trả về LingoPure.",
  "cert.takeExam": "Làm bài thi →",
  "cert.readyKicker": "Sẵn sàng thi · {level}",
  "cert.readyHeading": "Bạn đã đủ điều kiện để thi CEFR cấp {level}",
  "cert.readyBody":
    "Mọi kỹ năng phụ đều đạt hoặc vượt mức {level}. Đặt lịch thi bất kỳ lúc nào — chứng chỉ được công nhận quốc tế.",
  "cert.scheduleButton": "Đặt lịch thi {level} →",
  "cert.blockedKicker": "Đang tiến tới {level}",
  "cert.blockedHeading":
    "Đóng các khoảng cách dưới đây để mở khoá kỳ thi CEFR {level}",
  "cert.blockedNoScores":
    "Hoàn thành phiên khám phá — điều kiện thi phụ thuộc vào việc có điểm trên hồ sơ.",

  "emp.brandTag": "Doanh nghiệp",
  "emp.navOverview": "Tổng quan",
  "emp.navStudents": "Học viên",
  "emp.loginKicker": "Truy cập doanh nghiệp",
  "emp.loginHeading": "Bảng điều khiển thí điểm LingoPure",
  "emp.loginLead":
    "Truy cập chung cho giai đoạn thí điểm. Bản chính thức sẽ chuyển sang tài khoản quản trị viên riêng.",
  "emp.loginField": "Mật khẩu truy cập",
  "emp.loginSubmit": "Đăng nhập",
  "emp.loginSubmitting": "Đang đăng nhập…",

  // ── Marketing site (mkt.*) ──────────────────────────────────────────────
  "mkt.nav.forCompanies": "Cho doanh nghiệp",
  "mkt.nav.forIndividuals": "Cho cá nhân",
  "mkt.nav.method": "Phương pháp",
  "mkt.nav.bookDemo": "Đặt lịch demo",
  "mkt.nav.theReport": "Báo cáo LP-18",
  "mkt.nav.cta": "Bắt đầu đánh giá miễn phí",
  "mkt.hero.eyebrow": "Tiếng Anh thương mại · Việt Nam & Đông Nam Á",
  "mkt.hero.h1": "Tiếng Anh vững vàng khi thực sự cần.",
  "mkt.hero.lede":
    "Định vị trong một buổi học. Tiến bộ thấy được. Chứng chỉ demonstrate được. Cho đội ngũ cần làm việc bằng tiếng Anh, và cho chuyên gia cần được lắng nghe trong đó.",
  "mkt.hero.ctaPrimary": "Bắt đầu đánh giá miễn phí",
  "mkt.hero.ctaSecondary": "Tôi đang tìm giải pháp cho đội ngũ",
  "mkt.hero.micro": "Miễn phí · 45 phút · bạn nhận báo cáo LP-18 dù tiếp tục hay không",
  "mkt.problem.h2": "Hầu hết mọi người ở đây không cần thêm tiếng Anh. Họ cần nó hoạt động dưới áp lực.",
  "mkt.problem.eyebrow": "Tình hình hiện tại",
  "mkt.problem.quote": "Tôi đọc tiếng Anh tốt. Tôi đông cứng lúc phải nói trong cuộc họp.",
  "mkt.fork.company.tag": "Cho doanh nghiệp",
  "mkt.fork.company.h3": "Đội bạn đọc được hợp đồng. Họ trò chuyện được không?",
  "mkt.fork.company.p": "Đánh giá cả đội ngũ trong một tuần. Nhận baseline năng lực, không phải sheet điểm danh — kèm báo cáo hàng tháng trình lên hội đồng.",
  "mkt.fork.company.cta": "Thử đánh giá đội ngũ",
  "mkt.fork.individual.tag": "Cho cá nhân",
  "mkt.fork.individual.h3": "Bạn đã học các khoá rồi. Bạn vẫn không thấy mình trong đó.",
  "mkt.fork.individual.p": "Bắt đầu với một buổi học miễn phí và báo cáo định vị cho biết chính xác bạn đang ở đâu, và chính xác điều gì đang kìm bạn lại.",
  "mkt.fork.individual.cta": "Thử buổi học miễn phí",
  "mkt.how.eyebrow": "Cách thức hoạt động",
  "mkt.how.h2": "Ba bước, và bước đầu tiên miễn phí.",
  "mkt.how.step1.num": "BƯỚC 01",
  "mkt.how.step1.h3": "Buổi học thực, không phải cuộc gọi bán hàng",
  "mkt.how.step1.p": "45 phút với giáo viên LingoPure. Trực tiếp, trên ClassIn. Bạn được đánh giá lúc nói, không phải bằng phiếu.",
  "mkt.how.step2.num": "BƯỚC 02",
  "mkt.how.step2.h3": "Báo cáo định vị LP-18 của bạn",
  "mkt.how.step2.p": "Trong 48 giờ: cấp CEFR, vị trí vi mô trên 18 dải, thế mạnh, và những điều cụ thể đang kìm bạn lại.",
  "mkt.how.step3.num": "BƯỚC 03",
  "mkt.how.step3.h3": "Chương trình xây trên báo cáo đó",
  "mkt.how.step3.p": "Lớp học trực tiếp và bài học siêu nhỏ nhắm vào khoảng cách. Tiến bộ được đo lại khi bạn đi. Chứng nhận CEFR qua TrackTest.",
  "mkt.proof.eyebrow": "Bạn nhận gì",
  "mkt.proof.h2": "Chúng tôi không nói bạn \"trung bình\". Chúng tôi cho bạn xem bạn thuộc phần mười tám nào.",
  "mkt.proof.lede":
    "CEFR cho sáu cấp. Quá thô để hành động. LP-18 chia mỗi cấp thành ba vi-dải và ánh xạ tín hiệu giao tiếp của bạn — để buổi học tiếp theo nhắm vào điều cụ thể thay vì điều chung chung.",
  "mkt.proof.cta": "Xem của bạn sau một buổi học",
  "mkt.outcomes.eyebrow": "Bạn nhận gì",
  "mkt.outcomes.h2": "Người mua khác. Lợi ích khác.",
  "mkt.outcomes.company.h3": "Nếu bạn quản lý đội",
  "mkt.outcomes.company.item1.b": "Năng lực đo được",
  "mkt.outcomes.company.item1.span": "Baseline, mục tiêu, và con số dịch chuyển hàng tháng mỗi người — không phải giờ tham dự.",
  "mkt.outcomes.company.item2.b": "Ít hiểu lầm tốn kém hơn",
  "mkt.outcomes.company.item2.span": "Làm lại, mất deal, khách hàng lặng lẽ ngừng phản hồi.",
  "mkt.outcomes.company.item3.b": "Có thứ trình hội đồng",
  "mkt.outcomes.company.item3.span": "Báo cáo survive được cuộc gặp CFO, và chứng chỉ tồn tại lâu hơn nhân viên.",
  "mkt.testimonials.eyebrow": "Lời chia sẻ",
  "mkt.testimonials.h2": "Không phải lời chứng thực. Là kết quả thực.",
  "mkt.final.h2": "Tìm hiểu bạn thực sự đứng ở đâu. Chỉ 45 phút.",
  "mkt.final.p": "Một buổi học miễn phí với giáo viên thực. Một báo cáo LP-18. Không nghĩa vụ tiếp tục, và báo cáo là của bạn dù gì đi nữa.",
  "mkt.final.cta": "Thử buổi học miễn phí",
  "mkt.final.microPrefix": "Đội ngũ năm người trở lên — ",
  "mkt.final.microLink": "thử đánh giá đội ngũ thay thế",
  "mkt.footer.note": "Tiếng Anh thương mại cho Việt Nam & Đông Nam Á",
  "mkt.footer.legalL1": "LingoPure Pte. Ltd. · Singapore",
  "mkt.footer.legalL2": "Công ty con của LingoPure Limited (New Zealand)",
  "mkt.footer.legalL3": "Chứng nhận CEFR hợp tác với TrackTest",
  "mkt.footer.colCompany": "Công ty",
  "mkt.footer.colContract": "Liên hệ",
  "mkt.footer.colLanguages": "Ngôn ngữ",
  "mkt.footer.allRights": "Bảo lưu mọi quyền.",
  "mkt.footer.privacy": "Quyền riêng tư",
  "mkt.footer.terms": "Điều khoản",
  "mkt.footer.contact": "Liên hệ",
  "mkt.footer.company": "Công ty",
  "mkt.footer.bookDemo": "Đặt lịch demo",
};

// The remaining 4 languages translate the highest-impact public surface
// (home, login, signup, onboarding, nav). Authenticated pages fall back
// to English for these — the dashboard remains intentionally bilingual
// for English learners but the welcoming surface is in their language.
const tl: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.lessons": "Mga aralin",
  "nav.signOut": "Mag-sign out",
  "nav.signIn": "Mag-sign in",
  "nav.signUp": "Gumawa ng account",
  "nav.langPrefix": "Wika",

  "home.kicker": "Business English para sa Timog-Silangang Asya",
  "home.headline": "Isara ang English gap ng team mo, at patunayan ito.",
  "home.lead":
    "AI-first business English platform para sa B2B teams sa Vietnam at Timog-Silangang Asya. Voice assessment, live classes, micro-lessons, at CEFR certification — masusukat na resulta, hindi oras ng pagtuturo.",
  "home.ctaPrimary": "Magsimula",
  "home.ctaSecondary": "Mayroon na akong account",
  "demo.bannerLead":
    "Ito ay isang strategic platform demo — hindi ang totoong serbisyo ng LingoPure.",
  "demo.bannerCta": "Bisitahin ang totoong LingoPure →",

  "login.heading": "Maligayang pagbabalik",
  "login.lead": "Mag-sign in para ipagpatuloy ang iyong learning journey.",
  "login.fieldEmail": "Email",
  "login.fieldPassword": "Password",
  "login.submit": "Mag-sign in",
  "login.signupPrompt": "Bago sa LingoPure?",
  "login.signupLink": "Gumawa ng account",

  "signup.heading": "Gumawa ng iyong account",
  "signup.lead":
    "Dalawang minuto para mag-set up. Ang discovery session mo ay magsisimula kaagad pagkatapos.",
  "signup.fieldFullName": "Buong pangalan",
  "signup.fieldEmail": "Email",
  "signup.fieldPassword": "Password (8+ na karakter)",
  "signup.submit": "Gumawa ng account",
  "signup.loginPrompt": "May account ka na?",
  "signup.loginLink": "Mag-sign in",

  "onboarding.kicker": "Phase 0 — Discovery session",
  "onboarding.heading": "20–35 minutong usapan, hindi pagsusulit",
  "onboarding.lead":
    "Ang voice AI namin ang gagabay sa iyo sa anim na dimensyon para mabuo ang inisyal mong gap profile. Magsalita nang natural — walang maling sagot, datos lang na gagamitin namin para i-personalize ang lahat ng susunod.",
  "onboarding.coverHeading": "Ano ang sasaklawin",
  "onboarding.dim1Label": "Kakayahan sa wika",
  "onboarding.dim1Body": "Pagsasalita, pakikinig, pagbasa, pang-unawa sa intent.",
  "onboarding.dim2Label": "Tungkulin at antas",
  "onboarding.dim2Body": "Posisyon, departamento, antas ng pagdedesisyon.",
  "onboarding.dim3Label": "Mga responsibilidad",
  "onboarding.dim3Body": "Araw-araw na gawain sa English; reporting lines.",
  "onboarding.dim4Label": "Interaction audit",
  "onboarding.dim4Body": "Email, tawag, miting, presentation, ulat.",
  "onboarding.dim5Label": "Target na antas",
  "onboarding.dim5Body": "Hinihingi ng employer o target sa karera.",
  "onboarding.dim6Label": "Estilo ng pag-aaral",
  "onboarding.dim6Body": "Preference sa feedback, haba ng session, oras na available.",
  "onboarding.readyHeading": "Handa na kapag handa ka na",
  "onboarding.readyLead":
    "Isuot ang headset, humanap ng tahimik na lugar, at i-click sa baba para magsimula. Tatakbo ito sa loob ng iyong browser.",
  "onboarding.startButton": "Simulan ang discovery session",
  "onboarding.connecting": "Kumokonekta…",
  "onboarding.headphonesNote":
    "Isuot ang headphones · ~25 minuto · English pagkatapos ng intro",
  "onboarding.languagePickerLabel": "Ang aking katutubong wika ay",
  "onboarding.langExplain":
    "Ba-batiin ka ni Aria sa iyong wika nang ~30 segundo, pagkatapos ay lilipat sa English para sa assessment.",

  "discovery.firstMessage":
    "Kumusta {{student_name}}! Ako si Aria mula sa Lingo Pyoor. Mayroon na akong mga pangunahing detalye — {{role_name}} ka sa {{employer_name}}, layunin mong maabot ang {{target_level}}. Sa susunod na dalawampung minuto, kilalanin natin nang mas malalim ang iyong trabaho at kung saan pumapasok ang English. Walang tama o maling sagot. Ngayon, magsa-shift na tayo sa English — magsalita lang nang natural at huwag mag-alala sa mga pagkakamali. To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "Employer",
  "emp.navOverview": "Pangkalahatang-ideya",
  "emp.navStudents": "Mga estudyante",
  "emp.loginKicker": "Access ng employer",
  "emp.loginHeading": "LingoPure pilot dashboard",
  "emp.loginLead":
    "Iisang shared access para sa pilot. Ang production ay lilipat sa per-admin na account.",
  "emp.loginField": "Access password",
  "emp.loginSubmit": "Mag-sign in",
  "emp.loginSubmitting": "Nag-sa-sign in…",
};

const id: Dict = {
  "nav.dashboard": "Dasbor",
  "nav.lessons": "Pelajaran",
  "nav.signOut": "Keluar",
  "nav.signIn": "Masuk",
  "nav.signUp": "Buat akun",
  "nav.langPrefix": "Bahasa",

  "home.kicker": "Bahasa Inggris bisnis untuk Asia Tenggara",
  "home.headline": "Tutup celah Bahasa Inggris tim Anda, dan buktikan.",
  "home.lead":
    "Platform Bahasa Inggris bisnis berbasis AI untuk tim B2B di Vietnam dan Asia Tenggara. Penilaian suara, kelas langsung, pelajaran singkat, dan sertifikasi CEFR — hasil yang terukur, bukan jam mengajar.",
  "home.ctaPrimary": "Mulai",
  "home.ctaSecondary": "Saya sudah punya akun",
  "demo.bannerLead":
    "Ini adalah demo platform strategis — bukan layanan LingoPure yang sebenarnya.",
  "demo.bannerCta": "Kunjungi LingoPure asli →",

  "login.heading": "Selamat datang kembali",
  "login.lead": "Masuk untuk melanjutkan perjalanan belajar Anda.",
  "login.fieldEmail": "Email",
  "login.fieldPassword": "Kata sandi",
  "login.submit": "Masuk",
  "login.signupPrompt": "Baru di LingoPure?",
  "login.signupLink": "Buat akun",

  "signup.heading": "Buat akun Anda",
  "signup.lead":
    "Dua menit untuk pengaturan. Sesi penemuan Anda dimulai langsung setelahnya.",
  "signup.fieldFullName": "Nama lengkap",
  "signup.fieldEmail": "Email",
  "signup.fieldPassword": "Kata sandi (minimal 8 karakter)",
  "signup.submit": "Buat akun",
  "signup.loginPrompt": "Sudah punya akun?",
  "signup.loginLink": "Masuk",

  "onboarding.kicker": "Fase 0 — Sesi penemuan",
  "onboarding.heading": "Percakapan 20–35 menit, bukan tes",
  "onboarding.lead":
    "AI suara kami memandu Anda melewati enam dimensi untuk membangun profil celah awal Anda. Bicaralah dengan natural — tidak ada jawaban yang salah, hanya data yang kami gunakan untuk personalisasi semua tahap berikutnya.",
  "onboarding.coverHeading": "Yang akan kami bahas",
  "onboarding.dim1Label": "Kemampuan bahasa",
  "onboarding.dim1Body": "Berbicara, mendengarkan, membaca, pemahaman maksud.",
  "onboarding.dim2Label": "Peran & senioritas",
  "onboarding.dim2Body": "Jabatan, departemen, tingkat pengambilan keputusan.",
  "onboarding.dim3Label": "Tanggung jawab",
  "onboarding.dim3Body": "Tugas harian yang membutuhkan Bahasa Inggris; jalur pelaporan.",
  "onboarding.dim4Label": "Audit interaksi",
  "onboarding.dim4Body": "Email, panggilan, rapat, presentasi, laporan.",
  "onboarding.dim5Label": "Tingkat target",
  "onboarding.dim5Body": "Persyaratan perusahaan atau target karier.",
  "onboarding.dim6Label": "Gaya belajar",
  "onboarding.dim6Body": "Preferensi umpan balik, durasi sesi, waktu tersedia.",
  "onboarding.readyHeading": "Siap kapan pun Anda siap",
  "onboarding.readyLead":
    "Pasang headset, cari tempat yang tenang, dan klik di bawah untuk mulai. Percakapan berjalan di peramban Anda.",
  "onboarding.startButton": "Mulai sesi penemuan",
  "onboarding.connecting": "Menyambungkan…",
  "onboarding.headphonesNote":
    "Pasang headphones · ~25 menit · Bahasa Inggris setelah intro",
  "onboarding.languagePickerLabel": "Bahasa ibu saya adalah",
  "onboarding.langExplain":
    "Aria akan menyapa Anda dalam bahasa Anda selama ~30 detik, lalu beralih ke Bahasa Inggris untuk penilaian.",

  "discovery.firstMessage":
    "Halo {{student_name}}! Saya Aria dari Lingo Pyoor. Saya sudah memiliki informasi dasar — Anda adalah {{role_name}} di {{employer_name}}, dengan target {{target_level}}. Selama dua puluh menit ke depan, mari kita pahami lebih dalam tentang pekerjaan Anda dan di mana bahasa Inggris berperan. Tidak ada jawaban benar atau salah. Sekarang mari kita beralih ke bahasa Inggris — bicaralah secara alami dan jangan khawatir tentang kesalahan. To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "Perusahaan",
  "emp.navOverview": "Ikhtisar",
  "emp.navStudents": "Murid",
  "emp.loginKicker": "Akses perusahaan",
  "emp.loginHeading": "Dasbor pilot LingoPure",
  "emp.loginLead":
    "Akses bersama untuk masa pilot. Produksi akan beralih ke akun per-admin.",
  "emp.loginField": "Kata sandi akses",
  "emp.loginSubmit": "Masuk",
  "emp.loginSubmitting": "Sedang masuk…",
};

const ms: Dict = {
  "nav.dashboard": "Papan Pemuka",
  "nav.lessons": "Pelajaran",
  "nav.signOut": "Log keluar",
  "nav.signIn": "Log masuk",
  "nav.signUp": "Buat akaun",
  "nav.langPrefix": "Bahasa",

  "home.kicker": "Bahasa Inggeris perniagaan untuk Asia Tenggara",
  "home.headline": "Tutup jurang Bahasa Inggeris pasukan anda, dan buktikan.",
  "home.lead":
    "Platform Bahasa Inggeris perniagaan dipacu AI untuk pasukan B2B di Vietnam dan Asia Tenggara. Penilaian suara, kelas langsung, pelajaran ringkas, dan sijil CEFR — hasil yang boleh diukur, bukan jam pengajaran.",
  "home.ctaPrimary": "Mula",
  "home.ctaSecondary": "Saya sudah ada akaun",
  "demo.bannerLead":
    "Ini adalah demo platform strategik — bukan perkhidmatan LingoPure sebenar.",
  "demo.bannerCta": "Lawati LingoPure sebenar →",

  "login.heading": "Selamat kembali",
  "login.lead": "Log masuk untuk meneruskan perjalanan pembelajaran anda.",
  "login.fieldEmail": "E-mel",
  "login.fieldPassword": "Kata laluan",
  "login.submit": "Log masuk",
  "login.signupPrompt": "Baharu di LingoPure?",
  "login.signupLink": "Buat akaun",

  "signup.heading": "Buat akaun anda",
  "signup.lead":
    "Dua minit untuk persediaan. Sesi penemuan anda bermula sebaik selepas itu.",
  "signup.fieldFullName": "Nama penuh",
  "signup.fieldEmail": "E-mel",
  "signup.fieldPassword": "Kata laluan (8+ aksara)",
  "signup.submit": "Buat akaun",
  "signup.loginPrompt": "Sudah ada akaun?",
  "signup.loginLink": "Log masuk",

  "onboarding.kicker": "Fasa 0 — Sesi penemuan",
  "onboarding.heading": "Perbualan 20–35 minit, bukan ujian",
  "onboarding.lead":
    "AI suara kami akan membimbing anda melalui enam dimensi untuk membina profil jurang awal anda. Bercakaplah secara semula jadi — tiada jawapan yang salah, hanya data yang kami gunakan untuk memperibadikan semua langkah seterusnya.",
  "onboarding.coverHeading": "Apa yang akan kami liputi",
  "onboarding.dim1Label": "Keupayaan bahasa",
  "onboarding.dim1Body": "Bertutur, mendengar, membaca, kefahaman niat.",
  "onboarding.dim2Label": "Peranan & kekananan",
  "onboarding.dim2Body": "Jawatan, jabatan, tahap membuat keputusan.",
  "onboarding.dim3Label": "Tanggungjawab",
  "onboarding.dim3Body": "Tugas harian yang memerlukan Bahasa Inggeris; talian pelaporan.",
  "onboarding.dim4Label": "Audit interaksi",
  "onboarding.dim4Body": "E-mel, panggilan, mesyuarat, pembentangan, laporan.",
  "onboarding.dim5Label": "Tahap sasaran",
  "onboarding.dim5Body": "Keperluan majikan atau sasaran kerjaya.",
  "onboarding.dim6Label": "Gaya pembelajaran",
  "onboarding.dim6Body": "Pilihan maklum balas, panjang sesi, masa lapang.",
  "onboarding.readyHeading": "Sedia bila-bila masa anda mahu",
  "onboarding.readyLead":
    "Pakai fon kepala, cari tempat yang tenang, dan klik di bawah untuk mula. Perbualan berjalan dalam pelayar anda.",
  "onboarding.startButton": "Mulakan sesi penemuan",
  "onboarding.connecting": "Menyambung…",
  "onboarding.headphonesNote":
    "Pakai fon kepala · ~25 minit · Bahasa Inggeris selepas intro",
  "onboarding.languagePickerLabel": "Bahasa ibunda saya ialah",
  "onboarding.langExplain":
    "Aria akan menyapa anda dalam bahasa anda selama ~30 saat, kemudian bertukar ke Bahasa Inggeris untuk penilaian.",

  "discovery.firstMessage":
    "Helo {{student_name}}! Saya Aria daripada Lingo Pyoor. Saya sudah ada maklumat asas — anda {{role_name}} di {{employer_name}}, dengan sasaran {{target_level}}. Dalam dua puluh minit akan datang, mari kita fahami dengan lebih mendalam tentang kerja anda dan di mana bahasa Inggeris terlibat. Tiada jawapan betul atau salah. Sekarang mari kita beralih kepada bahasa Inggeris — bercakaplah secara semula jadi dan jangan risau tentang kesilapan. To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "Majikan",
  "emp.navOverview": "Gambaran keseluruhan",
  "emp.navStudents": "Pelajar",
  "emp.loginKicker": "Akses majikan",
  "emp.loginHeading": "Papan pemuka perintis LingoPure",
  "emp.loginLead":
    "Akses dikongsi untuk perintis. Pengeluaran akan beralih ke akaun setiap pentadbir.",
  "emp.loginField": "Kata laluan akses",
  "emp.loginSubmit": "Log masuk",
  "emp.loginSubmitting": "Sedang log masuk…",
};

const zh: Dict = {
  "nav.dashboard": "仪表盘",
  "nav.lessons": "课程",
  "nav.signOut": "退出",
  "nav.signIn": "登录",
  "nav.signUp": "创建账户",
  "nav.langPrefix": "语言",

  "home.kicker": "面向东南亚的商务英语",
  "home.headline": "缩小团队的英语差距 —— 并加以证明。",
  "home.lead":
    "面向越南及东南亚 B2B 团队的 AI 优先商务英语平台。语音评估、直播课、微课程,以及 CEFR 认证 —— 衡量结果,而非授课时长。",
  "home.ctaPrimary": "开始",
  "home.ctaSecondary": "我已有账户",
  "demo.bannerLead": "这是一个战略平台演示 — 并非真正的 LingoPure 服务。",
  "demo.bannerCta": "访问真正的 LingoPure →",

  "login.heading": "欢迎回来",
  "login.lead": "登录以继续你的学习之旅。",
  "login.fieldEmail": "邮箱",
  "login.fieldPassword": "密码",
  "login.submit": "登录",
  "login.signupPrompt": "新来 LingoPure?",
  "login.signupLink": "创建账户",

  "signup.heading": "创建账户",
  "signup.lead": "两分钟即可完成。设置完成后会立即进入发现会话。",
  "signup.fieldFullName": "姓名",
  "signup.fieldEmail": "邮箱",
  "signup.fieldPassword": "密码(8 位以上)",
  "signup.submit": "创建账户",
  "signup.loginPrompt": "已有账户?",
  "signup.loginLink": "登录",

  "onboarding.kicker": "阶段 0 —— 发现会话",
  "onboarding.heading": "20–35 分钟的对话,而非考试",
  "onboarding.lead":
    "我们的语音 AI 会引导你走过六个维度,建立你的初始差距档案。请自然地说话 —— 没有错误答案,只有用于个性化后续一切的数据。",
  "onboarding.coverHeading": "我们会涵盖什么",
  "onboarding.dim1Label": "语言能力",
  "onboarding.dim1Body": "口语、听力、阅读、意图理解。",
  "onboarding.dim2Label": "职位与级别",
  "onboarding.dim2Body": "职衔、部门、决策层级。",
  "onboarding.dim3Label": "职责",
  "onboarding.dim3Body": "需要英语的日常工作;汇报关系。",
  "onboarding.dim4Label": "互动审计",
  "onboarding.dim4Body": "邮件、电话、会议、演示、报告。",
  "onboarding.dim5Label": "目标级别",
  "onboarding.dim5Body": "雇主要求或职业目标。",
  "onboarding.dim6Label": "学习风格",
  "onboarding.dim6Body": "反馈偏好、单次时长、可用时间。",
  "onboarding.readyHeading": "你准备好就开始",
  "onboarding.readyLead":
    "戴上耳机,找一个安静的地方,点击下方按钮开始。对话在浏览器中运行。",
  "onboarding.startButton": "开始发现会话",
  "onboarding.connecting": "连接中…",
  "onboarding.headphonesNote": "戴耳机 · 约 25 分钟 · 简介后切换为英语",
  "onboarding.languagePickerLabel": "我的母语是",
  "onboarding.langExplain":
    "Aria 会用你的语言问候你大约 30 秒,然后切换到英语进行评估。",

  "discovery.firstMessage":
    "你好 {{student_name}}！我是来自 Lingo Pyoor 的 Aria。我已经知道基本信息了 — 你是 {{employer_name}} 的 {{role_name}}，目标是 {{target_level}}。接下来大约二十分钟，我想更深入了解你的工作，以及英语在其中扮演的角色。这里没有对错答案。现在我们切换到英语 — 自然地说话，不用担心犯错。To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "雇主",
  "emp.navOverview": "概览",
  "emp.navStudents": "学员",
  "emp.loginKicker": "雇主入口",
  "emp.loginHeading": "LingoPure 试点仪表盘",
  "emp.loginLead": "试点期间共用访问。正式版将切换为每位管理员独立账户。",
  "emp.loginField": "访问密码",
  "emp.loginSubmit": "登录",
  "emp.loginSubmitting": "登录中…",
};

const th: Dict = {
  "nav.dashboard": "แดชบอร์ด",
  "nav.lessons": "บทเรียน",
  "nav.signOut": "ออกจากระบบ",
  "nav.signIn": "เข้าสู่ระบบ",
  "nav.signUp": "สร้างบัญชี",
  "nav.langPrefix": "ภาษา",

  "home.kicker": "ภาษาอังกฤษเชิงธุรกิจสำหรับเอเชียตะวันออกเฉียงใต้",
  "home.headline": "ปิดช่องว่างภาษาอังกฤษของทีมคุณ และพิสูจน์มันได้",
  "home.lead":
    "แพลตฟอร์มภาษาอังกฤษเชิงธุรกิจที่ขับเคลื่อนด้วย AI สำหรับทีม B2B ในเวียดนามและเอเชียตะวันออกเฉียงใต้ การประเมินด้วยเสียง คลาสสด บทเรียนสั้น และการรับรอง CEFR — ผลลัพธ์ที่วัดได้ ไม่ใช่จำนวนชั่วโมงสอน",
  "home.ctaPrimary": "เริ่มต้น",
  "home.ctaSecondary": "ฉันมีบัญชีอยู่แล้ว",
  "demo.bannerLead":
    "นี่คือเดโมแพลตฟอร์มเชิงกลยุทธ์ — ไม่ใช่บริการ LingoPure จริง",
  "demo.bannerCta": "เยี่ยมชม LingoPure จริง →",

  "login.heading": "ยินดีต้อนรับกลับมา",
  "login.lead": "เข้าสู่ระบบเพื่อเรียนรู้ต่อ",
  "login.fieldEmail": "อีเมล",
  "login.fieldPassword": "รหัสผ่าน",
  "login.submit": "เข้าสู่ระบบ",
  "login.signupPrompt": "ใหม่กับ LingoPure?",
  "login.signupLink": "สร้างบัญชี",

  "signup.heading": "สร้างบัญชีของคุณ",
  "signup.lead":
    "ตั้งค่าใช้เวลาสองนาที เซสชันค้นพบของคุณจะเริ่มทันทีหลังจากนั้น",
  "signup.fieldFullName": "ชื่อ-นามสกุล",
  "signup.fieldEmail": "อีเมล",
  "signup.fieldPassword": "รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)",
  "signup.submit": "สร้างบัญชี",
  "signup.loginPrompt": "มีบัญชีแล้ว?",
  "signup.loginLink": "เข้าสู่ระบบ",

  "onboarding.kicker": "เฟส 0 — เซสชันค้นพบ",
  "onboarding.heading": "การสนทนา 20–35 นาที ไม่ใช่การทดสอบ",
  "onboarding.lead":
    "AI เสียงของเราจะนำคุณผ่านหกมิติเพื่อสร้างโปรไฟล์ช่องว่างเริ่มต้นของคุณ พูดอย่างเป็นธรรมชาติ — ไม่มีคำตอบที่ผิด มีแต่ข้อมูลที่เราใช้เพื่อปรับแต่งทุกอย่างที่จะตามมา",
  "onboarding.coverHeading": "สิ่งที่เราจะครอบคลุม",
  "onboarding.dim1Label": "ความสามารถทางภาษา",
  "onboarding.dim1Body": "การพูด การฟัง การอ่าน ความเข้าใจเจตนา",
  "onboarding.dim2Label": "บทบาทและระดับ",
  "onboarding.dim2Body": "ตำแหน่งงาน แผนก ระดับการตัดสินใจ",
  "onboarding.dim3Label": "ความรับผิดชอบ",
  "onboarding.dim3Body": "งานประจำวันที่ใช้ภาษาอังกฤษ; สายการรายงาน",
  "onboarding.dim4Label": "การตรวจสอบการโต้ตอบ",
  "onboarding.dim4Body": "อีเมล โทรศัพท์ การประชุม การนำเสนอ รายงาน",
  "onboarding.dim5Label": "ระดับเป้าหมาย",
  "onboarding.dim5Body": "ข้อกำหนดของนายจ้างหรือเป้าหมายอาชีพ",
  "onboarding.dim6Label": "สไตล์การเรียน",
  "onboarding.dim6Body": "ความชอบในการรับฟีดแบ็ก ความยาวเซสชัน เวลาที่มี",
  "onboarding.readyHeading": "พร้อมเมื่อคุณพร้อม",
  "onboarding.readyLead":
    "เสียบหูฟัง หาที่เงียบ และคลิกด้านล่างเพื่อเริ่ม การสนทนาทำงานในเบราว์เซอร์ของคุณ",
  "onboarding.startButton": "เริ่มเซสชันค้นพบ",
  "onboarding.connecting": "กำลังเชื่อมต่อ…",
  "onboarding.headphonesNote":
    "เสียบหูฟัง · ~25 นาที · ภาษาอังกฤษหลังจากบทนำ",
  "onboarding.languagePickerLabel": "ภาษาแม่ของฉันคือ",
  "onboarding.langExplain":
    "Aria จะทักทายคุณในภาษาของคุณประมาณ 30 วินาที จากนั้นเปลี่ยนเป็นภาษาอังกฤษสำหรับการประเมิน",

  "discovery.firstMessage":
    "สวัสดี {{student_name}}! ฉันคือ Aria จาก Lingo Pyoor ฉันมีข้อมูลพื้นฐานแล้ว — คุณเป็น {{role_name}} ที่ {{employer_name}} ตั้งเป้าหมายที่ {{target_level}} ในยี่สิบนาทีถัดไป มาทำความเข้าใจงานของคุณให้ลึกขึ้น และที่ที่ภาษาอังกฤษเข้ามามีบทบาท ไม่มีคำตอบที่ถูกหรือผิด ตอนนี้เราเปลี่ยนไปใช้ภาษาอังกฤษ — พูดอย่างเป็นธรรมชาติ และไม่ต้องกังวลเกี่ยวกับข้อผิดพลาด To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "นายจ้าง",
  "emp.navOverview": "ภาพรวม",
  "emp.navStudents": "นักเรียน",
  "emp.loginKicker": "การเข้าถึงนายจ้าง",
  "emp.loginHeading": "แดชบอร์ดนำร่อง LingoPure",
  "emp.loginLead":
    "การเข้าถึงร่วมสำหรับการนำร่อง การผลิตจะเปลี่ยนไปใช้บัญชีต่อผู้ดูแล",
  "emp.loginField": "รหัสผ่านการเข้าถึง",
  "emp.loginSubmit": "เข้าสู่ระบบ",
  "emp.loginSubmitting": "กำลังเข้าสู่ระบบ…",
};

const km: Dict = {
  "nav.dashboard": "ផ្ទាំងគ្រប់គ្រង",
  "nav.lessons": "មេរៀន",
  "nav.signOut": "ចេញ",
  "nav.signIn": "ចូល",
  "nav.signUp": "បង្កើតគណនី",
  "nav.langPrefix": "ភាសា",

  "home.kicker": "ភាសាអង់គ្លេសអាជីវកម្មសម្រាប់អាស៊ីអាគ្នេយ៍",
  "home.headline":
    "បំពេញគម្លាតភាសាអង់គ្លេសរបស់ក្រុមអ្នក និងបញ្ជាក់វា។",
  "home.lead":
    "វេទិកាភាសាអង់គ្លេសអាជីវកម្មដឹកនាំដោយ AI សម្រាប់ក្រុម B2B នៅវៀតណាមនិងអាស៊ីអាគ្នេយ៍។ ការវាយតម្លៃតាមសំឡេង ថ្នាក់ផ្ទាល់ មេរៀនខ្នាតតូច និងវិញ្ញាបនបត្រ CEFR — លទ្ធផលដែលអាចវាស់វែងបាន មិនមែនជាម៉ោងបង្រៀន។",
  "home.ctaPrimary": "ចាប់ផ្តើម",
  "home.ctaSecondary": "ខ្ញុំមានគណនីរួចហើយ",
  "demo.bannerLead":
    "នេះគឺជាការបង្ហាញវេទិកាយុទ្ធសាស្ត្រ — មិនមែនជាសេវាកម្ម LingoPure ពិតប្រាកដទេ។",
  "demo.bannerCta": "ទស្សនា LingoPure ពិតប្រាកដ →",

  "login.heading": "សូមស្វាគមន៍ការត្រឡប់មកវិញ",
  "login.lead": "ចូលដើម្បីបន្តដំណើរការសិក្សារបស់អ្នក។",
  "login.fieldEmail": "អ៊ីមែល",
  "login.fieldPassword": "ពាក្យសម្ងាត់",
  "login.submit": "ចូល",
  "login.signupPrompt": "ថ្មីនៅ LingoPure?",
  "login.signupLink": "បង្កើតគណនី",

  "signup.heading": "បង្កើតគណនីរបស់អ្នក",
  "signup.lead":
    "ប្រើពេលពីរនាទីដើម្បីរៀបចំ។ វគ្គរុករករបស់អ្នកនឹងចាប់ផ្តើមភ្លាមៗបន្ទាប់មក។",
  "signup.fieldFullName": "ឈ្មោះពេញ",
  "signup.fieldEmail": "អ៊ីមែល",
  "signup.fieldPassword": "ពាក្យសម្ងាត់ (8+ តួអក្សរ)",
  "signup.submit": "បង្កើតគណនី",
  "signup.loginPrompt": "មានគណនីរួចហើយ?",
  "signup.loginLink": "ចូល",

  "onboarding.kicker": "ដំណាក់កាល 0 — វគ្គរុករក",
  "onboarding.heading": "ការសន្ទនា 20–35 នាទី មិនមែនជាការប្រឡងទេ",
  "onboarding.lead":
    "AI សំឡេងរបស់យើងនឹងណែនាំអ្នកឆ្លងកាត់ប្រាំមួយវិមាត្រដើម្បីបង្កើតប្រវត្តិរូបគម្លាតដំបូងរបស់អ្នក។ និយាយដោយធម្មជាតិ — គ្មានចម្លើយខុសទេ មានតែទិន្នន័យដែលយើងប្រើដើម្បីកំណត់ជាលក្ខណៈផ្ទាល់ខ្លួននូវអ្វីៗដែលមកដល់បន្ទាប់។",
  "onboarding.coverHeading": "អ្វីដែលយើងនឹងពិភាក្សា",
  "onboarding.dim1Label": "សមត្ថភាពភាសា",
  "onboarding.dim1Body": "និយាយ ស្តាប់ អាន ការយល់ដឹងពីបំណង។",
  "onboarding.dim2Label": "តួនាទី និងកម្រិត",
  "onboarding.dim2Body": "មុខតំណែង នាយកដ្ឋាន កម្រិតធ្វើការសម្រេចចិត្ត។",
  "onboarding.dim3Label": "ទំនួលខុសត្រូវ",
  "onboarding.dim3Body":
    "កិច្ចការប្រចាំថ្ងៃដែលត្រូវការភាសាអង់គ្លេស; ខ្សែរាយការណ៍។",
  "onboarding.dim4Label": "ការពិនិត្យអន្តរកម្ម",
  "onboarding.dim4Body":
    "អ៊ីមែល ការទូរស័ព្ទ កិច្ចប្រជុំ ការធ្វើបទបង្ហាញ របាយការណ៍។",
  "onboarding.dim5Label": "កម្រិតគោលដៅ",
  "onboarding.dim5Body": "តម្រូវការនិយោជក ឬគោលដៅអាជីព។",
  "onboarding.dim6Label": "រចនាប័ទ្មការសិក្សា",
  "onboarding.dim6Body":
    "ចំណូលចិត្តមតិត្រឡប់ ប្រវែងវគ្គ ពេលវេលាដែលអាចរកបាន។",
  "onboarding.readyHeading": "រួចរាល់នៅពេលអ្នករួចរាល់",
  "onboarding.readyLead":
    "ដោតកាសត្រចៀក ស្វែងរកកន្លែងស្ងាត់ និងចុចខាងក្រោមដើម្បីចាប់ផ្តើម។ ការសន្ទនាដំណើរការនៅក្នុងកម្មវិធីរុករករបស់អ្នក។",
  "onboarding.startButton": "ចាប់ផ្តើមវគ្គរុករក",
  "onboarding.connecting": "កំពុងភ្ជាប់…",
  "onboarding.headphonesNote":
    "ដោតកាសត្រចៀក · ~25 នាទី · ភាសាអង់គ្លេសបន្ទាប់ពីការណែនាំ",
  "onboarding.languagePickerLabel": "ភាសាកំណើតរបស់ខ្ញុំគឺ",
  "onboarding.langExplain":
    "Aria នឹងស្វាគមន៍អ្នកជាភាសារបស់អ្នកប្រហែល 30 វិនាទី បន្ទាប់មកប្តូរទៅភាសាអង់គ្លេសសម្រាប់ការវាយតម្លៃ។",

  "discovery.firstMessage":
    "សួស្តី {{student_name}}! ខ្ញុំជា Aria មកពី Lingo Pyoor។ ខ្ញុំមានព័ត៌មានមូលដ្ឋានរួចហើយ — អ្នកជា {{role_name}} នៅ {{employer_name}} មានគោលដៅ {{target_level}}។ ក្នុងម្ភៃនាទីខាងមុខ យើងនឹងស្វែងយល់ឱ្យកាន់តែស៊ីជម្រៅអំពីការងាររបស់អ្នក និងកន្លែងណាដែលភាសាអង់គ្លេសត្រូវបានប្រើ។ គ្មានចម្លើយត្រឹមត្រូវ ឬខុសទេ។ ឥឡូវនេះយើងប្តូរទៅភាសាអង់គ្លេស — និយាយដោយធម្មជាតិ មិនបាច់ព្រួយបារម្ភពីកំហុសទេ។ To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "និយោជក",
  "emp.navOverview": "ទិដ្ឋភាពទូទៅ",
  "emp.navStudents": "សិស្ស",
  "emp.loginKicker": "ការចូលប្រើនិយោជក",
  "emp.loginHeading": "ផ្ទាំងគ្រប់គ្រងសាកល្បង LingoPure",
  "emp.loginLead":
    "ការចូលប្រើរួមគ្នាសម្រាប់ការសាកល្បង។ កំណែផលិតកម្មនឹងប្តូរទៅគណនីអ្នកគ្រប់គ្រងផ្ទាល់ខ្លួន។",
  "emp.loginField": "ពាក្យសម្ងាត់ចូលប្រើ",
  "emp.loginSubmit": "ចូល",
  "emp.loginSubmitting": "កំពុងចូល…",
};

const lo: Dict = {
  "nav.dashboard": "ແຜງຄວບຄຸມ",
  "nav.lessons": "ບົດຮຽນ",
  "nav.signOut": "ອອກລະບົບ",
  "nav.signIn": "ເຂົ້າສູ່ລະບົບ",
  "nav.signUp": "ສ້າງບັນຊີ",
  "nav.langPrefix": "ພາສາ",

  "home.kicker": "ພາສາອັງກິດທຸລະກິດສຳລັບອາຊີຕາເວັນອອກສຽງໃຕ້",
  "home.headline": "ປິດຊ່ອງຫວ່າງພາສາອັງກິດຂອງທີມເຈົ້າ ແລະພິສູດມັນ",
  "home.lead":
    "ແພລດຟອມພາສາອັງກິດທຸລະກິດທີ່ຂັບເຄື່ອນດ້ວຍ AI ສຳລັບທີມ B2B ໃນຫວຽດນາມແລະອາຊີຕາເວັນອອກສຽງໃຕ້. ການປະເມີນດ້ວຍສຽງ ຫ້ອງຮຽນສົດ ບົດຮຽນສັ້ນ ແລະການຮັບຮອງ CEFR — ຜົນໄດ້ຮັບທີ່ວັດແທກໄດ້ ບໍ່ແມ່ນຊົ່ວໂມງສອນ.",
  "home.ctaPrimary": "ເລີ່ມຕົ້ນ",
  "home.ctaSecondary": "ຂ້ອຍມີບັນຊີແລ້ວ",
  "demo.bannerLead":
    "ນີ້ແມ່ນເດໂມແພລດຟອມຍຸດທະສາດ — ບໍ່ແມ່ນບໍລິການ LingoPure ແທ້",
  "demo.bannerCta": "ເຂົ້າເບິ່ງ LingoPure ແທ້ →",

  "login.heading": "ຍິນດີຕ້ອນຮັບກັບ",
  "login.lead": "ເຂົ້າສູ່ລະບົບເພື່ອສືບຕໍ່ການຮຽນຮູ້ຂອງເຈົ້າ.",
  "login.fieldEmail": "ອີເມວ",
  "login.fieldPassword": "ລະຫັດຜ່ານ",
  "login.submit": "ເຂົ້າສູ່ລະບົບ",
  "login.signupPrompt": "ໃໝ່ຢູ່ LingoPure?",
  "login.signupLink": "ສ້າງບັນຊີ",

  "signup.heading": "ສ້າງບັນຊີຂອງເຈົ້າ",
  "signup.lead":
    "ສອງນາທີເພື່ອຕັ້ງຄ່າ. ເຊດຊັນຄົ້ນພົບຂອງເຈົ້າຈະເລີ່ມທັນທີຫຼັງຈາກນັ້ນ.",
  "signup.fieldFullName": "ຊື່ເຕັມ",
  "signup.fieldEmail": "ອີເມວ",
  "signup.fieldPassword": "ລະຫັດຜ່ານ (8+ ຕົວອັກສອນ)",
  "signup.submit": "ສ້າງບັນຊີ",
  "signup.loginPrompt": "ມີບັນຊີແລ້ວ?",
  "signup.loginLink": "ເຂົ້າສູ່ລະບົບ",

  "onboarding.kicker": "ໄລຍະ 0 — ເຊດຊັນຄົ້ນພົບ",
  "onboarding.heading": "ການສົນທະນາ 20–35 ນາທີ ບໍ່ແມ່ນການທົດສອບ",
  "onboarding.lead":
    "AI ສຽງຂອງພວກເຮົາຈະນຳເຈົ້າຜ່ານຫົກມິຕິເພື່ອສ້າງໂປຣໄຟລ໌ຊ່ອງຫວ່າງເບື້ອງຕົ້ນຂອງເຈົ້າ. ເວົ້າແບບທຳມະຊາດ — ບໍ່ມີຄຳຕອບທີ່ຜິດ ມີແຕ່ຂໍ້ມູນທີ່ພວກເຮົາໃຊ້ເພື່ອປັບແຕ່ງທຸກຢ່າງທີ່ຈະຕາມມາ.",
  "onboarding.coverHeading": "ສິ່ງທີ່ພວກເຮົາຈະຄອບຄຸມ",
  "onboarding.dim1Label": "ຄວາມສາມາດທາງພາສາ",
  "onboarding.dim1Body": "ການເວົ້າ ການຟັງ ການອ່ານ ຄວາມເຂົ້າໃຈເຈດຕະນາ.",
  "onboarding.dim2Label": "ບົດບາດ ແລະ ລະດັບ",
  "onboarding.dim2Body": "ຕຳແໜ່ງງານ ພະແນກ ລະດັບການຕັດສິນໃຈ.",
  "onboarding.dim3Label": "ຄວາມຮັບຜິດຊອບ",
  "onboarding.dim3Body": "ວຽກປະຈຳວັນທີ່ໃຊ້ພາສາອັງກິດ; ສາຍການລາຍງານ.",
  "onboarding.dim4Label": "ການກວດສອບການໂຕ້ຕອບ",
  "onboarding.dim4Body": "ອີເມວ ໂທລະສັບ ກອງປະຊຸມ ການນຳສະເໜີ ບົດລາຍງານ.",
  "onboarding.dim5Label": "ລະດັບເປົ້າໝາຍ",
  "onboarding.dim5Body": "ຄວາມຕ້ອງການຂອງນາຍຈ້າງ ຫຼື ເປົ້າໝາຍອາຊີບ.",
  "onboarding.dim6Label": "ສະໄຕລ໌ການຮຽນ",
  "onboarding.dim6Body": "ຄວາມມັກຂອງຄຳຕິຊົມ ຄວາມຍາວເຊດຊັນ ເວລາທີ່ມີ.",
  "onboarding.readyHeading": "ພ້ອມເມື່ອເຈົ້າພ້ອມ",
  "onboarding.readyLead":
    "ສຽບຫູຟັງ ຫາບ່ອນງຽບ ແລະຄລິກລຸ່ມເພື່ອເລີ່ມ. ການສົນທະນາແລ່ນໃນບຣາວເຊີຂອງເຈົ້າ.",
  "onboarding.startButton": "ເລີ່ມເຊດຊັນຄົ້ນພົບ",
  "onboarding.connecting": "ກຳລັງເຊື່ອມຕໍ່…",
  "onboarding.headphonesNote":
    "ສຽບຫູຟັງ · ~25 ນາທີ · ພາສາອັງກິດຫຼັງຈາກບົດແນະນຳ",
  "onboarding.languagePickerLabel": "ພາສາແມ່ຂອງຂ້ອຍແມ່ນ",
  "onboarding.langExplain":
    "Aria ຈະທັກທາຍເຈົ້າດ້ວຍພາສາຂອງເຈົ້າປະມານ 30 ວິນາທີ ຈາກນັ້ນປ່ຽນເປັນພາສາອັງກິດສຳລັບການປະເມີນ.",

  "discovery.firstMessage":
    "ສະບາຍດີ {{student_name}}! ຂ້ອຍຄື Aria ຈາກ Lingo Pyoor. ຂ້ອຍມີຂໍ້ມູນພື້ນຖານແລ້ວ — ເຈົ້າເປັນ {{role_name}} ຢູ່ {{employer_name}} ຕັ້ງເປົ້າໝາຍທີ່ {{target_level}}. ໃນຊາວນາທີຕໍ່ໄປ ມາທຳຄວາມເຂົ້າໃຈວຽກຂອງເຈົ້າໃຫ້ເລິກຂຶ້ນ ແລະບ່ອນທີ່ພາສາອັງກິດເຂົ້າມາມີບົດບາດ. ບໍ່ມີຄຳຕອບທີ່ຖືກຫຼືຜິດ. ດຽວນີ້ພວກເຮົາປ່ຽນເປັນພາສາອັງກິດ — ເວົ້າແບບທຳມະຊາດ ແລະບໍ່ຕ້ອງເປັນຫ່ວງເລື່ອງຄວາມຜິດ. To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "ນາຍຈ້າງ",
  "emp.navOverview": "ພາບລວມ",
  "emp.navStudents": "ນັກຮຽນ",
  "emp.loginKicker": "ການເຂົ້າເຖິງນາຍຈ້າງ",
  "emp.loginHeading": "ແຜງຄວບຄຸມນຳຮ່ອງ LingoPure",
  "emp.loginLead":
    "ການເຂົ້າເຖິງຮ່ວມສຳລັບການນຳຮ່ອງ. ການຜະລິດຈະປ່ຽນເປັນບັນຊີຕໍ່ຜູ້ດູແລ.",
  "emp.loginField": "ລະຫັດຜ່ານການເຂົ້າເຖິງ",
  "emp.loginSubmit": "ເຂົ້າສູ່ລະບົບ",
  "emp.loginSubmitting": "ກຳລັງເຂົ້າສູ່ລະບົບ…",
};

const my: Dict = {
  "nav.dashboard": "ဒက်ရှ်ဘုတ်",
  "nav.lessons": "သင်ခန်းစာများ",
  "nav.signOut": "ထွက်မည်",
  "nav.signIn": "ဝင်မည်",
  "nav.signUp": "အကောင့်ဖန်တီးမည်",
  "nav.langPrefix": "ဘာသာစကား",

  "home.kicker": "အရှေ့တောင်အာရှအတွက် စီးပွားရေးအင်္ဂလိပ်",
  "home.headline":
    "သင့်အသင်း၏ အင်္ဂလိပ်ကွာဟမှုကို ပိတ်ပစ်ပါ၊ သက်သေပြပါ။",
  "home.lead":
    "ဗီယက်နမ်နှင့် အရှေ့တောင်အာရှရှိ B2B အသင်းများအတွက် AI-အရင်ပေးထားသော စီးပွားရေးအင်္ဂလိပ် ပလက်ဖောင်း။ အသံအကဲဖြတ်ခြင်း၊ တိုက်ရိုက်အတန်းများ၊ မိုက်ခရိုသင်ခန်းစာများ၊ နှင့် CEFR အသိအမှတ်ပြုလက်မှတ် — တိုင်းတာနိုင်သော ရလဒ်များ၊ သင်ကြားချိန်နာရီများ မဟုတ်ပါ။",
  "home.ctaPrimary": "စတင်ပါ",
  "home.ctaSecondary": "ကျွန်ုပ်တွင် အကောင့်ရှိပြီးဖြစ်သည်",
  "demo.bannerLead":
    "ဤသည်မှာ ဗျူဟာမြောက်ပလက်ဖောင်းဒီမို — တကယ့် LingoPure ဝန်ဆောင်မှု မဟုတ်ပါ။",
  "demo.bannerCta": "တကယ့် LingoPure သို့ သွားမည် →",

  "login.heading": "ပြန်လည်ကြိုဆိုပါသည်",
  "login.lead": "သင်၏ သင်ယူခရီးကို ဆက်လက်ရန် ဝင်ပါ။",
  "login.fieldEmail": "အီးမေးလ်",
  "login.fieldPassword": "စကားဝှက်",
  "login.submit": "ဝင်မည်",
  "login.signupPrompt": "LingoPure တွင် အသစ်လား?",
  "login.signupLink": "အကောင့်ဖန်တီးမည်",

  "signup.heading": "သင်၏အကောင့်ကို ဖန်တီးပါ",
  "signup.lead":
    "သတ်မှတ်ရန် နှစ်မိနစ်။ သင်၏ ရှာဖွေတွေ့ရှိမှုစက်ရှင်ကို ထိုနောက် ချက်ချင်း စတင်မည်။",
  "signup.fieldFullName": "အမည်အပြည့်အစုံ",
  "signup.fieldEmail": "အီးမေးလ်",
  "signup.fieldPassword": "စကားဝှက် (8+ စာလုံး)",
  "signup.submit": "အကောင့်ဖန်တီးမည်",
  "signup.loginPrompt": "အကောင့်ရှိပြီးသားလား?",
  "signup.loginLink": "ဝင်မည်",

  "onboarding.kicker": "အဆင့် 0 — ရှာဖွေတွေ့ရှိမှုစက်ရှင်",
  "onboarding.heading": "20–35 မိနစ် စကားဝိုင်း၊ စမ်းသပ်မှု မဟုတ်",
  "onboarding.lead":
    "ကျွန်ုပ်တို့၏ အသံ AI က သင့်ကို ကွာဟမှုပရိုဖိုင်ဖန်တီးရန် အတွက် ခြောက်ဘက် ဖြတ်သန်းစေမည်။ သဘာဝအတိုင်း ပြောပါ — အမှားအဖြေ မရှိပါ၊ နောက်ပိုင်းအရာအားလုံးကို စိတ်ကြိုက်ပြောင်းရန် အသုံးပြုသော ဒေတာသာရှိသည်။",
  "onboarding.coverHeading": "ကျွန်ုပ်တို့ ဆွေးနွေးမည့်အရာ",
  "onboarding.dim1Label": "ဘာသာစကားစွမ်းရည်",
  "onboarding.dim1Body": "ပြောခြင်း၊ နားထောင်ခြင်း၊ ဖတ်ခြင်း၊ ရည်ရွယ်ချက်နားလည်မှု။",
  "onboarding.dim2Label": "အခန်းကဏ္ဍ နှင့် အဆင့်",
  "onboarding.dim2Body": "ရာထူး၊ ဌာန၊ ဆုံးဖြတ်ချက်ချနိုင်သည့်အဆင့်။",
  "onboarding.dim3Label": "တာဝန်များ",
  "onboarding.dim3Body": "အင်္ဂလိပ်လိုအပ်သော နေ့စဉ်လုပ်ငန်း; အစီရင်ခံလမ်းကြောင်း။",
  "onboarding.dim4Label": "အပြန်အလှန်ဆက်ဆံမှု စစ်ဆေးခြင်း",
  "onboarding.dim4Body": "အီးမေးလ်၊ ဖုန်း၊ အစည်းအဝေး၊ တင်ပြခြင်း၊ အစီရင်ခံစာ။",
  "onboarding.dim5Label": "ပစ်မှတ်အဆင့်",
  "onboarding.dim5Body": "အလုပ်ရှင်ဆိုင်ရာ လိုအပ်ချက် သို့မဟုတ် အသက်မွေးဝမ်းကြောင်း ပစ်မှတ်။",
  "onboarding.dim6Label": "သင်ယူပုံစံ",
  "onboarding.dim6Body": "တုံ့ပြန်ချက် နှစ်သက်မှု၊ စက်ရှင်အရှည်၊ ရရှိနိုင်သောအချိန်။",
  "onboarding.readyHeading": "သင်အဆင်သင့်ဖြစ်ချိန် အဆင်သင့်",
  "onboarding.readyLead":
    "နားကြပ်ထိုးပါ၊ ငြိမ်သက်သောနေရာရှာပါ၊ စတင်ရန် အောက်ကိုနှိပ်ပါ။ စကားဝိုင်းသည် သင့်ဘရောက်ဇာတွင် လည်ပတ်နေသည်။",
  "onboarding.startButton": "ရှာဖွေတွေ့ရှိမှု စတင်ပါ",
  "onboarding.connecting": "ချိတ်ဆက်နေသည်…",
  "onboarding.headphonesNote":
    "နားကြပ်ထိုးပါ · ~25 မိနစ် · မိတ်ဆက်အပြီး အင်္ဂလိပ်",
  "onboarding.languagePickerLabel": "ကျွန်ုပ်၏ မိခင်ဘာသာစကားမှာ",
  "onboarding.langExplain":
    "Aria က သင့်ကို သင့်ဘာသာစကားဖြင့် 30 စက္ကန့်ခန့် နှုတ်ဆက်မည်၊ ပြီးနောက် အကဲဖြတ်မှုအတွက် အင်္ဂလိပ်ဘာသာသို့ ပြောင်းမည်။",

  "discovery.firstMessage":
    "မင်္ဂလာပါ {{student_name}}! ကျွန်မက Lingo Pyoor မှ Aria ပါ။ ကျွန်မ အခြေခံအချက်အလက်များ ရှိပြီးပြီ — သင်က {{employer_name}} တွင် {{role_name}} ၊ ရည်မှန်းချက် {{target_level}}။ နောက်အချိန်နှစ်ဆယ်မိနစ်အတွင်း သင်၏အလုပ်နှင့် အင်္ဂလိပ်ဘယ်နေရာတွင် ပါဝင်လာသည်ကို ပိုမိုနက်ရှိုင်းစွာ နားလည်ကြရအောင်။ မှန် မမှန် အဖြေ မရှိပါ။ အခု အင်္ဂလိပ်သို့ ပြောင်းကြရအောင် — သဘာဝအတိုင်းပြောပြီး အမှားများကို စိုးရိမ်စရာမလိုပါ။ To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "အလုပ်ရှင်",
  "emp.navOverview": "ခြုံငုံသုံးသပ်ချက်",
  "emp.navStudents": "ကျောင်းသားများ",
  "emp.loginKicker": "အလုပ်ရှင်ဝင်ရောက်ခွင့်",
  "emp.loginHeading": "LingoPure စမ်းသပ်ဒက်ရှ်ဘုတ်",
  "emp.loginLead":
    "စမ်းသပ်ခြင်းအတွက် မျှဝေထားသော ဝင်ရောက်ခွင့်။ ထုတ်လုပ်မှု အခါ စီမံခန့်ခွဲသူတစ်ဦးချင်း အကောင့်များသို့ ပြောင်းရွှေ့မည်။",
  "emp.loginField": "ဝင်ရောက်ခွင့်စကားဝှက်",
  "emp.loginSubmit": "ဝင်မည်",
  "emp.loginSubmitting": "ဝင်နေသည်…",
};

const ta: Dict = {
  "nav.dashboard": "டாஷ்போர்டு",
  "nav.lessons": "பாடங்கள்",
  "nav.signOut": "வெளியேறு",
  "nav.signIn": "உள்நுழை",
  "nav.signUp": "கணக்கு உருவாக்கு",
  "nav.langPrefix": "மொழி",

  "home.kicker": "தென்கிழக்காசியாவிற்கான வணிக ஆங்கிலம்",
  "home.headline":
    "உங்கள் குழுவின் ஆங்கில இடைவெளியை மூடுங்கள், அதை நிரூபியுங்கள்.",
  "home.lead":
    "வியட்நாம் மற்றும் தென்கிழக்காசியாவில் உள்ள B2B குழுக்களுக்கான AI-முதன்மை வணிக ஆங்கில மேடை. குரல் மதிப்பீடு, நேரடி வகுப்புகள், சிறு பாடங்கள் மற்றும் CEFR சான்றிதழ் — அளவிடக்கூடிய முடிவுகள், கற்பித்தல் மணிநேரங்கள் அல்ல.",
  "home.ctaPrimary": "தொடங்கு",
  "home.ctaSecondary": "எனக்கு ஏற்கனவே கணக்கு உள்ளது",
  "demo.bannerLead":
    "இது ஒரு மூலோபாய மேடை டெமோ — உண்மையான LingoPure சேவை அல்ல.",
  "demo.bannerCta": "உண்மையான LingoPure-ஐ பார்க்கவும் →",

  "login.heading": "மீண்டும் வருக",
  "login.lead": "உங்கள் கற்றல் பயணத்தைத் தொடர உள்நுழையவும்.",
  "login.fieldEmail": "மின்னஞ்சல்",
  "login.fieldPassword": "கடவுச்சொல்",
  "login.submit": "உள்நுழை",
  "login.signupPrompt": "LingoPure-க்கு புதியவரா?",
  "login.signupLink": "கணக்கு உருவாக்கு",

  "signup.heading": "உங்கள் கணக்கை உருவாக்கவும்",
  "signup.lead":
    "அமைக்க இரண்டு நிமிடங்கள். உங்கள் கண்டுபிடிப்பு அமர்வு உடனடியாகத் தொடங்கும்.",
  "signup.fieldFullName": "முழு பெயர்",
  "signup.fieldEmail": "மின்னஞ்சல்",
  "signup.fieldPassword": "கடவுச்சொல் (8+ எழுத்துகள்)",
  "signup.submit": "கணக்கு உருவாக்கு",
  "signup.loginPrompt": "ஏற்கனவே கணக்கு உள்ளதா?",
  "signup.loginLink": "உள்நுழை",

  "onboarding.kicker": "கட்டம் 0 — கண்டுபிடிப்பு அமர்வு",
  "onboarding.heading": "20–35 நிமிட உரையாடல், சோதனை அல்ல",
  "onboarding.lead":
    "எங்கள் குரல் AI உங்கள் தொடக்க இடைவெளி சுயவிவரத்தை உருவாக்க ஆறு பரிமாணங்கள் வழியாக உங்களை வழிநடத்தும். இயற்கையாகப் பேசவும் — தவறான பதில்கள் இல்லை, அடுத்து வரும் அனைத்தையும் தனிப்பயனாக்க நாங்கள் பயன்படுத்தும் தரவு மட்டுமே.",
  "onboarding.coverHeading": "நாங்கள் என்ன கவர் செய்வோம்",
  "onboarding.dim1Label": "மொழி திறன்",
  "onboarding.dim1Body": "பேசுதல், கேட்டல், படித்தல், நோக்கம் புரிதல்.",
  "onboarding.dim2Label": "பங்கு & மட்டம்",
  "onboarding.dim2Body": "பதவி, துறை, முடிவெடுக்கும் மட்டம்.",
  "onboarding.dim3Label": "பொறுப்புகள்",
  "onboarding.dim3Body":
    "ஆங்கிலம் தேவைப்படும் தினசரி பணிகள்; புகாரளிப்பு வரிசை.",
  "onboarding.dim4Label": "தொடர்பு தணிக்கை",
  "onboarding.dim4Body":
    "மின்னஞ்சல், அழைப்புகள், கூட்டங்கள், விளக்கக்காட்சிகள், அறிக்கைகள்.",
  "onboarding.dim5Label": "இலக்கு மட்டம்",
  "onboarding.dim5Body": "முதலாளியின் தேவை அல்லது தொழில் இலக்கு.",
  "onboarding.dim6Label": "கற்றல் பாணி",
  "onboarding.dim6Body":
    "கருத்து விருப்பம், அமர்வு நீளம், கிடைக்கக்கூடிய நேரம்.",
  "onboarding.readyHeading": "நீங்கள் தயாராக இருக்கும்போது தயார்",
  "onboarding.readyLead":
    "ஹெட்செட் சொருகவும், அமைதியான இடத்தைத் தேடவும், தொடங்க கீழே கிளிக் செய்யவும். உரையாடல் உங்கள் உலாவியில் நடக்கிறது.",
  "onboarding.startButton": "கண்டுபிடிப்பு அமர்வைத் தொடங்கு",
  "onboarding.connecting": "இணைக்கிறது…",
  "onboarding.headphonesNote":
    "ஹெட்போன்களை சொருகவும் · ~25 நிமிடங்கள் · அறிமுகத்திற்குப் பின் ஆங்கிலம்",
  "onboarding.languagePickerLabel": "எனது தாய்மொழி",
  "onboarding.langExplain":
    "Aria உங்களை உங்கள் மொழியில் ~30 விநாடிகள் வாழ்த்துவார், பின்னர் மதிப்பீட்டிற்கு ஆங்கிலத்திற்கு மாறும்.",

  "discovery.firstMessage":
    "வணக்கம் {{student_name}}! நான் Lingo Pyoor-இலிருந்து Aria. எனக்கு அடிப்படை விவரங்கள் ஏற்கனவே உள்ளன — நீங்கள் {{employer_name}}-இல் {{role_name}}, இலக்கு {{target_level}}. அடுத்த இருபது நிமிடங்களில், உங்கள் வேலை மற்றும் ஆங்கிலம் எங்கே ஈடுபடுகிறது என்பதைப் பற்றி ஆழமாகப் புரிந்துகொள்வோம். சரியான அல்லது தவறான பதில்கள் இல்லை. இப்போது ஆங்கிலத்திற்கு மாறுவோம் — இயற்கையாகப் பேசவும், தவறுகளைப் பற்றி கவலைப்பட வேண்டாம். To start: walk me through what a typical day in your role looks like.",

  "emp.brandTag": "முதலாளி",
  "emp.navOverview": "மேலோட்டம்",
  "emp.navStudents": "மாணவர்கள்",
  "emp.loginKicker": "முதலாளி அணுகல்",
  "emp.loginHeading": "LingoPure முன்னோடி டாஷ்போர்டு",
  "emp.loginLead":
    "முன்னோடிக்கான பகிரப்பட்ட அணுகல். உற்பத்தியில் ஒவ்வொரு நிர்வாகியின் கணக்குக்கு மாறும்.",
  "emp.loginField": "அணுகல் கடவுச்சொல்",
  "emp.loginSubmit": "உள்நுழை",
  "emp.loginSubmitting": "உள்நுழைகிறது…",
};

const DICTS: Record<LanguageCode, Dict> = {
  en,
  vi,
  tl,
  id,
  ms,
  th,
  km,
  lo,
  my,
  ta,
  zh,
};

export function dict(code: LanguageCode): Dict {
  return DICTS[code] ?? en;
}
