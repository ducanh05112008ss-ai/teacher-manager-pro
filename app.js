// Điểm danh: lịch và học phí theo từng học sinh, ngoại tuyến trên điện thoại.
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dong = value => new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";
const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const longDays = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const iconPaths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  student: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l-1.8 1.8a1.7 1.7 0 0 0-1.9-.3l-.8.3a1.7 1.7 0 0 0-1.1 1.6h-2.6a1.7 1.7 0 0 0-1.1-1.6l-.8-.3a1.7 1.7 0 0 0-1.9.3l-1.8-1.8a1.7 1.7 0 0 0 .3-1.9l-.3-.8A1.7 1.7 0 0 0 4.3 13H3v-2h1.3a1.7 1.7 0 0 0 1.6-1.1l.3-.8a1.7 1.7 0 0 0-.3-1.9l1.8-1.8a1.7 1.7 0 0 0 1.9.3l.8-.3a1.7 1.7 0 0 0 1.1-1.6h2.6a1.7 1.7 0 0 0 1.1 1.6l.8.3a1.7 1.7 0 0 0 1.9-.3l1.8 1.8a1.7 1.7 0 0 0-.3 1.9l.3.8a1.7 1.7 0 0 0 1.6 1.1H22v2h-1.3a1.7 1.7 0 0 0-1.6 1.1z"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  empty: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h8"/>'
};
const ico = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const dateOf = value => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shiftDate = (value, days) => { const d = dateOf(value); d.setDate(d.getDate() + days); return dateKey(d); };
const daysBetween = (from, to) => Math.round((Date.UTC(...to.split("-").map((x, i) => i === 1 ? Number(x) - 1 : Number(x))) - Date.UTC(...from.split("-").map((x, i) => i === 1 ? Number(x) - 1 : Number(x)))) / 86400000);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(dateOf(value)) === value;
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const plusMinutes = (value, duration) => { const n = Math.min(toMinutes(value) + duration, 1439); return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };
const today = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const defaults = () => ({ version: 4, students: [], events: [], series: [], exceptions: [], payments: [], settings: { theme: "dark", weekStart: 1, duration: 90 } });
const cleanSettings = value => ({
  theme: value?.theme === "light" ? "light" : "dark",
  weekStart: value?.weekStart === 0 ? 0 : 1,
  duration: [60, 90, 120].includes(Number(value?.duration)) ? Number(value.duration) : 90
});

