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
  { code: "zh", name: "中文", flag: "🇨🇳" },
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
    "Hi {{student_name}}! I'm Aria from Lingo Pure. I've got the basics already — {{role_name}} at {{employer_name}}, aiming for {{target_level}}. We'll spend the next twenty or so minutes getting to know what's behind that — what your week actually looks like, where English shows up. No right or wrong answers. To start: walk me through what a typical day in your role looks like.",

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
    "Xin chào {{student_name}}! Tôi là Aria từ Lingo Pure. Tôi đã có thông tin cơ bản — bạn là {{role_name}} tại {{employer_name}}, với mục tiêu {{target_level}}. Chúng ta sẽ dành khoảng hai mươi phút tới để tìm hiểu sâu hơn về công việc của bạn và nơi tiếng Anh xuất hiện. Không có câu trả lời đúng hay sai. Bây giờ chúng ta hãy chuyển sang tiếng Anh — hãy nói tự nhiên và đừng lo lắng về lỗi. To start: walk me through what a typical day in your role looks like.",

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
    "Kumusta {{student_name}}! Ako si Aria mula sa Lingo Pure. Mayroon na akong mga pangunahing detalye — {{role_name}} ka sa {{employer_name}}, layunin mong maabot ang {{target_level}}. Sa susunod na dalawampung minuto, kilalanin natin nang mas malalim ang iyong trabaho at kung saan pumapasok ang English. Walang tama o maling sagot. Ngayon, magsa-shift na tayo sa English — magsalita lang nang natural at huwag mag-alala sa mga pagkakamali. To start: walk me through what a typical day in your role looks like.",

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
    "Halo {{student_name}}! Saya Aria dari Lingo Pure. Saya sudah memiliki informasi dasar — Anda adalah {{role_name}} di {{employer_name}}, dengan target {{target_level}}. Selama dua puluh menit ke depan, mari kita pahami lebih dalam tentang pekerjaan Anda dan di mana bahasa Inggris berperan. Tidak ada jawaban benar atau salah. Sekarang mari kita beralih ke bahasa Inggris — bicaralah secara alami dan jangan khawatir tentang kesalahan. To start: walk me through what a typical day in your role looks like.",

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
    "Helo {{student_name}}! Saya Aria daripada Lingo Pure. Saya sudah ada maklumat asas — anda {{role_name}} di {{employer_name}}, dengan sasaran {{target_level}}. Dalam dua puluh minit akan datang, mari kita fahami dengan lebih mendalam tentang kerja anda dan di mana bahasa Inggeris terlibat. Tiada jawapan betul atau salah. Sekarang mari kita beralih kepada bahasa Inggeris — bercakaplah secara semula jadi dan jangan risau tentang kesilapan. To start: walk me through what a typical day in your role looks like.",

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
    "你好 {{student_name}}！我是来自 Lingo Pure 的 Aria。我已经知道基本信息了 — 你是 {{employer_name}} 的 {{role_name}}，目标是 {{target_level}}。接下来大约二十分钟，我想更深入了解你的工作，以及英语在其中扮演的角色。这里没有对错答案。现在我们切换到英语 — 自然地说话，不用担心犯错。To start: walk me through what a typical day in your role looks like.",

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

const DICTS: Record<LanguageCode, Dict> = { en, vi, tl, id, ms, zh };

export function dict(code: LanguageCode): Dict {
  return DICTS[code] ?? en;
}
