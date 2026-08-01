/**
 * HR module dictionary — English and Vietnamese.
 *
 * WHY THIS IS NOT `src/lib/i18n`. Two reasons, and the second is the real one:
 *
 *   1. That dictionary resolves a user's language from `students.native_language`.
 *      HR has no business reading a student table, and an employee is not a
 *      student.
 *   2. The module is built to be lifted into another repo, which may have no
 *      i18n layer at all. Importing the host's would put a second entry in
 *      `deps.ts` for something the destination cannot be assumed to provide.
 *
 * Same SHAPE as the host's, deliberately — dot-notation keys, English as source
 * of truth, missing translations falling back rather than rendering a key. If
 * the two ever want to merge, that is a lift rather than a rewrite.
 *
 * SCOPE. Everything a person reads: navigation, labels, buttons, status,
 * explanatory headers, validation messages, and the notification emails. Unlike
 * the host product — where the English content IS the thing being sold — there
 * is nothing here that should stay English on purpose. The staff are
 * Vietnamese; the default is Vietnamese.
 */

export type HrLocale = "en" | "vi";

export const HR_LOCALES: Array<{ code: HrLocale; name: string }> = [
  { code: "vi", name: "Tiếng Việt" },
  { code: "en", name: "English" },
];

export const HR_DEFAULT_LOCALE: HrLocale = "vi";

export function isHrLocale(value: unknown): value is HrLocale {
  return value === "en" || value === "vi";
}

type Dict = Record<string, string>;

/**
 * English. The source of truth — every key exists here, and a key missing from
 * `vi` falls back to this rather than rendering the key itself. A user seeing
 * `nav.overview` on screen is worse than a user seeing the wrong language.
 */