// Chuyển bản APK cũ thành lịch mới để cập nhật không mất các buổi đã điểm danh.
function migrateOld(old) {
  const result = defaults();
  result.students = old.students.map((s, i) => ({ id: s.id, name: s.name, defaultFee: Number(s.fee) || 0, tone: i % 8 }));
  const students = new Map(old.students.map(s => [s.id, s]));
  for (const schedule of old.schedules) {
    const student = students.get(schedule.studentId);
    if (!student || !student.active) continue;
    const start = validTime(schedule.time) ? schedule.time : "18:00";
    const first = validDate(schedule.startsOn) ? schedule.startsOn : today();
    const weekday = Number.isInteger(schedule.weekday) && schedule.weekday >= 0 && schedule.weekday <= 6 ? schedule.weekday : dateOf(first).getDay();
    const firstDate = shiftDate(first, (weekday - dateOf(first).getDay() + 7) % 7);
    result.series.push({ id: schedule.id, studentId: student.id, name: student.name, firstDate, start, end: plusMinutes(start, 90), fee: Number(student.fee) || 0, untilDate: null });
  }
  for (const lesson of old.lessons) {
    const student = students.get(lesson.studentId);
    if (!student || !validDate(lesson.date)) continue;
    const series = result.series.find(s => s.id === lesson.scheduleId);
    const start = validTime(lesson.time) ? lesson.time : series?.start || "18:00";
    const base = { id: lesson.id || uid(), studentId: student.id, name: student.name, date: lesson.date, start, end: plusMinutes(start, 90), fee: Number(lesson.fee) || 0, status: ["present", "absent", "cancelled"].includes(lesson.status) ? lesson.status : "pending", note: lesson.note || "" };
    if (series && lesson.date >= series.firstDate && dateOf(lesson.date).getDay() === dateOf(series.firstDate).getDay())
      result.exceptions.push({ ...base, seriesId: series.id, sourceDate: lesson.date, deleted: false });
    else result.events.push(base);
  }
  return result;
}
function normalize(parsed) {
  if (Array.isArray(parsed?.events) && Array.isArray(parsed?.series) && Array.isArray(parsed?.exceptions)) {
    if (Array.isArray(parsed.students)) {
      if (parsed.version >= 4 && !Array.isArray(parsed.payments)) return null;
      return { version: 4, students: parsed.students.map((s, i) => ({ ...s, tone: Number.isInteger(s.tone) && s.tone >= 0 && s.tone < 8 ? s.tone : i % 8 })), events: parsed.events, series: parsed.series, exceptions: parsed.exceptions, payments: parsed.payments || [], settings: cleanSettings(parsed.settings) };
    }
    // Bản 2 chỉ lưu tên trong từng buổi. Ghép cùng tên thành một hồ sơ khi nâng cấp.
    const students = [], names = new Map();
    const withStudent = item => {
      const name = String(item.name || "Học sinh").trim();
      const key = name.toLocaleLowerCase("vi");
      if (!names.has(key)) {
        const id = uid();
        names.set(key, id);
        students.push({ id, name, defaultFee: Number(item.fee) || 0, tone: students.length % 8 });
      }
      return { ...item, studentId: names.get(key), name };
    };
    const series = parsed.series.map(withStudent);
    const events = parsed.events.map(withStudent);
    const exceptions = parsed.exceptions.map(item => {
      const parent = series.find(s => s.id === item.seriesId);
      return parent && item.name === parent.name ? { ...item, studentId: parent.studentId, name: parent.name } : withStudent(item);
    });
    return { version: 4, students, events, series, exceptions, payments: [], settings: cleanSettings(parsed.settings) };
  }
  if (Array.isArray(parsed?.students) && Array.isArray(parsed?.schedules) && Array.isArray(parsed?.lessons)) return migrateOld(parsed);
  return null;
}
function rawStorage() {
  try { return window.BuoiAndroid ? BuoiAndroid.load() : localStorage.getItem("diem-danh-data"); }
  catch (_) { return null; }
}
function writeStorage(value) {
  const text = JSON.stringify(value);
  if (window.BuoiAndroid) return BuoiAndroid.save(text);
  localStorage.setItem("diem-danh-data", text); return true;
}
let raw = rawStorage();
let parsed;
try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
let data = normalize(parsed) || defaults();
if (parsed && parsed.version !== 4) { try { writeStorage(data); } catch (_) {} }
let selected = today();
let view = "calendar";
let previousView = "calendar";
let selectedStudentId = null;
let modal = null;
let toastTimer = 0;
function copyData() { return JSON.parse(JSON.stringify(data)); }
function applyTheme() {
  document.documentElement.dataset.theme = data.settings.theme;
  if (window.BuoiAndroid?.setTheme) BuoiAndroid.setTheme(data.settings.theme === "light");
}
function save(next) {
  try {
    if (!writeStorage(next)) throw new Error("Không lưu được trên máy. Em hãy kiểm tra dung lượng trống.");
    data = next; applyTheme(); render(); return true;
  } catch (error) { toast(error.message || "Chưa lưu được dữ liệu."); return false; }
}
function toast(message) {
  $("#toast-root").innerHTML = `<div class="toast" role="status">${esc(message)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast-root").innerHTML = ""; }, 3000);
}

// Lịch lặp và các buổi được dời, sửa hoặc huỷ riêng.
function occurrences(date) {
  const list = [];
  for (const s of data.series) {
    if (s.firstDate > date || (s.untilDate && s.untilDate < date) || dateOf(s.firstDate).getDay() !== dateOf(date).getDay()) continue;
    if (data.exceptions.some(x => x.seriesId === s.id && x.sourceDate === date)) continue;
    list.push({ kind: "series", id: s.id, key: `s:${s.id}:${date}`, seriesId: s.id, sourceDate: date, studentId: s.studentId, name: s.name, date, start: s.start, end: s.end, fee: s.fee, status: "pending" });
  }
  for (const ex of data.exceptions) if (ex.date === date && !ex.deleted)
    list.push({ ...ex, kind: "exception", key: `x:${ex.id}` });
  for (const event of data.events) if (event.date === date)
    list.push({ ...event, kind: "event", key: `e:${event.id}` });
  for (const item of list) item.name = data.students.find(s => s.id === item.studentId)?.name || item.name;
  return list.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, "vi"));
}
function selectedOccurrence(key) { return occurrences(selected).find(x => x.key === key); }
function monthItems() {
  const d = dateOf(selected), end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const items = [];
  for (let day = 1; day <= end; day++)
    items.push(...occurrences(dateKey(new Date(d.getFullYear(), d.getMonth(), day))));
  return items;
}
function studentStats(studentId, items = monthItems()) {
  const sessions = items.filter(item => item.studentId === studentId);
  const taught = sessions.filter(item => item.status === "present");
  return { sessions, taught, scheduledAmount: sessions.reduce((sum, item) => sum + Number(item.fee || 0), 0), taughtAmount: taught.reduce((sum, item) => sum + Number(item.fee || 0), 0) };
}
function studentTone(studentId) {
  const student = data.students.find(s => s.id === studentId);
  return `tone-${student?.tone ?? 0}`;
}
function nextTone(students) {
  const used = new Set(students.map(s => s.tone));
  for (let i = 0; i < 8; i++) if (!used.has(i)) return i;
  return students.length % 8;
}
function amountReceived(studentId, month = selected.slice(0, 7)) {
  return Number(data.payments.find(p => p.studentId === studentId && p.month === month)?.amount || 0);
}
function monthTotals(items = monthItems()) {
  return {
    scheduled: items.reduce((sum, item) => sum + Number(item.fee || 0), 0),
    taught: items.filter(item => item.status === "present").reduce((sum, item) => sum + Number(item.fee || 0), 0),
    received: data.payments.filter(p => p.month === selected.slice(0, 7) && data.students.some(s => s.id === p.studentId)).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  };
}
function shortStudent(name) { return String(name).trim().split(/\s+/).pop().slice(0, 6); }

// Giao diện lịch và danh sách của ngày được chọn.
function renderTopbar() {
  const settings = view === "settings";
  return `<header class="topbar"><div class="app-title"><span class="app-mark">${ico("calendar", 20)}</span>Điểm danh</div><button class="icon-button" data-action="${settings ? "back" : "settings"}" aria-label="${settings ? "Quay lại" : "Cài đặt"}">${ico(settings ? "close" : "gear", 21)}</button></header>`;
}
function renderCalendar() {
  const date = dateOf(selected), first = new Date(date.getFullYear(), date.getMonth(), 1);
  const leading = (first.getDay() - data.settings.weekStart + 7) % 7;
  const numberOfDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => dayNames[(i + data.settings.weekStart) % 7]);
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push('<span class="date-cell empty"></span>');
  for (let day = 1; day <= numberOfDays; day++) {
    const key = dateKey(new Date(date.getFullYear(), date.getMonth(), day));
    const items = occurrences(key);
    const labels = items.slice(0, 2).map(item => `<span class="date-lesson ${studentTone(item.studentId)}" aria-hidden="true">${esc(shortStudent(item.name))}</span>`).join("");
    const more = items.length > 2 ? `<span class="date-more">+${items.length - 2}</span>` : "";
    const description = items.map(item => `${item.name} ${item.start}`).join(", ");
    cells.push(`<button class="date-cell ${key === selected ? "selected" : ""} ${key === today() ? "today" : ""}" data-action="date" data-date="${key}" aria-label="${day}/${date.getMonth() + 1}: ${esc(description || "không có buổi học")}"><span class="date-number">${day}</span><span class="date-lessons">${labels}${more}</span></button>`);
  }
  const rows = occurrences(selected);
  const monthly = monthItems(), totals = monthTotals(monthly);
  const legend = data.students.filter(student => monthly.some(item => item.studentId === student.id)).map(student => `<button class="legend-person ${studentTone(student.id)}" data-action="report" data-id="${esc(student.id)}"><i></i>${esc(student.name)}</button>`).join("");
  const agenda = rows.length ? `<div class="agenda">${rows.map((item, index) => renderEvent(item, index)).join("")}</div>` :
    `<div class="empty-day"><div class="empty-icon">${ico("empty", 28)}</div><strong>Ngày này chưa có buổi học</strong><p>Bấm “Thêm buổi học” để đặt lịch.</p></div>`;
  return `<div class="shell">${renderTopbar()}<div class="calendar-head"><div><div class="month-title">Tháng ${date.getMonth() + 1}, ${date.getFullYear()}</div><div class="month-subtitle">Chạm ngày để xem lịch học</div></div><div class="month-actions"><button class="today-button" data-action="today">Hôm nay</button><button class="icon-button" data-action="prev-month" aria-label="Tháng trước">${ico("left", 19)}</button><button class="icon-button" data-action="next-month" aria-label="Tháng sau">${ico("right", 19)}</button></div></div>
    <div class="calendar"><div class="weekday-row">${weekdayLabels.map(label => `<span>${label}</span>`).join("")}</div><div class="date-grid">${cells.join("")}</div></div>
    ${legend ? `<div class="student-legend" aria-label="Màu học sinh">${legend}</div>` : ""}
    <button class="month-received" data-action="tab-students"><span>Tổng đã thu tháng này <small>Chạm để xem từng học sinh</small></span><strong>${dong(totals.received)}</strong>${ico("right", 17)}</button>
    <section class="day-section"><div class="day-heading"><h2>${longDays[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}</h2><span>${rows.length} ca</span></div>${agenda}<button class="add-day" data-action="add">${ico("plus", 17)} Thêm buổi học</button></section>${renderNav()}</div>`;
}
function renderEvent(item, index) {
  const state = item.status === "present" ? "done" : item.status === "absent" ? "absent" : item.status === "cancelled" ? "cancelled" : "";
  const label = item.status === "present" ? "Đã dạy" : item.status === "absent" ? "Vắng" : item.status === "cancelled" ? "Nghỉ" : "Chưa điểm danh";
  return `<article class="event ${state} ${studentTone(item.studentId)}" style="animation-delay:${Math.min(index, 5) * 45}ms">
    <button class="event-main" data-action="edit" data-key="${esc(item.key)}" aria-label="Sửa ca ${esc(item.start)} đến ${esc(item.end)} của ${esc(item.name)}"><span class="event-time">${esc(item.start)}<br>${esc(item.end)}</span><span class="student-avatar event-avatar">${esc(item.name.charAt(0).toUpperCase())}</span><span class="event-person"><strong>${esc(item.name)}</strong><small>${dong(item.fee)} · ${label}${item.seriesId ? " · Hằng tuần" : ""}</small></span><span class="chevron">${ico("right", 17)}</span></button>
    <div class="quick-mark"><button class="${item.status === "present" ? "marked" : ""}" data-action="mark" data-key="${esc(item.key)}" data-status="${item.status === "present" ? "pending" : "present"}">${ico("check", 15)} ${item.status === "present" ? "Đã dạy · Bỏ đánh dấu" : "Đánh dấu đã dạy"}</button></div>
  </article>`;
}
function renderNav() {
  return `<nav class="bottom-nav" aria-label="Điều hướng"><button data-action="tab-calendar" class="${view === "calendar" ? "active" : ""}">${ico("calendar", 20)}<span>Lịch</span></button><button data-action="tab-students" class="${view === "students" || view === "report" ? "active" : ""}">${ico("student", 20)}<span>Học sinh</span></button></nav>`;
}
function renderStudents() {
  const d = dateOf(selected), items = monthItems(), totals = monthTotals(items);
  const cards = data.students.length ? data.students.map(student => {
    const stats = studentStats(student.id, items);
    return `<div class="student-card ${studentTone(student.id)}"><button class="student-main" data-action="report" data-id="${esc(student.id)}"><span class="student-avatar">${esc(student.name.charAt(0).toUpperCase())}</span><span class="student-info"><strong>${esc(student.name)}</strong><small>${stats.sessions.length} buổi trong lịch · ${stats.taught.length} đã dạy</small><b>Theo lịch ${dong(stats.scheduledAmount)} · Đã thu ${dong(amountReceived(student.id))}</b></span>${ico("right", 17)}</button><button class="student-add-lesson" data-action="add-for" data-id="${esc(student.id)}">${ico("plus", 15)} Đặt lịch</button></div>`;
  }).join("") : `<div class="empty-day"><div class="empty-icon">${ico("empty", 28)}</div><strong>Chưa có học sinh</strong><p>Thêm một bạn để bắt đầu xếp lịch và tính tiền riêng.</p></div>`;
  return `<div class="shell">${renderTopbar()}<div class="page-head"><div><h1>Học sinh</h1><p>Tiền và điểm danh riêng cho từng bạn</p></div><button class="small-primary" data-action="new-student">${ico("plus", 17)} Thêm</button></div><div class="report-month"><button class="icon-button" data-action="prev-month" aria-label="Tháng trước">${ico("left", 19)}</button><strong>Tháng ${d.getMonth()+1}/${d.getFullYear()}</strong><button class="icon-button" data-action="next-month" aria-label="Tháng sau">${ico("right", 19)}</button></div>
  <div class="income-overview"><small>ĐÃ THU TỪ TẤT CẢ HỌC SINH</small><strong>${dong(totals.received)}</strong><span>Theo lịch: ${dong(totals.scheduled)} · Đã dạy: ${dong(totals.taught)}</span></div><p class="income-hint">Mở từng học sinh để ghi số tiền em đã nhận trong tháng.</p><div class="students-list">${cards}</div>${renderNav()}</div>`;
}
function renderReport() {
  const student = data.students.find(s => s.id === selectedStudentId);
  if (!student) { view = "students"; return renderStudents(); }
  const d = dateOf(selected), stats = studentStats(student.id);
  const rows = stats.sessions.map(item => `<div class="report-row"><span class="report-date">${dateOf(item.date).getDate()}/${d.getMonth()+1}</span><span class="report-details"><strong>${esc(item.start)}–${esc(item.end)}</strong><small>${item.status === "present" ? "Đã dạy" : item.status === "absent" ? "Vắng" : item.status === "cancelled" ? "Nghỉ" : "Chưa điểm danh"}</small></span><b>${dong(item.fee)}</b></div>`).join("") || `<div class="empty-day"><strong>Tháng này chưa có buổi học</strong><p>Em có thể đặt lịch ngay từ hồ sơ học sinh.</p></div>`;
  return `<div class="shell">${renderTopbar()}<div class="report-head"><button class="back-link" data-action="back">${ico("left", 18)} Học sinh</button><div class="report-title ${studentTone(student.id)}"><span class="student-avatar large">${esc(student.name.charAt(0).toUpperCase())}</span><div><h1>${esc(student.name)}</h1><button data-action="edit-student" data-id="${esc(student.id)}">Sửa tên & giá mặc định</button></div></div></div><div class="report-month"><button class="icon-button" data-action="prev-month" aria-label="Tháng trước">${ico("left", 19)}</button><strong>Tháng ${d.getMonth()+1}/${d.getFullYear()}</strong><button class="icon-button" data-action="next-month" aria-label="Tháng sau">${ico("right", 19)}</button></div>
  <div class="report-summary"><div><small>Học phí theo lịch · ${stats.sessions.length} buổi</small><strong>${dong(stats.scheduledAmount)}</strong></div><div><small>Đã dạy · ${stats.taught.length} buổi</small><strong>${dong(stats.taughtAmount)}</strong></div></div>
  <button class="received-panel" data-action="edit-payment" data-id="${esc(student.id)}"><span><small>ĐÃ THU THỰC TẾ</small><strong>${dong(amountReceived(student.id))}</strong></span><span class="received-edit">Ghi tiền ${ico("right", 16)}</span></button>
  <p class="report-hint">“Theo lịch” là tiền của mọi buổi đã đặt. “Đã thu” là số tiền em tự ghi khi nhận từ phụ huynh.</p><div class="report-list"><h2>Chi tiết buổi học</h2>${rows}</div><div class="report-actions"><button class="primary" data-action="share-report" data-id="${esc(student.id)}">Chia sẻ điểm danh tháng này</button><button class="secondary" data-action="add-for" data-id="${esc(student.id)}">${ico("plus", 16)} Đặt lịch</button></div>${renderNav()}</div>`;
}
function renderSettings() {
  return `<div class="shell">${renderTopbar()}<div class="settings"><h1>Cài đặt</h1><h2>Hiển thị</h2><div class="settings-card">
    <div class="setting-row"><div><strong>Giao diện</strong><small>Chọn màu nền dễ nhìn</small></div><select id="setting-theme" aria-label="Giao diện"><option value="dark" ${data.settings.theme === "dark" ? "selected" : ""}>Tối</option><option value="light" ${data.settings.theme === "light" ? "selected" : ""}>Sáng</option></select></div>
    <div class="setting-row"><div><strong>Ngày đầu tuần</strong><small>Sắp xếp lịch tháng</small></div><select id="setting-week" aria-label="Ngày đầu tuần"><option value="1" ${data.settings.weekStart === 1 ? "selected" : ""}>Thứ hai</option><option value="0" ${data.settings.weekStart === 0 ? "selected" : ""}>Chủ nhật</option></select></div>
    <div class="setting-row"><div><strong>Thời lượng mặc định</strong><small>Khi thêm buổi học mới</small></div><select id="setting-duration" aria-label="Thời lượng mặc định">${[60, 90, 120].map(n => `<option value="${n}" ${data.settings.duration === n ? "selected" : ""}>${n} phút</option>`).join("")}</select></div>
  </div><h2>Dữ liệu</h2><div class="settings-card">
    <button class="setting-row" data-action="export"><div><strong>Xuất bản sao lưu</strong><small>Giữ một tệp dự phòng khi đổi máy</small></div><span class="row-action">Xuất tệp</span></button>
    <button class="setting-row" data-action="import"><div><strong>Nhập bản sao lưu</strong><small>Khôi phục lịch và điểm danh</small></div><span class="row-action">Chọn tệp</span></button>
  </div><p class="settings-hint">Dữ liệu lưu trên điện thoại này. Nếu gỡ ứng dụng, hãy xuất bản sao lưu trước.</p></div></div>`;
}
function render() { $("#app").innerHTML = view === "settings" ? renderSettings() : view === "students" ? renderStudents() : view === "report" ? renderReport() : renderCalendar(); renderModal(); }

function openNew(studentId = null) {
  const start = "18:00";
  const student = data.students.find(s => s.id === studentId) || (studentId ? null : data.students[0]);
  modal = { type: "editor", original: null, studentId: student?.id || "new", newName: "", date: selected, start, end: plusMinutes(start, data.settings.duration), fee: student ? String(student.defaultFee) : "", status: "pending", repeat: false, scope: "one" };
  renderModal();
}
function openEdit(item) {
  if (!item) return;
  modal = { type: "editor", original: { ...item }, studentId: item.studentId || "new", newName: item.studentId ? "" : item.name, date: item.date, start: item.start, end: item.end, fee: String(item.fee), status: item.status, repeat: !!item.seriesId, scope: "one" };
  renderModal();
}
function closeModal() { modal = null; renderModal(); }
function frame(title, body, footer) {
  return `<div class="sheet-overlay" data-action="backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="handle"></div><div class="sheet-title"><h2>${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="Đóng">${ico("close", 21)}</button></div><div class="sheet-body">${body}</div><div class="sheet-foot">${footer}</div></div></div>`;
}
function renderModal() {
  const root = $("#modal-root");
  if (!modal) { root.innerHTML = ""; return; }
  if (modal.type === "editor") {
    const recurring = !!modal.original?.seriesId;
    const students = `<div class="field"><label for="field-student">Học sinh</label><select id="field-student">${data.students.map(s => `<option value="${esc(s.id)}" ${modal.studentId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}<option value="new" ${modal.studentId === "new" ? "selected" : ""}>+ Học sinh mới</option></select></div>`;
    const newName = modal.studentId === "new" ? `<div class="field"><label for="field-name">Tên học sinh mới</label><input id="field-name" autocomplete="off" maxlength="80" placeholder="Ví dụ: Minh Anh" value="${esc(modal.newName)}"></div>` : "";
    const repeat = !modal.original ? `<label class="toggle-row"><span><strong>Lặp hằng tuần</strong><small>Ứng dụng tự hiện vào cùng thứ mỗi tuần</small></span><input id="field-repeat" type="checkbox" ${modal.repeat ? "checked" : ""}></label>` : "";
    const scope = recurring ? `<div class="field"><span>Áp dụng thay đổi</span><div class="scope-options"><button data-action="scope" data-scope="one" class="${modal.scope === "one" ? "active" : ""}">Chỉ buổi này</button><button data-action="scope" data-scope="future" class="${modal.scope === "future" ? "active" : ""}">Buổi này trở đi</button></div></div>` : "";
    const status = modal.original ? `<div class="field"><span>Điểm danh</span><div class="status-options">${[["pending", "Chưa"], ["present", "Đã dạy"], ["absent", "Vắng"], ["cancelled", "Nghỉ"]].map(([id, label]) => `<button data-action="form-status" data-status="${id}" class="${modal.status === id ? "active" : ""}">${label}</button>`).join("")}</div></div>` : "";
    const body = `${students}${newName}
      <div class="field"><label for="field-date">Ngày học</label><input id="field-date" type="date" value="${esc(modal.date)}"></div>
      <div class="field-pair"><div class="field"><label for="field-start">Bắt đầu</label><input id="field-start" type="time" value="${esc(modal.start)}"></div><div class="field"><label for="field-end">Kết thúc</label><input id="field-end" type="time" value="${esc(modal.end)}"></div></div>
      <div class="field"><label for="field-fee">Học phí buổi này</label><input id="field-fee" type="number" min="0" max="100000000" inputmode="numeric" placeholder="Ví dụ: 200000" value="${esc(modal.fee)}"></div>
      ${repeat}${scope}${status}${recurring && modal.scope === "future" ? '<p class="helper-text">Buổi đã điểm danh trước ngày này được giữ nguyên.</p>' : ""}`;
    const footer = `${modal.original ? '<button class="danger" data-action="ask-delete">Xóa</button>' : '<button class="secondary" data-action="close">Hủy</button>'}<button class="primary" data-action="save-event">Lưu lịch học</button>`;
    root.innerHTML = frame(modal.original ? "Sửa lịch học" : "Thêm lịch học", body, footer);
  } else if (modal.type === "student") {
    const body = `<div class="field"><label for="student-name">Tên học sinh</label><input id="student-name" maxlength="80" autocomplete="off" placeholder="Ví dụ: Minh Anh" value="${esc(modal.name)}"></div><div class="field"><label for="student-fee">Giá mặc định mỗi buổi</label><input id="student-fee" type="number" min="0" max="100000000" inputmode="numeric" placeholder="Ví dụ: 200000" value="${esc(modal.defaultFee)}"></div><p class="helper-text">Giá mặc định dùng khi đặt buổi mới. Các buổi đã có vẫn giữ giá cũ.</p>`;
    root.innerHTML = frame(modal.id ? "Sửa học sinh" : "Thêm học sinh", body, `${modal.id ? '<button class="danger" data-action="delete-student">Xóa</button>' : '<button class="secondary" data-action="close">Hủy</button>'}<button class="primary" data-action="save-student">Lưu học sinh</button>`);
  } else if (modal.type === "payment") {
    const student = data.students.find(s => s.id === modal.studentId);
    const stats = studentStats(modal.studentId);
    const month = dateOf(selected);
    const body = `<p class="helper-text">Tháng ${month.getMonth()+1}/${month.getFullYear()} · ${esc(student?.name || "")}</p>
      <div class="field"><label for="payment-amount">Tổng số tiền đã nhận</label><input id="payment-amount" type="number" min="0" max="1000000000000" inputmode="numeric" value="${esc(modal.amount)}"></div>
      <button class="fill-payment" data-action="fill-payment">Điền bằng tiền theo lịch: ${dong(stats.scheduledAmount)}</button>
      <p class="helper-text">Nếu phụ huynh trả thêm, em sửa con số này thành tổng đã nhận trong tháng. Nhập 0 để bỏ ghi nhận.</p>`;
    root.innerHTML = frame("Ghi tiền đã thu", body, '<button class="secondary" data-action="close">Hủy</button><button class="primary" data-action="save-payment">Lưu số tiền</button>');
  } else if (modal.type === "confirm-delete") {
    const description = modal.previous.original?.seriesId && modal.previous.scope === "future" ? "Xóa lịch lặp từ buổi này trở đi?" : "Xóa buổi học này khỏi lịch?";
    root.innerHTML = frame("Xác nhận xóa", `<p class="helper-text">${description} Các buổi đã điểm danh trước đó vẫn được giữ.</p>`, '<button class="secondary" data-action="cancel-delete">Quay lại</button><button class="danger" data-action="delete">Xóa lịch</button>');
  } else if (modal.type === "confirm-import") {
    root.innerHTML = frame("Khôi phục dữ liệu?", `<p class="helper-text">Tệp này có ${modal.payload.series.length} lịch lặp và ${modal.payload.events.length} buổi riêng. Dữ liệu đang có trên máy sẽ được thay thế.</p>`, '<button class="secondary" data-action="close">Hủy</button><button class="primary" data-action="confirm-import">Khôi phục</button>');
  }
}

// Thêm, sửa một buổi hoặc thay đổi lịch lặp từ ngày đang chọn.
function collectEditor() {
  if (modal?.type !== "editor") return;
  const root = $("#modal-root");
  modal.studentId = $("#field-student", root).value;
  if ($("#field-name", root)) modal.newName = $("#field-name", root).value.trim();
  modal.date = $("#field-date", root).value;
  modal.start = $("#field-start", root).value;
  modal.end = $("#field-end", root).value;
  modal.fee = $("#field-fee", root).value;
  if (!modal.original) modal.repeat = $("#field-repeat", root).checked;
}
function validFee(value) { const amount = Number(value); return value !== "" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 100000000; }
function validAmount(value) { const amount = Number(value); return value !== "" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 1000000000000; }
function saveEditor() {
  collectEditor();
  const student = data.students.find(s => s.id === modal.studentId);
  const name = student?.name || (modal.studentId === "new" ? modal.newName.trim() : "");
  if (!name || name.length > 80 || !validDate(modal.date) || !validTime(modal.start) || !validTime(modal.end) || toMinutes(modal.end) <= toMinutes(modal.start) || !validFee(modal.fee))
    return toast("Em kiểm tra học sinh, ngày, giờ và học phí nhé.");
  const next = copyData();
  const studentId = student?.id || uid();
  if (!student) next.students.push({ id: studentId, name, defaultFee: Number(modal.fee), tone: nextTone(next.students) });
  const fields = { studentId, name, date: modal.date, start: modal.start, end: modal.end, fee: Number(modal.fee), status: modal.status };
  const original = modal.original;
  if (!original) {
    if (modal.repeat) next.series.push({ id: uid(), studentId, name: fields.name, firstDate: fields.date, start: fields.start, end: fields.end, fee: fields.fee, untilDate: null });
    else next.events.push({ id: uid(), ...fields });
  } else if (!original.seriesId) {
    const index = next.events.findIndex(x => x.id === original.id);
    if (index < 0) return toast("Không tìm thấy buổi học này.");
    next.events[index] = { ...next.events[index], ...fields };
  } else if (modal.scope === "one") {
    const index = next.exceptions.findIndex(x => x.seriesId === original.seriesId && x.sourceDate === original.sourceDate);
    const changed = { id: index >= 0 ? next.exceptions[index].id : uid(), seriesId: original.seriesId, sourceDate: original.sourceDate, deleted: false, ...fields };
    if (index >= 0) next.exceptions[index] = changed; else next.exceptions.push(changed);
  } else {
    const old = next.series.find(x => x.id === original.seriesId);
    if (!old) return toast("Lịch lặp này không còn tồn tại.");
    const cutoff = original.sourceDate;
    const dayShift = daysBetween(cutoff, fields.date);
    old.untilDate = shiftDate(cutoff, -1);
    const seriesId = uid();
    const future = { id: seriesId, studentId, name: fields.name, firstDate: fields.date, start: fields.start, end: fields.end, fee: fields.fee, untilDate: null };
    next.series.push(future);
    const oldExceptions = next.exceptions.filter(x => x.seriesId === old.id && x.sourceDate >= cutoff);
    next.exceptions = next.exceptions.filter(x => !(x.seriesId === old.id && x.sourceDate >= cutoff));
    for (const ex of oldExceptions) {
      if (ex.sourceDate === cutoff) continue;
      if (!ex.deleted) next.events.push({ id: uid(), studentId: ex.studentId || old.studentId, name: ex.name, date: ex.date, start: ex.start, end: ex.end, fee: ex.fee, status: ex.status });
      const mapped = shiftDate(ex.sourceDate, dayShift);
      if (mapped >= future.firstDate) next.exceptions.push({ id: uid(), seriesId, sourceDate: mapped, date: mapped, deleted: true, studentId, name: future.name, start: future.start, end: future.end, fee: future.fee, status: "pending" });
    }
    if (fields.status !== "pending") next.exceptions.push({ id: uid(), seriesId, sourceDate: fields.date, deleted: false, ...fields });
  }
  if (save(next)) { modal = null; renderModal(); selected = fields.date; render(); toast("Đã lưu lịch học"); }
}
function mark(key, status) {
  const item = selectedOccurrence(key);
  if (!item || !["pending", "present", "absent", "cancelled"].includes(status)) return;
  const next = copyData();
  if (!item.seriesId) {
    const found = next.events.find(x => x.id === item.id);
    if (found) found.status = status;
  } else {
    const index = next.exceptions.findIndex(x => x.seriesId === item.seriesId && x.sourceDate === item.sourceDate);
    const changed = { id: index >= 0 ? next.exceptions[index].id : uid(), seriesId: item.seriesId, sourceDate: item.sourceDate, studentId: item.studentId, name: item.name, date: item.date, start: item.start, end: item.end, fee: item.fee, status, deleted: false };
    if (index >= 0) next.exceptions[index] = changed; else next.exceptions.push(changed);
  }
  if (save(next)) toast(status === "present" ? "Đã điểm danh" : status === "pending" ? "Đã bỏ đánh dấu" : status === "absent" ? "Đã ghi vắng" : "Đã ghi nghỉ");
}
function deleteEditor() {
  const original = modal.previous.original;
  const next = copyData();
  if (!original.seriesId) next.events = next.events.filter(x => x.id !== original.id);
  else if (modal.previous.scope === "future") {
    const series = next.series.find(x => x.id === original.seriesId);
    if (series) series.untilDate = shiftDate(original.sourceDate, -1);
    next.exceptions = next.exceptions.filter(x => !(x.seriesId === original.seriesId && x.sourceDate >= original.sourceDate));
  } else {
    const index = next.exceptions.findIndex(x => x.seriesId === original.seriesId && x.sourceDate === original.sourceDate);
    const deleted = { id: index >= 0 ? next.exceptions[index].id : uid(), seriesId: original.seriesId, sourceDate: original.sourceDate, date: original.date, studentId: original.studentId, name: original.name, start: original.start, end: original.end, fee: original.fee, status: "pending", deleted: true };
    if (index >= 0) next.exceptions[index] = deleted; else next.exceptions.push(deleted);
  }
  if (save(next)) { modal = null; renderModal(); toast("Đã xóa khỏi lịch"); }
}
function changeMonth(direction) {
  const d = dateOf(selected), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + direction);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  selected = dateKey(d); render();
}
function openStudent(student = null) {
  modal = { type: "student", id: student?.id || null, name: student?.name || "", defaultFee: student ? String(student.defaultFee) : "" };
  renderModal();
}
function saveStudent() {
  const name = $("#student-name", $("#modal-root")).value.trim();
  const fee = $("#student-fee", $("#modal-root")).value;
  if (!name || name.length > 80 || !validFee(fee)) return toast("Em nhập tên và giá mỗi buổi nhé.");
  const next = copyData();
  if (modal.id) {
    const student = next.students.find(s => s.id === modal.id);
    if (!student) return toast("Không tìm thấy học sinh.");
    student.name = name; student.defaultFee = Number(fee);
  } else {
    next.students.push({ id: uid(), name, defaultFee: Number(fee), tone: nextTone(next.students) });
  }
  if (save(next)) { modal = null; renderModal(); toast("Đã lưu học sinh"); }
}
function deleteStudent() {
  const id = modal?.id;
  if (!id) return;
  if ([...data.events, ...data.series, ...data.exceptions, ...data.payments].some(item => item.studentId === id))
    return toast("Bạn này đã có lịch hoặc tiền đã thu. Em hãy giữ hồ sơ để đối chiếu.");
  const next = copyData();
  next.students = next.students.filter(s => s.id !== id);
  if (save(next)) { selectedStudentId = null; view = "students"; modal = null; render(); toast("Đã xóa học sinh"); }
}
function openPayment(id) {
  if (!data.students.some(s => s.id === id)) return;
  modal = { type: "payment", studentId: id, amount: String(amountReceived(id)) };
  renderModal();
}
function savePayment() {
  if (modal?.type !== "payment") return;
  const amount = $("#payment-amount", $("#modal-root")).value;
  if (!validAmount(amount)) return toast("Em nhập số tiền đã nhận hợp lệ nhé.");
  const next = copyData();
  const month = selected.slice(0, 7);
  next.payments = next.payments.filter(p => !(p.studentId === modal.studentId && p.month === month));
  if (Number(amount) > 0) next.payments.push({ studentId: modal.studentId, month, amount: Number(amount) });
  if (save(next)) { modal = null; renderModal(); toast("Đã cập nhật tiền đã thu"); }
}
function reportText(id) {
  const student = data.students.find(s => s.id === id);
  if (!student) return "";
  const d = dateOf(selected), stats = studentStats(id);
  const state = item => item.status === "present" ? "Đã dạy" : item.status === "absent" ? "Vắng" : item.status === "cancelled" ? "Nghỉ" : "Chưa điểm danh";
  return [
    `ĐIỂM DANH THÁNG ${d.getMonth()+1}/${d.getFullYear()} — ${student.name}`,
    "",
    ...(stats.sessions.length ? stats.sessions.map(item => `${dateOf(item.date).getDate()}/${d.getMonth()+1}  ${item.start}–${item.end}  ·  ${state(item)}  ·  ${dong(item.fee)}`) : ["Chưa có buổi học."]),
    "",
    `Học phí theo lịch: ${stats.sessions.length} buổi · ${dong(stats.scheduledAmount)}`,
    `Đã dạy: ${stats.taught.length} buổi · ${dong(stats.taughtAmount)}`,
    `Đã thu: ${dong(amountReceived(id))}`
  ].join("\n");
}

function importOkay(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  const result = normalize(parsed);
  if (!result || result.events.length + result.series.length + result.exceptions.length > 20000) return false;
  if (!Array.isArray(result.students) || result.students.length > 2000 || !result.students.every(s => typeof s.id === "string" && typeof s.name === "string" && !!s.name.trim() && s.name.length <= 80 && validFee(String(s.defaultFee)))) return false;
  const ids = new Set(result.students.map(s => s.id));
  if (ids.size !== result.students.length) return false;
  const good = x => x && typeof x.id === "string" && typeof x.name === "string" && x.name.length <= 80 && ids.has(x.studentId) && validTime(x.start) && validTime(x.end) && validFee(String(x.fee));
  if (!result.events.every(x => good(x) && validDate(x.date))) return false;
  if (!result.series.every(x => good(x) && validDate(x.firstDate) && (!x.untilDate || validDate(x.untilDate)))) return false;
  if (!result.exceptions.every(x => good(x) && validDate(x.date) && validDate(x.sourceDate) && typeof x.seriesId === "string")) return false;
  if (!Array.isArray(result.payments) || result.payments.length > 24000) return false;
  if (!result.payments.every(p => p && ids.has(p.studentId) && /^\d{4}-\d{2}$/.test(p.month) && validDate(p.month + "-01") && validAmount(String(p.amount)))) return false;
  if (new Set(result.payments.map(p => p.studentId + ":" + p.month)).size !== result.payments.length) return false;
  return result;
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "backdrop") { if (event.target === button) closeModal(); return; }
  if (action === "settings") { previousView = view; view = "settings"; render(); window.scrollTo(0, 0); }
  else if (action === "back") { view = view === "settings" ? previousView : view === "report" ? "students" : "calendar"; render(); }
  else if (action === "tab-calendar") { view = "calendar"; render(); }
  else if (action === "tab-students") { view = "students"; render(); }
  else if (action === "date") { selected = button.dataset.date; render(); }
  else if (action === "today") { selected = today(); render(); }
  else if (action === "prev-month" || action === "next-month") changeMonth(action === "prev-month" ? -1 : 1);
  else if (action === "add") openNew();
  else if (action === "add-for") openNew(button.dataset.id);
  else if (action === "new-student") openStudent();
  else if (action === "edit-student") openStudent(data.students.find(s => s.id === button.dataset.id));
  else if (action === "save-student") saveStudent();
  else if (action === "delete-student") deleteStudent();
  else if (action === "edit-payment") openPayment(button.dataset.id);
  else if (action === "fill-payment") $("#payment-amount", $("#modal-root")).value = String(studentStats(modal.studentId).scheduledAmount);
  else if (action === "save-payment") savePayment();
  else if (action === "report") { selectedStudentId = button.dataset.id; view = "report"; render(); }
  else if (action === "share-report") {
    const message = reportText(button.dataset.id);
    if (window.BuoiAndroid?.shareText) BuoiAndroid.shareText(message);
    else if (navigator.share) navigator.share({ text: message }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(message).then(() => toast("Đã sao chép báo cáo")).catch(() => toast("Không chia sẻ được."));
  }
  else if (action === "edit") openEdit(selectedOccurrence(button.dataset.key));
  else if (action === "mark") mark(button.dataset.key, button.dataset.status);
  else if (action === "close") closeModal();
  else if (action === "scope") { collectEditor(); modal.scope = button.dataset.scope; renderModal(); }
  else if (action === "form-status") { collectEditor(); modal.status = button.dataset.status; renderModal(); }
  else if (action === "save-event") saveEditor();
  else if (action === "ask-delete") { collectEditor(); modal = { type: "confirm-delete", previous: modal }; renderModal(); }
  else if (action === "cancel-delete") { modal = modal.previous; renderModal(); }
  else if (action === "delete") deleteEditor();
  else if (action === "export") {
    const text = JSON.stringify(data);
    if (window.BuoiAndroid) BuoiAndroid.exportBackup(text);
    else { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); link.download = "diem-danh-sao-luu.json"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  }
  else if (action === "import") {
    const picker = document.getElementById("backup-file");
    if (picker) { picker.value = ""; picker.click(); }
  }
  else if (action === "confirm-import") { if (save(modal.payload)) { modal = null; renderModal(); toast("Đã khôi phục lịch học"); } }
});
document.addEventListener("change", event => {
  const id = event.target.id;
  if (id === "field-student" && modal?.type === "editor") {
    const previous = modal.studentId;
    collectEditor();
    if (!modal.original && (modal.fee === "" || modal.fee === String(data.students.find(s => s.id === previous)?.defaultFee))) {
      const student = data.students.find(s => s.id === modal.studentId);
      modal.fee = student ? String(student.defaultFee) : "";
    }
    renderModal();
    return;
  }
  if (!["setting-theme", "setting-week", "setting-duration"].includes(id)) return;
  const next = copyData();
  if (id === "setting-theme") next.settings.theme = event.target.value === "light" ? "light" : "dark";
  if (id === "setting-week") next.settings.weekStart = Number(event.target.value) === 0 ? 0 : 1;
  if (id === "setting-duration") next.settings.duration = [60, 90, 120].includes(Number(event.target.value)) ? Number(event.target.value) : 90;
  if (save(next)) toast("Đã lưu cài đặt");
});
document.addEventListener("keydown", event => { if (event.key === "Escape" && modal) closeModal(); });
window.receiveBackup = rawText => {
  try {
    const payload = importOkay(JSON.parse(rawText));
    if (!payload) throw new Error();
    modal = { type: "confirm-import", payload }; renderModal();
  } catch (_) { toast("Tệp sao lưu không hợp lệ."); }
};
window.backupSaved = () => toast("Đã lưu bản sao lưu.");
window.backupError = () => toast("Chưa đọc hoặc lưu được tệp sao lưu.");
document.querySelector("#backup-file")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast("Tệp sao lưu quá lớn."); return; }
  try { window.receiveBackup(await file.text()); }
  catch (_) { toast("Không đọc được tệp sao lưu."); }
});
window.appBack = () => {
  if (modal) { closeModal(); return true; }
  if (view === "report") { view = "students"; render(); return true; }
  if (view === "settings") { view = previousView; render(); return true; }
  if (view === "students") { view = "calendar"; render(); return true; }
  if (selected !== today()) { selected = today(); render(); return true; }
  return false;
};
applyTheme();
render();