const en: Dict = {
  // ── Navigation and chrome ────────────────────────────────────────────────
  "nav.overview": "Overview",
  "nav.myLeave": "My leave",
  "nav.calendar": "Team calendar",
  "nav.approvals": "Approvals",
  "nav.team": "Team members",
  "nav.holidays": "Public holidays",
  "nav.settings": "Settings",
  "nav.signOut": "Sign out",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.people": "People",

  // ── Roles and statuses ───────────────────────────────────────────────────
  "role.super_admin": "Super Admin",
  "role.admin": "Manager",
  "role.staff": "Staff",
  "status.active": "Active",
  "status.invited": "Invited",
  "status.deactivated": "Deactivated",
  "request.pending": "Awaiting decision",
  "request.approved": "Approved",
  "request.declined": "Declined",
  "request.cancelled": "Cancelled",

  // ── Common ───────────────────────────────────────────────────────────────
  "common.day": "day",
  "common.days": "days",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.remove": "Remove",
  "common.back": "Back",
  "common.saving": "Saving…",
  "common.none": "—",
  "common.companyDefault": "Company default",
  "common.today": "Today",
  "common.required": "required",

  // ── Dashboard ────────────────────────────────────────────────────────────
  "home.greeting": "Hello, {name}",
  "home.intro":
    "Your leave balance, who is away, and what needs your attention. Days are deducted only after a request is approved.",
  "home.requestLeave": "Request leave",
  "home.waitingTitle": "Waiting for you",
  "home.waitingNone": "Nothing from your team needs a decision right now.",
  "home.waitingSome": "{count} leave requests from your team.",
  "home.waitingReview": "Review them",
  "home.offTodayTitle": "Off today",
  "home.offTodayIntro":
    "Who is unavailable on {date}. Reasons stay private to the person and their manager.",
  "home.offTodayNone": "Everyone is in today.",
  "home.holidaysTitle": "Public holidays",
  "home.holidaysIntro":
    "Upcoming days off for everyone. These never come out of your balance.",
  "home.holidaysNone": "No public holidays are on the calendar yet.",
  "home.holidaysHint":
    "A Super Admin adds these. Until then, holidays are not excluded from leave day counts.",
  "home.recentTitle": "Your recent requests",
  "home.recentNone": "You have not requested any leave yet.",
  "home.seeAll": "See all my requests",
  "home.signedInAs": "Signed in as {name}",
  "home.usedOf": "{taken} of {allowance} used in {year}",
  "home.daysLeft": "days left",

  // ── My leave ─────────────────────────────────────────────────────────────
  "myLeave.title": "My leave",
  "myLeave.intro":
    "What you have left this year, and every request you have made. Days are only deducted once a request is approved.",
  "myLeave.requestsTitle": "Your requests",
  "myLeave.requestsIntro":
    "Pending requests can be withdrawn. Approved leave can be cancelled, and the days go back into your balance.",
  "myLeave.emptyTitle": "You have not requested any leave yet",
  "myLeave.emptyBody":
    "When you do, it will appear here with its status, and you can cancel it from this page.",
  "myLeave.includesHalfDay": "includes a half day",
  "myLeave.cancelThis": "Cancel this request",
  "myLeave.cancelApproved":
    "This was approved, so the days go back into your balance and the time is no longer booked.",
  "myLeave.cancelPending":
    "This is still waiting for a decision. Cancelling withdraws it.",
  "myLeave.cancelConfirm": "Yes, cancel it",
  "myLeave.cancelKeep": "Keep it",
  "myLeave.cancelReason": "Reason (optional)",
  "myLeave.declinedLabel": "Declined:",
  "myLeave.noteLabel": "Note:",

  // ── Request form ─────────────────────────────────────────────────────────
  "newRequest.title": "Request leave",
  "newRequest.intro":
    "Choose your dates and we will work out how many days it costs. Weekends and public holidays are not counted. Your manager is notified as soon as you submit, and nothing is deducted until they approve it.",
  "newRequest.back": "Back to my requests",
  "newRequest.leaveType": "Leave type",
  "newRequest.noBalanceSuffix": "does not use your balance",
  "newRequest.firstDay": "First day",
  "newRequest.lastDay": "Last day",
  "newRequest.date": "Date",
  "newRequest.halfDay": "Half day?",
  "newRequest.firstDayHalf": "First day — half day?",
  "newRequest.lastDayHalf": "Last day — half day?",
  "newRequest.halfDayHint":
    "Leave as a full day, or take a morning or afternoon.",
  "newRequest.fullDay": "Full day",
  "newRequest.morningOnly": "Morning only",
  "newRequest.afternoonOnly": "Afternoon only",
  "newRequest.reason": "Reason",
  "newRequest.reasonHint": "Your manager sees this. Colleagues do not.",
  "newRequest.submit": "Submit request",
  "newRequest.submitting": "Submitting…",
  "newRequest.balanceAfter": "Balance after approval:",
  "newRequest.balanceFrom": "(from {before})",
  "newRequest.noDeduct": "This type does not draw down your paid leave balance.",

  // ── Approvals ────────────────────────────────────────────────────────────
  "approvals.title": "Approvals",
  "approvals.intro":
    "Leave requests from your team waiting for a decision. Approving deducts the days straight away; declining does not, but tell them why. A Super Admin can act on these too, so a request may already have been decided by the time you get here.",
  "approvals.emptyTitle": "Nothing waiting",
  "approvals.emptyBody":
    "When someone on your team requests leave it will appear here, and they will be told as soon as you decide.",
  "approvals.awaiting": "{count} awaiting a decision",
  "approvals.noReason": "No reason given.",
  "approvals.approve": "Approve",
  "approvals.approving": "Approving…",
  "approvals.decline": "Decline…",
  "approvals.declining": "Declining…",
  "approvals.declineWhy": "Why are you declining?",
  "approvals.declineWhyHint": "They will see this.",
  "approvals.teamMember": "A team member",

  // ── Calendar ─────────────────────────────────────────────────────────────
  "calendar.title": "Team calendar",
  "calendar.intro":
    "Who is unavailable, and when. Public holidays and company closures are shown too. Leave reasons stay private to the person and their manager — this page only shows that someone is away.",
  "calendar.changeMonth": "Change month",
  "calendar.emptyTitle": "Nothing booked this month",
  "calendar.emptyBody": "Approved leave and public holidays will appear here.",
  "calendar.legendApproved": "Approved leave",
  "calendar.legendPending": "Awaiting a decision",
  "calendar.legendHoliday": "Public holiday or closure",
  "calendar.morning": "morning",
  "calendar.afternoon": "afternoon",
  "calendar.pending": "pending",
  "calendar.more": "+{count} more",

  // ── Settings ─────────────────────────────────────────────────────────────
  "settings.title": "Settings",
  "settings.intro":
    "Your account details, the language we use with you, and your password. Name, role and reporting line are managed by a Super Admin — ask them if something here is wrong.",
  "settings.detailsTitle": "Your details",
  "settings.name": "Name",
  "settings.workEmail": "Work email",
  "settings.role": "Role",
  "settings.status": "Status",
  "settings.jobTitle": "Job title",
  "settings.department": "Department",
  "settings.languageTitle": "Language",
  "settings.languageIntro":
    "Sets the language of this interface and of the emails we send you about your leave.",
  "settings.displayLanguage": "Display language",
  "settings.saveLanguage": "Save language",
  "settings.passwordTitle": "Password",
  "settings.passwordIntro":
    "Changing your password signs you out of nothing else — your other sessions stay open. Use at least 10 characters.",
  "settings.newPassword": "New password",
  "settings.confirmPassword": "Confirm new password",
  "settings.updatePassword": "Update password",
  "settings.updating": "Updating…",
  "settings.showPassword": "Show password",
  "settings.hidePassword": "Hide password",

  // ── Emails (subject + body) ──────────────────────────────────────────────
  "email.greeting": "Hi {name},",
  "email.noReplyNote":
    "You are receiving this because you are a member of staff. This is a notification about your employment and cannot be unsubscribed from.",

  "email.submitted.subject": "{name} has requested leave",
  "email.submitted.lead":
    "{name} has requested {days} of {type}, from {from} to {to}.",
  "email.submitted.reason": "Their reason: {reason}",
  "email.submitted.cta": "Review the request",

  "email.approved.subject": "Your leave has been approved",
  "email.approved.lead":
    "Your request for {days} of {type}, from {from} to {to}, has been approved by {decider}.",
  "email.approved.balance": "You have {balance} of {type} left this year.",

  "email.declined.subject": "Your leave request was declined",
  "email.declined.lead":
    "Your request for {days} of {type}, from {from} to {to}, was declined by {decider}.",
  "email.declined.reason": "Reason given: {reason}",
  "email.declined.balance": "Your balance is unchanged.",

  "email.cancelled.subject": "Leave cancelled: {from}",
  "email.cancelled.lead":
    "The approved leave from {from} to {to} ({days} of {type}) has been cancelled by {actor}.",
  "email.cancelled.restored": "The days have been returned to the balance.",

  "email.roleChanged.subject": "Your role has changed",
  "email.roleChanged.lead":
    "Your role has been changed from {before} to {after} by {actor}.",
  "email.roleChanged.what":
    "This changes what you can see and do in the leave system.",

  "email.cta.openSystem": "Open the leave system",
};

/**
 * Vietnamese.
 *
 * Written for staff who will read this every week, not translated word for word
 * from the English. Where a literal rendering would sound stiff, the Vietnamese
 * says the same thing the way a colleague would.
 */
const vi: Dict = {
  "nav.overview": "Tổng quan",
  "nav.myLeave": "Nghỉ phép của tôi",
  "nav.calendar": "Lịch nhóm",
  "nav.approvals": "Duyệt đơn",
  "nav.team": "Thành viên",
  "nav.holidays": "Ngày lễ",
  "nav.settings": "Cài đặt",
  "nav.signOut": "Đăng xuất",
  "nav.openMenu": "Mở menu",
  "nav.closeMenu": "Đóng menu",
  "nav.people": "Nhân sự",

  "role.super_admin": "Quản trị viên cấp cao",
  "role.admin": "Quản lý",
  "role.staff": "Nhân viên",
  "status.active": "Đang hoạt động",
  "status.invited": "Đã mời",
  "status.deactivated": "Đã vô hiệu hóa",
  "request.pending": "Chờ duyệt",
  "request.approved": "Đã duyệt",
  "request.declined": "Bị từ chối",
  "request.cancelled": "Đã hủy",

  "common.day": "ngày",
  "common.days": "ngày",
  "common.save": "Lưu",
  "common.cancel": "Hủy",
  "common.remove": "Xóa",
  "common.back": "Quay lại",
  "common.saving": "Đang lưu…",
  "common.none": "—",
  "common.companyDefault": "Mặc định của công ty",
  "common.today": "Hôm nay",
  "common.required": "bắt buộc",

  "home.greeting": "Chào {name}",
  "home.intro":
    "Số ngày phép còn lại, ai đang nghỉ, và những việc cần bạn xử lý. Ngày phép chỉ bị trừ sau khi đơn được duyệt.",
  "home.requestLeave": "Xin nghỉ phép",
  "home.waitingTitle": "Chờ bạn xử lý",
  "home.waitingNone": "Hiện không có đơn nào từ nhóm của bạn cần duyệt.",
  "home.waitingSome": "{count} đơn xin nghỉ từ nhóm của bạn.",
  "home.waitingReview": "Xem đơn",
  "home.offTodayTitle": "Nghỉ hôm nay",
  "home.offTodayIntro":
    "Ai không có mặt ngày {date}. Lý do nghỉ chỉ người đó và quản lý của họ mới thấy.",
  "home.offTodayNone": "Hôm nay mọi người đều có mặt.",
  "home.holidaysTitle": "Ngày lễ",
  "home.holidaysIntro":
    "Những ngày nghỉ sắp tới của cả công ty. Những ngày này không trừ vào phép của bạn.",
  "home.holidaysNone": "Chưa có ngày lễ nào trên lịch.",
  "home.holidaysHint":
    "Quản trị viên cấp cao sẽ thêm. Trước khi có, ngày lễ vẫn bị tính vào số ngày nghỉ phép.",
  "home.recentTitle": "Đơn gần đây của bạn",
  "home.recentNone": "Bạn chưa xin nghỉ phép lần nào.",
  "home.seeAll": "Xem tất cả đơn của tôi",
  "home.signedInAs": "Đang đăng nhập với tên {name}",
  "home.usedOf": "Đã dùng {taken} trên {allowance} ngày trong năm {year}",
  "home.daysLeft": "ngày còn lại",

  "myLeave.title": "Nghỉ phép của tôi",
  "myLeave.intro":
    "Số ngày còn lại trong năm nay và toàn bộ đơn bạn đã gửi. Ngày phép chỉ bị trừ khi đơn được duyệt.",
  "myLeave.requestsTitle": "Đơn của bạn",
  "myLeave.requestsIntro":
    "Đơn đang chờ có thể rút lại. Đơn đã duyệt có thể hủy, và số ngày sẽ được hoàn lại.",
  "myLeave.emptyTitle": "Bạn chưa xin nghỉ phép lần nào",
  "myLeave.emptyBody":
    "Khi bạn gửi đơn, đơn sẽ hiện ở đây kèm trạng thái, và bạn có thể hủy từ trang này.",
  "myLeave.includesHalfDay": "có nửa ngày",
  "myLeave.cancelThis": "Hủy đơn này",
  "myLeave.cancelApproved":
    "Đơn này đã được duyệt, nên số ngày sẽ được hoàn lại và thời gian nghỉ không còn được giữ.",
  "myLeave.cancelPending": "Đơn này vẫn đang chờ duyệt. Hủy tức là rút đơn.",
  "myLeave.cancelConfirm": "Đồng ý, hủy đơn",
  "myLeave.cancelKeep": "Giữ đơn",
  "myLeave.cancelReason": "Lý do (không bắt buộc)",
  "myLeave.declinedLabel": "Bị từ chối:",
  "myLeave.noteLabel": "Ghi chú:",

  "newRequest.title": "Xin nghỉ phép",
  "newRequest.intro":
    "Chọn ngày và hệ thống sẽ tính số ngày phép. Cuối tuần và ngày lễ không bị tính. Quản lý của bạn được thông báo ngay khi bạn gửi, và không có ngày nào bị trừ cho tới khi họ duyệt.",
  "newRequest.back": "Quay lại đơn của tôi",
  "newRequest.leaveType": "Loại nghỉ",
  "newRequest.noBalanceSuffix": "không trừ vào phép của bạn",
  "newRequest.firstDay": "Ngày bắt đầu",
  "newRequest.lastDay": "Ngày kết thúc",
  "newRequest.date": "Ngày",
  "newRequest.halfDay": "Nghỉ nửa ngày?",
  "newRequest.firstDayHalf": "Ngày đầu — nửa ngày?",
  "newRequest.lastDayHalf": "Ngày cuối — nửa ngày?",
  "newRequest.halfDayHint": "Để nguyên là cả ngày, hoặc chọn buổi sáng/chiều.",
  "newRequest.fullDay": "Cả ngày",
  "newRequest.morningOnly": "Chỉ buổi sáng",
  "newRequest.afternoonOnly": "Chỉ buổi chiều",
  "newRequest.reason": "Lý do",
  "newRequest.reasonHint": "Quản lý của bạn sẽ thấy. Đồng nghiệp thì không.",
  "newRequest.submit": "Gửi đơn",
  "newRequest.submitting": "Đang gửi…",
  "newRequest.balanceAfter": "Số ngày còn lại sau khi duyệt:",
  "newRequest.balanceFrom": "(từ {before})",
  "newRequest.noDeduct": "Loại nghỉ này không trừ vào phép có lương của bạn.",

  "approvals.title": "Duyệt đơn",
  "approvals.intro":
    "Đơn xin nghỉ từ nhóm của bạn đang chờ quyết định. Duyệt sẽ trừ ngày ngay; từ chối thì không, nhưng hãy nêu lý do. Quản trị viên cấp cao cũng có thể xử lý, nên đơn có thể đã được quyết định trước khi bạn mở.",
  "approvals.emptyTitle": "Không có đơn nào chờ",
  "approvals.emptyBody":
    "Khi ai đó trong nhóm xin nghỉ, đơn sẽ hiện ở đây, và họ được báo ngay khi bạn quyết định.",
  "approvals.awaiting": "{count} đơn đang chờ quyết định",
  "approvals.noReason": "Không nêu lý do.",
  "approvals.approve": "Duyệt",
  "approvals.approving": "Đang duyệt…",
  "approvals.decline": "Từ chối…",
  "approvals.declining": "Đang từ chối…",
  "approvals.declineWhy": "Vì sao bạn từ chối?",
  "approvals.declineWhyHint": "Người gửi đơn sẽ thấy nội dung này.",
  "approvals.teamMember": "Một thành viên",

  "calendar.title": "Lịch nhóm",
  "calendar.intro":
    "Ai vắng mặt và vào lúc nào. Ngày lễ và ngày công ty đóng cửa cũng hiển thị. Lý do nghỉ chỉ người đó và quản lý của họ mới thấy — trang này chỉ cho biết ai đang vắng.",
  "calendar.changeMonth": "Đổi tháng",
  "calendar.emptyTitle": "Tháng này chưa có gì",
  "calendar.emptyBody": "Đơn đã duyệt và ngày lễ sẽ hiện ở đây.",
  "calendar.legendApproved": "Nghỉ đã duyệt",
  "calendar.legendPending": "Đang chờ duyệt",
  "calendar.legendHoliday": "Ngày lễ hoặc đóng cửa",
  "calendar.morning": "buổi sáng",
  "calendar.afternoon": "buổi chiều",
  "calendar.pending": "chờ duyệt",
  "calendar.more": "+{count} nữa",

  "settings.title": "Cài đặt",
  "settings.intro":
    "Thông tin tài khoản, ngôn ngữ hệ thống dùng với bạn, và mật khẩu. Tên, vai trò và quản lý trực tiếp do quản trị viên cấp cao quản lý — hãy báo họ nếu có gì chưa đúng.",
  "settings.detailsTitle": "Thông tin của bạn",
  "settings.name": "Họ tên",
  "settings.workEmail": "Email công việc",
  "settings.role": "Vai trò",
  "settings.status": "Trạng thái",
  "settings.jobTitle": "Chức danh",
  "settings.department": "Phòng ban",
  "settings.languageTitle": "Ngôn ngữ",
  "settings.languageIntro":
    "Đặt ngôn ngữ cho giao diện này và cho email chúng tôi gửi về ngày phép của bạn.",
  "settings.displayLanguage": "Ngôn ngữ hiển thị",
  "settings.saveLanguage": "Lưu ngôn ngữ",
  "settings.passwordTitle": "Mật khẩu",
  "settings.passwordIntro":
    "Đổi mật khẩu không đăng xuất các phiên khác của bạn. Dùng ít nhất 10 ký tự.",
  "settings.newPassword": "Mật khẩu mới",
  "settings.confirmPassword": "Xác nhận mật khẩu mới",
  "settings.updatePassword": "Cập nhật mật khẩu",
  "settings.updating": "Đang cập nhật…",
  "settings.showPassword": "Hiện mật khẩu",
  "settings.hidePassword": "Ẩn mật khẩu",

  "email.greeting": "Chào {name},",
  "email.noReplyNote":
    "Bạn nhận được email này vì bạn là nhân viên của công ty. Đây là thông báo liên quan đến công việc của bạn và không thể hủy đăng ký.",

  "email.submitted.subject": "{name} vừa gửi đơn xin nghỉ",
  "email.submitted.lead":
    "{name} xin nghỉ {days} {type}, từ {from} đến {to}.",
  "email.submitted.reason": "Lý do: {reason}",
  "email.submitted.cta": "Xem đơn",

  "email.approved.subject": "Đơn xin nghỉ của bạn đã được duyệt",
  "email.approved.lead":
    "Đơn xin nghỉ {days} {type}, từ {from} đến {to}, đã được {decider} duyệt.",
  "email.approved.balance": "Bạn còn {balance} {type} trong năm nay.",

  "email.declined.subject": "Đơn xin nghỉ của bạn bị từ chối",
  "email.declined.lead":
    "Đơn xin nghỉ {days} {type}, từ {from} đến {to}, đã bị {decider} từ chối.",
  "email.declined.reason": "Lý do: {reason}",
  "email.declined.balance": "Số ngày phép của bạn không thay đổi.",

  "email.cancelled.subject": "Đã hủy nghỉ phép: {from}",
  "email.cancelled.lead":
    "Đơn nghỉ đã duyệt từ {from} đến {to} ({days} {type}) đã được {actor} hủy.",
  "email.cancelled.restored": "Số ngày đã được hoàn lại.",

  "email.roleChanged.subject": "Vai trò của bạn đã thay đổi",
  "email.roleChanged.lead":
    "Vai trò của bạn đã được {actor} đổi từ {before} thành {after}.",
  "email.roleChanged.what":
    "Điều này thay đổi những gì bạn thấy và làm được trong hệ thống nghỉ phép.",

  "email.cta.openSystem": "Mở hệ thống nghỉ phép",
};

const DICTS: Record<HrLocale, Dict> = { en, vi };

/** Every key defined. Used by the drift test, not at runtime. */
export function dictKeys(locale: HrLocale): string[] {
  return Object.keys(DICTS[locale]);
}

export type HrTranslate = (
  key: string,
  vars?: Record<string, string | number>
) => string;

/**
 * Build a translator.
 *
 * Falls back English → key. A missing Vietnamese string renders the English
 * one, which is imperfect but readable; rendering `nav.overview` on screen is
 * neither.
 */
export function hrTranslator(locale: HrLocale): HrTranslate {
  const primary = DICTS[locale] ?? DICTS[HR_DEFAULT_LOCALE];
  return (key, vars) => {
    const template = primary[key] ?? en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match
    );
  };
}
