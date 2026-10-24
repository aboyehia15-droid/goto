/**
 * حضور وانصراف المعلمين والموظفين — Google Apps Script
 * تُحفظ كل البيانات في جدول جوجل هذا نفسه، ويدخل الأفراد برابط عادي دون حساب.
 *
 * الخطوات (مرة واحدة):
 *  1) غيّر INITIAL_ADMIN_PIN في السطر التالي إلى رمز دخول الإدارة (أرقام فقط، 4 إلى 8).
 *  2) اختر الدالة setup من القائمة أعلى المحرر ثم اضغط «تشغيل» ووافق على الصلاحيات.
 *  3) انشر: نشر > عملية نشر جديدة > تطبيق ويب
 *     (تنفيذ باسم: أنا   |   من لديه صلاحية الوصول: أي شخص).
 *
 * عند تحديث الكود لاحقاً: شغّل setup مرة أخرى (لا تمسح بياناتك)، ثم أعد النشر بإصدار جديد.
 */
const INITIAL_ADMIN_PIN = '1234';

// ---------- إعدادات عامة (يمكن تركها كما هي) ----------
const TZ = 'Asia/Riyadh';
const TITLE = 'بصمة مجمع ابن تيمية';
const TEACHER_SESSION_DAYS = 30;      // مدة بقاء الفرد مسجّلاً على جواله
const ADMIN_SESSION_HOURS = 12;       // مدة جلسة الإدارة
const MAX_FAILS = 5;                  // عدد المحاولات الخاطئة قبل القفل المؤقت
const LOCK_SECONDS = 900;             // مدة القفل: 15 دقيقة
const MIN_OUT_GAP_MS = 120000;        // أقل فاصل بين الحضور والانصراف: دقيقتان
const MULTI_EARLY = 15, MULTI_LATE = 30; // نافذة الالتزام الصارمة (دقائق) لمن لديه أكثر من فترة: لا يُقبل تسجيل حضور فترته إلا ضمنها
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// أوراق الجدول. يمكنك تغيير عناوين الأعمدة بحرية، لكن لا تغيّر ترتيبها.
const SH = {
  teachers: { name: 'المعلمون', cols: ['المعرّف', 'الاسم', 'المادة أو الوظيفة', 'فعّال', 'الترتيب', 'رمز الدخول (مشفّر)', 'النوع', 'معرّف الفترات (مفصولة بفاصلة)'] },
  shifts: { name: 'الفترات', cols: ['المعرّف', 'اسم الفترة', 'بداية الدوام', 'نهاية الدوام', 'سماح (دقائق)', 'يتطلب الموقع', 'يسمح بالتسجيل اليدوي'] },
  attendance: { name: 'الحضور', cols: ['معرّف الفرد', 'الاسم', 'التاريخ', 'اليوم', 'الحضور', 'الانصراف', 'وقت تسجيل الحضور', 'وقت تسجيل الانصراف', 'الطريقة', 'تعديل الإدارة', 'ملاحظة', 'الفترة', 'بداية الفترة', 'نهاية الفترة', 'سماح (دقائق)', 'معرّف الفترة', 'عُدّل بواسطة', 'وقت التعديل'] },
  requests: { name: 'الطلبات', cols: ['المعرّف', 'معرّف الفرد', 'الاسم', 'النوع', 'من تاريخ', 'إلى تاريخ', 'من ساعة', 'إلى ساعة', 'السبب', 'وقت الطلب', 'الحالة', 'ملاحظة الإدارة', 'وقت القرار', 'القرار بواسطة'] },
  holidays: { name: 'الإجازات', cols: ['التاريخ', 'الاسم'] },
  settings: { name: 'الإعدادات', cols: ['المفتاح', 'القيمة'] },
  extra: { name: 'دوام إضافي', cols: ['المعرّف', 'التاريخ', 'معرّف الفترة', 'معرّف الفرد', 'الاسم', 'ملاحظة'] },
  duty: { name: 'المناوبة', cols: ['المعرّف', 'اليوم أو التاريخ', 'معرّف الفترة', 'النوع', 'معرّف الفرد', 'الاسم', 'ملاحظة'] },
  messages: { name: 'الرسائل', cols: ['المعرّف', 'معرّف الفرد', 'الاسم', 'النص', 'يظهر من تاريخ', 'وقت الإرسال', 'مقروءة', 'وقت القراءة', 'المرسل'] },
  users: { name: 'المستخدمون', cols: ['المعرّف', 'الاسم', 'رمز الدخول (مشفّر)', 'الصلاحيات', 'فعّال', 'وقت الإنشاء', 'أنشأه'] },
  audit: { name: 'سجل التعديلات', cols: ['الوقت', 'المستخدم', 'الإجراء', 'التفاصيل'] },
  subs: { name: 'أجهزة التنبيه', cols: ['الدور', 'المعرّف', 'الاسم', 'عنوان الجهاز', 'مفتاح الجهاز', 'رمز المصادقة', 'نوع الجهاز', 'وقت التفعيل'] }
};
// الصلاحيات التي يمكن منحها لمستخدمي الإدارة (المدير العام يملكها كلها)
const PERMS = {
  att: 'الحضور: تحضير وتعديل وحذف السجلات',
  req: 'الطلبات: الموافقة والرفض والحذف',
  people: 'الأفراد: إضافة وتعديل وإيقاف وحذف وإعادة ضبط الرمز',
  shifts: 'الفترات والإجازات الرسمية',
  duty: 'المناوبة والدوام الإضافي',
  msgs: 'الرسائل',
  settings: 'الإعدادات العامة (الموقع والتذكير والسلوك)'
};

// ============================================================
//  نقاط الدخول
// ============================================================
function doGet() {
  resetMemo_();
  // عند التشغيل عبر المُحمِّل ذاتي التحديث تأتي الواجهة من GitHub، وإلا من ملف Index في المشروع
  return (typeof LOADER_HTML_ === 'function' ? HtmlService.createHtmlOutput(LOADER_HTML_()) : HtmlService.createHtmlOutputFromFile('Index'))
    .setTitle(TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// تُستخدم عند تشغيل البرنامج كتطبيق مثبّت (PWA) من موقع آخر
function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { req = {}; }
  return ContentService.createTextOutput(JSON.stringify(api(req))).setMimeType(ContentService.MimeType.JSON);
}

// الجدول الذي يحتوي هذا السكربت (مع احتياط بالمعرّف المحفوظ عند الإعداد)
function ss_() {
  const a = SpreadsheetApp.getActiveSpreadsheet();
  if (a) return a;
  const id = PropertiesService.getScriptProperties().getProperty('SSID');
  if (!id) throw new Error('افتح السكربت من داخل الجدول: الإضافات > Apps Script');
  return SpreadsheetApp.openById(id);
}

function setup() {
  resetMemo_();
  const ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SSID', ss.getId());
  Object.keys(SH).forEach(function (k) {
    let sh = ss.getSheetByName(SH[k].name);
    if (!sh) sh = ss.insertSheet(SH[k].name);
    const n = SH[k].cols.length;
    sh.getRange(1, 1, 1, n).setNumberFormat('@').setValues([SH[k].cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), n).setNumberFormat('@');
  });
  ['Sheet1', 'ورقة1'].forEach(function (nm) {
    const d = ss.getSheetByName(nm);
    if (d && ss.getSheets().length > 1 && d.getLastRow() === 0) ss.deleteSheet(d);
  });
  getSecret_();
  if (!getSetting_('adminPin')) setSetting_('adminPin', hashPin_(INITIAL_ADMIN_PIN));
  if (!getSetting_('workLat')) setSetting_('workLat', '26.340630');
  if (!getSetting_('workLng')) setSetting_('workLng', '50.143651');
  if (!getSetting_('workRadius')) setSetting_('workRadius', '200');
  if (!getSetting_('remindInText')) setSetting_('remindInText', 'لا تنسَ تسجيل حضورك، ولا تنسَ ذكر الله');
  if (!getSetting_('remindOutText')) setSetting_('remindOutText', 'لا تنسَ تسجيل انصرافك قبل المغادرة');
  if (!getSetting_('autoAbsentEnabled')) setSetting_('autoAbsentEnabled', 'نعم');
  if (!getSetting_('remindersEnabled')) setSetting_('remindersEnabled', 'نعم');
  const defs = {
    extraEnabled: 'نعم', dutyEnabled: 'نعم', dutyReminderEnabled: 'نعم', dutyReminderMinutes: '30',
    dutyStartText: 'تذكير: لديك مناوبة استقبال الطلاب اليوم في {الفترة} الساعة {الوقت}',
    dutyEndText: 'تذكير: لديك مناوبة انصراف الطلاب اليوم في {الفترة} الساعة {الوقت}',
    messagesEnabled: 'نعم', msgNotifyEnabled: 'نعم', manualAll: 'نعم', ownerName: 'المدير العام',
    pushEnabled: 'نعم', pushAdminReq: 'نعم', pushInLead: '10'
  };
  Object.keys(defs).forEach(function (k) { if (!getSetting_(k)) setSetting_(k, defs[k]); });
  try { vapid_(); } catch (e) { }
  props_().deleteProperty('PUSH_TRIGGER');
  const trg = ensurePushTrigger_();
  bump_();
  return 'تم الإعداد' + (trg ? ' وتفعيل مؤقت التذكيرات' : '') + '. انشر الآن التطبيق كتطبيق ويب (إصدار جديد).';
}

// إن نسيت رمز الإدارة: غيّر INITIAL_ADMIN_PIN ثم شغّل هذه الدالة.
function resetAdminPin() {
  setSetting_('adminPin', hashPin_(INITIAL_ADMIN_PIN));
  bump_();
  return 'تمت إعادة ضبط رمز الإدارة.';
}

// ============================================================
//  واجهة الاستدعاء من الصفحة
// ============================================================
function api(req) {
  resetMemo_();
  try {
    const a = req && req.action;
    const p = (req && req.payload) || {};
    switch (a) {
      case 'ver': return { ok: true, ver: getVer_() };
      case 'list': return { ok: true, list: publicList_(), admins: adminList_() };
      case 'activate': return withLock_(function () { return activate_(p); });
      case 'login': return login_(p);
      case 'adminLogin': return adminLogin_(p);
      case 'pushKey': return { ok: true, key: vapid_().pub };
    }
    const s = session_(p.token);
    switch (a) {
      case 'state': return { ok: true, state: state_(s) };
      case 'changePin': return withLock_(function () { return changePin_(s, p); });
      case 'punch': return withLock_(function () {
        need_(s, 'teacher');
        const r = punch_(s, p.method, p.shiftId, p.loc, p.manualTime);
        if (p.manualTime) log_(s, 'تسجيل يدوي ' + (r.kind === 'in' ? 'للحضور' : 'للانصراف'), (r.shiftName ? r.shiftName + ' — ' : '') + 'الوقت المسجّل ' + r.hm);
        bump_();
        return { ok: true, kind: r.kind, hm: r.hm, shiftName: r.shiftName, state: state_(s) };
      });
      case 'reqCreate': { const r = mutate_(s, 'teacher', function () { reqCreate_(s, p); log_(s, 'طلب ' + (p.type === 'absence' ? 'غياب' : 'استئذان'), S_(p.from) + ' — ' + clip_(p.reason, 120)); }); notifyNewRequest_(s, p); return r; }
      case 'pushSub': return withLock_(function () { return Object.assign({ ok: true }, pushSub_(s, p)); });
      case 'pushUnsub': return withLock_(function () { pushUnsub_(s, p); return { ok: true }; });
      case 'pushTest': return Object.assign({ ok: true }, pushTest_(s, p));
      case 'reqCancel': return mutate_(s, 'teacher', function () { reqCancel_(s, p); log_(s, 'إلغاء طلب', ''); });
      case 'msgRead': return mutate_(s, 'teacher', function () { msgRead_(s, p); });
      case 'audit': needPerm_(s, ''); return { ok: true, audit: audit_(p) };
    }
    const spec = ADMIN_ACTIONS[a];
    if (spec) { const r = adminMutate_(s, a, spec, p); if (a === 'msgSend' && r.ok) notifyMessages_(p); return r; }
    fail_('طلب غير معروف');
  } catch (e) {
    if (e && e.auth) return { ok: false, auth: true, error: 'انتهت الجلسة. سجّل الدخول من جديد.' };
    if (e && e.user) return { ok: false, error: e.message };
    if (e && /lock/i.test(String(e.message))) return { ok: false, error: 'الخادم مشغول لحظياً. حاول مرة أخرى.' };
    console.error(e && e.stack || e);
    return { ok: false, error: 'خطأ في الخادم: ' + (e && e.message || e) };
  }
}

// كل إجراءات الإدارة: [الصلاحية المطلوبة، اسم الإجراء في السجل، التنفيذ]
const ADMIN_ACTIONS = {
  decide: ['req', 'قرار على طلب', function (s, p) { decide_(s, p); }],
  undoDecide: ['req', 'إلغاء قرار طلب', function (s, p) { setDecision_(p.id, 'pending', '', ''); }],
  reqDelete: ['req', 'حذف طلب', function (s, p) { reqDelete_(p); }],
  dayEdit: ['att', 'تعديل حضور يوم', function (s, p) { dayEdit_(p, s); }],
  dayDel: ['att', 'حذف سجلات يوم', function (s, p) { dayDel_(p); }],
  attDelete: ['att', 'حذف سجلات فترة', function (s, p) { return attDelete_(p); }],
  teacherAdd: ['people', 'إضافة أفراد', function (s, p) { teacherAdd_(p); }],
  teacherEdit: ['people', 'تعديل بيانات فرد', function (s, p) { teacherEdit_(p); }],
  teacherActive: ['people', 'إيقاف/تفعيل فرد', function (s, p) { teacherActive_(p); }],
  teacherResetPin: ['people', 'إعادة ضبط رمز فرد', function (s, p) { teacherResetPin_(p); }],
  teacherDelete: ['people', 'حذف فرد', function (s, p) { return teacherDelete_(p); }],
  shiftSave: ['shifts', 'حفظ فترة', function (s, p) { shiftSave_(p); }],
  shiftDelete: ['shifts', 'حذف فترة', function (s, p) { shiftDelete_(p); }],
  shiftAssign: ['shifts', 'تعيين أفراد لفترة', function (s, p) { shiftAssign_(p); }],
  shiftSetFlagAll: ['shifts', 'تغيير خيار لكل الفترات', function (s, p) { shiftSetFlagAll_(p); }],
  holAdd: ['shifts', 'إضافة إجازة رسمية', function (s, p) { holAdd_(p); }],
  holDel: ['shifts', 'حذف إجازة رسمية', function (s, p) { holDel_(p); }],
  settingsSave: ['settings', 'تعديل الإعدادات', function (s, p) { settingsSave_(p); }],
  resolveMapLink: ['settings', 'تحديد موقع العمل', function (s, p) { return resolveMapLink_(p); }],
  extraSave: ['duty', 'تكليف بدوام إضافي', function (s, p) { extraSave_(p); }],
  extraDelete: ['duty', 'حذف تكليف دوام إضافي', function (s, p) { extraDelete_(p); }],
  dutySet: ['duty', 'تعديل المناوبة', function (s, p) { dutySet_(p); }],
  dutyDelete: ['duty', 'حذف مناوبة', function (s, p) { dutyDelete_(p); }],
  msgSend: ['msgs', 'إرسال رسالة', function (s, p) { return msgSend_(p, s); }],
  msgDelete: ['msgs', 'حذف رسالة', function (s, p) { msgDelete_(p); }],
  userSave: ['owner', 'حفظ مستخدم إدارة', function (s, p) { return userSave_(s, p); }],
  userDelete: ['owner', 'حذف مستخدم إدارة', function (s, p) { return userDelete_(p); }]
};
// اختيار الإعداد المعروض للإعدادات العامة (الموقع والتذكير) مقابل إعدادات الأقسام الأخرى
const SETTING_PERM = { pushAdminReq: 'req', extraEnabled: 'duty', dutyEnabled: 'duty', dutyReminderEnabled: 'duty', dutyReminderMinutes: 'duty', dutyStartText: 'duty', dutyEndText: 'duty', messagesEnabled: 'msgs', msgNotifyEnabled: 'msgs', ownerName: 'owner' };
function tNameOf_(id) { const t = findTeacher_(S_(id)); return t ? t.name : ''; }
function shNameOf_(id) { const x = findShift_(S_(id)); return x ? x.name : ''; }
function namesOf_(ids) { return (ids || []).map(tNameOf_).filter(Boolean).join('، '); }
// وصف مختصر وواضح لكل إجراء في سجل التعديلات (يُحسب قبل التنفيذ لأن الحذف يزيل الأسماء)
function describe_(a, p) {
  try {
    switch (a) {
      case 'decide': { const r = rows_('requests').map(reqFromRow_).filter(function (x) { return x.id === S_(p.id); })[0]; return (p.status === 'approved' ? 'موافقة' : 'رفض') + (r ? ' — ' + tNameOf_(r.tid) + ' — ' + (r.type === 'absence' ? 'غياب ' : 'استئذان ') + r.from : '') + (p.note ? ' — ' + p.note : ''); }
      case 'undoDecide': case 'reqDelete': { const r = rows_('requests').map(reqFromRow_).filter(function (x) { return x.id === S_(p.id); })[0]; return r ? tNameOf_(r.tid) + ' — ' + r.from : ''; }
      case 'dayEdit': return tNameOf_(p.tid) + ' — ' + p.date + ' — ' + (p.periods || []).map(function (x) { return (x.sid ? shNameOf_(x.sid) + ': ' : '') + (x.in || '—') + ' ← ' + (x.out || '—'); }).join('، ') + (p.note ? ' — ' + p.note : '');
      case 'dayDel': return tNameOf_(p.tid) + ' — ' + p.date;
      case 'attDelete': return (p.tid && p.tid !== 'all' ? tNameOf_(p.tid) : 'كل الأفراد') + ' — من ' + p.from + ' إلى ' + p.to;
      case 'teacherAdd': return (p.names || []).filter(Boolean).join('، ');
      case 'teacherEdit': return tNameOf_(p.id) + (S_(p.name) && S_(p.name) !== tNameOf_(p.id) ? ' ← ' + p.name : '');
      case 'teacherActive': return tNameOf_(p.id) + ' — ' + (p.active ? 'تفعيل' : 'إيقاف');
      case 'teacherResetPin': case 'teacherDelete': return tNameOf_(p.id) + (p.purge ? ' مع حذف سجلاته' : '');
      case 'shiftSave': return S_(p.name) + ' ' + S_(p.start) + '–' + S_(p.end) + (p.id ? ' (تعديل)' : ' (جديدة)');
      case 'shiftDelete': return shNameOf_(p.id);
      case 'shiftAssign': return shNameOf_(p.shiftId) + ' — ' + namesOf_(p.tids);
      case 'shiftSetFlagAll': return (p.field === 'reqLoc' ? 'اشتراط الموقع' : 'التسجيل اليدوي') + ' — ' + (p.value ? 'تفعيل' : 'إيقاف');
      case 'holAdd': return S_(p.date) + ' ' + S_(p.name);
      case 'holDel': return S_(p.date);
      case 'settingsSave': return Object.keys(p).filter(function (k) { return k !== 'token'; }).map(function (k) { return k + '=' + (typeof p[k] === 'boolean' ? (p[k] ? 'تفعيل' : 'إيقاف') : S_(p[k]).slice(0, 60)); }).join('، ');
      case 'extraSave': return S_(p.date) + ' — ' + (shNameOf_(p.sid) || 'بدون فترة') + ' — ' + namesOf_(p.tids);
      case 'extraDelete': { const x = allExtra_().filter(function (e) { return e.id === S_(p.id); })[0]; return x ? tNameOf_(x.tid) + ' — ' + x.date : ''; }
      case 'dutySet': return (isDate_(S_(p.day)) ? p.day : (DAY_NAMES[Number(p.day)] || p.day)) + ' — ' + shNameOf_(p.sid) + ' — ' + (p.type === 'end' ? 'انصراف' : 'استقبال') + ' — ' + (namesOf_(p.tids) || 'بلا مناوب');
      case 'dutyDelete': { const x = allDuty_().filter(function (d) { return d.id === S_(p.id); })[0]; return x ? tNameOf_(x.tid) : ''; }
      case 'msgSend': return namesOf_(p.tids) + ' — ' + clip_(p.text, 150);
      case 'msgDelete': { const m = rows_('messages').map(msgFromRow_).filter(function (x) { return x.id === S_(p.id); })[0]; return m ? tNameOf_(m.tid) + ' — ' + clip_(m.text, 80) : ''; }
      case 'userSave': return S_(p.name) + (p.id ? ' (تعديل)' : ' (جديد)') + ' — الصلاحيات: ' + ((p.perms || []).map(function (k) { return PERMS[k] ? PERMS[k].split(':')[0] : ''; }).filter(Boolean).join('، ') || 'اطلاع فقط');
      case 'userDelete': { const u = findUser_(S_(p.id)); return u ? u.name : ''; }
    }
  } catch (e) { }
  return '';
}
function adminMutate_(s, a, spec, p) {
  return withLock_(function () {
    let perm = spec[0];
    if (a === 'settingsSave') {
      // صلاحية حفظ الإعدادات حسب نوع الإعداد المطلوب تغييره
      Object.keys(p).forEach(function (k) { if (k !== 'token') needPerm_(s, SETTING_PERM[k] || 'settings'); });
      perm = '';
    }
    needPerm_(s, perm);
    const details = describe_(a, p);
    const extra = spec[2](s, p);
    log_(s, spec[1], details);
    bump_();
    const out = { ok: true, state: state_(s) };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  });
}
function mutate_(s, role, fn) {
  return withLock_(function () {
    need_(s, role);
    const extra = fn();
    bump_();
    const out = { ok: true, state: state_(s) };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  });
}

// ============================================================
//  أدوات عامة
// ============================================================
function fail_(msg) { const e = new Error(msg); e.user = true; throw e; }
function authFail_() { const e = new Error('AUTH'); e.auth = true; throw e; }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function need_(s, role) { if (s.role !== role) fail_('غير مصرّح لك بهذا الإجراء'); }

function S_(v) { return v == null ? '' : String(v).trim(); }
function D_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = S_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function T_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  const m = S_(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function isDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
function isTime_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
function dow_(date) { const p = date.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
function isWorkday_(date) { return dow_(date) <= 4; }
function todayStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function rid_(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function clip_(v, n) { return S_(v).slice(0, n); }
function cell_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : (v == null ? '' : v); }

// ذاكرة مؤقتة لكل طلب: كل ورقة تُقرأ مرة واحدة فقط في الطلب الواحد (تسريع كبير)، وتُفرَّغ عند أي كتابة عليها
let MEMO = { rows: {}, sheets: {}, ss: null };
function resetMemo_() { MEMO = { rows: {}, sheets: {}, ss: null }; }
function sheet_(k) {
  if (MEMO.sheets[k]) return MEMO.sheets[k];
  if (!MEMO.ss) MEMO.ss = ss_();
  let sh = MEMO.ss.getSheetByName(SH[k].name);
  if (!sh) {
    // إنشاء الأوراق الجديدة تلقائياً عند أول استخدام (بلا حاجة لإعادة تشغيل setup)
    if (k === 'teachers' || k === 'settings') fail_('لم يتم تشغيل setup بعد. شغّلها من محرر السكربت.');
    sh = MEMO.ss.insertSheet(SH[k].name);
    sh.getRange(1, 1, 1, SH[k].cols.length).setNumberFormat('@').setValues([SH[k].cols]).setFontWeight('bold');
    sh.setFrozenRows(1); sh.setRightToLeft(true);
  }
  MEMO.sheets[k] = sh;
  return sh;
}
function rows_(k) {
  if (MEMO.rows[k]) return MEMO.rows[k];
  const sh = sheet_(k), n = sh.getLastRow();
  const out = n < 2 ? [] : sh.getRange(2, 1, n - 1, SH[k].cols.length).getValues();
  MEMO.rows[k] = out;
  return out;
}
// آخر n صفوف فقط (للسجلات الطويلة مثل سجل التعديلات)
function tailRows_(k, n) {
  const sh = sheet_(k), last = sh.getLastRow();
  if (last < 2) return [];
  const from = Math.max(2, last - n + 1);
  return sh.getRange(from, 1, last - from + 1, SH[k].cols.length).getValues();
}
function dirty_(k) { delete MEMO.rows[k]; }
function setCells_(k, row, col, arr) {
  sheet_(k).getRange(row, col, 1, arr.length).setNumberFormat('@').setValues([arr]);
  dirty_(k);
}
function appendRow_(k, arr) {
  const sh = sheet_(k);
  sh.getRange(sh.getLastRow() + 1, 1, 1, arr.length).setNumberFormat('@').setValues([arr]);
  dirty_(k);
}
function delRow_(k, row) { sheet_(k).deleteRow(row); dirty_(k); }
// إعادة كتابة كل صفوف ورقة (للحذف الجماعي)
function rewriteRows_(k, rows) {
  const sh = sheet_(k), w = SH[k].cols.length, n = sh.getLastRow();
  if (n >= 2) sh.getRange(2, 1, n - 1, w).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, w).setNumberFormat('@').setValues(rows.map(function (r) { return r.slice(0, w).concat(new Array(Math.max(0, w - r.length)).fill('')).map(cell_); }));
  dirty_(k);
}

// ---------- الإعدادات والإصدار ----------
function props_() { return PropertiesService.getScriptProperties(); }
function bump_() { const p = props_(); p.setProperty('VER', String(Number(p.getProperty('VER') || 0) + 1)); }
function getVer_() { return Number(props_().getProperty('VER') || 0); }
function getSecret_() {
  const p = props_();
  let s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  return s;
}
function getSetting_(key) {
  const rs = rows_('settings');
  for (let i = 0; i < rs.length; i++) if (S_(rs[i][0]) === key) return S_(rs[i][1]);
  return '';
}
function setSetting_(key, val) {
  const rs = rows_('settings');
  for (let i = 0; i < rs.length; i++) if (S_(rs[i][0]) === key) { setCells_('settings', i + 2, 2, [val]); return; }
  appendRow_('settings', [key, val]);
}
function isNum_(v) { return v !== '' && v != null && !isNaN(Number(v)); }
// المسافة بالمتر بين نقطتين (Haversine)
function distMeters_(la1, lo1, la2, lo2) {
  const R = 6371000, toRad = function (d) { return d * Math.PI / 180; };
  const dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
  const a = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function settingsSave_(p) {
  if (p.workLat !== undefined || p.workLng !== undefined) {
    const lat = Number(p.workLat), lng = Number(p.workLng);
    if (!isNum_(p.workLat) || !isNum_(p.workLng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) fail_('إحداثيات غير صحيحة');
    setSetting_('workLat', String(lat)); setSetting_('workLng', String(lng));
  }
  if (p.workRadius !== undefined) {
    const rMeters = parseInt(p.workRadius, 10);
    if (isNaN(rMeters) || rMeters < 10 || rMeters > 5000) fail_('نطاق الموقع يجب أن يكون بين 10 و5000 متر');
    setSetting_('workRadius', String(rMeters));
  }
  if (p.remindInText !== undefined) setSetting_('remindInText', clip_(p.remindInText, 200));
  if (p.remindOutText !== undefined) setSetting_('remindOutText', clip_(p.remindOutText, 200));
  if (p.autoAbsentEnabled !== undefined) setSetting_('autoAbsentEnabled', p.autoAbsentEnabled ? 'نعم' : 'لا');
  if (p.remindersEnabled !== undefined) setSetting_('remindersEnabled', p.remindersEnabled ? 'نعم' : 'لا');
  if (p.ownerName !== undefined) setSetting_('ownerName', clip_(p.ownerName, 60) || 'المدير العام');
  if (p.pushInLead !== undefined) {
    const pl = parseInt(p.pushInLead, 10);
    if (isNaN(pl) || pl < 0 || pl > 120) fail_('وقت التذكير قبل الحضور يجب أن يكون بين 0 و120 دقيقة');
    setSetting_('pushInLead', String(pl));
  }
  ['extraEnabled', 'dutyEnabled', 'dutyReminderEnabled', 'messagesEnabled', 'msgNotifyEnabled', 'manualAll', 'pushEnabled', 'pushAdminReq'].forEach(function (k) {
    if (p[k] !== undefined) setSetting_(k, p[k] ? 'نعم' : 'لا');
  });
  if (p.dutyReminderMinutes !== undefined) {
    const mm = parseInt(p.dutyReminderMinutes, 10);
    if (isNaN(mm) || mm < 0 || mm > 240) fail_('وقت التذكير بالمناوبة يجب أن يكون بين 0 و240 دقيقة');
    setSetting_('dutyReminderMinutes', String(mm));
  }
  if (p.dutyStartText !== undefined) setSetting_('dutyStartText', clip_(p.dutyStartText, 200));
  if (p.dutyEndText !== undefined) setSetting_('dutyEndText', clip_(p.dutyEndText, 200));
}
function on_(key) { return getSetting_(key) !== 'لا'; }

// ---------- الدوام الإضافي: تكليف فرد بفترة في تاريخ محدد (يسمح بالتوقيع في يوم إجازة أو سبت، أو بفترة إضافية) ----------
function extraFromRow_(r, i) { return { row: i + 2, id: S_(r[0]), date: D_(r[1]), sid: S_(r[2]), tid: S_(r[3]), note: S_(r[5]) }; }
function allExtra_() { return rows_('extra').map(extraFromRow_).filter(function (x) { return x.id && x.date && x.tid; }); }
function extraShiftIdsFor_(tid, date) {
  if (!on_('extraEnabled')) return [];
  return allExtra_().filter(function (x) { return x.tid === tid && x.date === date; }).map(function (x) { return x.sid; });
}
function extraSave_(p) {
  const date = S_(p.date);
  if (!isDate_(date)) fail_('تاريخ غير صحيح');
  const sid = S_(p.sid);
  if (sid && !findShift_(sid)) fail_('الفترة غير موجودة');
  const tids = (p.tids || []).map(S_).filter(Boolean);
  if (!tids.length) fail_('اختر فرداً واحداً على الأقل');
  const have = allExtra_();
  tids.forEach(function (tid) {
    const t = findTeacher_(tid);
    if (!t) return;
    if (have.some(function (x) { return x.date === date && x.sid === sid && x.tid === tid; })) return;
    appendRow_('extra', [rid_('x'), date, sid, tid, t.name, clip_(p.note, 200)]);
  });
}
function extraDelete_(p) {
  const rs = rows_('extra').map(extraFromRow_);
  for (let i = 0; i < rs.length; i++) if (rs[i].id === S_(p.id)) { delRow_('extra', rs[i].row); return; }
  fail_('لم يُعثر على هذا التكليف');
}

// ---------- المناوبة: أسبوعية (حسب اليوم) أو ليوم محدد، استقبال في بداية الفترة وانصراف في نهايتها ----------
function dutyDayKey_(v) {
  if (v instanceof Date) return D_(v);
  const x = S_(v);
  if (isDate_(x)) return x;
  const k = DAY_NAMES.indexOf(x);
  if (k >= 0) return String(k);
  return /^[0-6]$/.test(x) ? x : '';
}
function dutyFromRow_(r, i) {
  return { row: i + 2, id: S_(r[0]), day: dutyDayKey_(r[1]), sid: S_(r[2]), type: S_(r[3]) === 'انصراف' ? 'end' : 'start', tid: S_(r[4]), note: S_(r[6]) };
}
function allDuty_() { return rows_('duty').map(dutyFromRow_).filter(function (x) { return x.id && x.day && x.tid; }); }
// تعيين قائمة المناوبين لخانة واحدة (يوم/تاريخ + فترة + نوع): تستبدل القائمة السابقة بالكامل
function dutySet_(p) {
  const day = dutyDayKey_(p.day);
  if (!day) fail_('اختر يوماً أو تاريخاً صحيحاً');
  const sh = findShift_(S_(p.sid));
  if (!sh) fail_('اختر فترة صحيحة');
  const type = p.type === 'end' ? 'end' : 'start';
  const tids = (p.tids || []).map(S_).filter(Boolean);
  const rs = rows_('duty');
  const keep = rs.filter(function (r, i) {
    const d = dutyFromRow_(r, i);
    return !(d.day === day && d.sid === sh.id && d.type === type);
  });
  const dayCell = isDate_(day) ? day : DAY_NAMES[Number(day)];
  const note = clip_(p.note, 200);
  tids.forEach(function (tid) {
    const t = findTeacher_(tid);
    if (t) keep.push([rid_('d'), dayCell, sh.id, type === 'end' ? 'انصراف' : 'استقبال', tid, t.name, note]);
  });
  rewriteRows_('duty', keep);
}
function dutyDelete_(p) {
  const rs = rows_('duty').map(dutyFromRow_);
  for (let i = 0; i < rs.length; i++) if (rs[i].id === S_(p.id)) { delRow_('duty', rs[i].row); return; }
  fail_('لم يُعثر على هذه المناوبة');
}

// ---------- رسائل الإدارة لأفراد محددين ----------
function msgFromRow_(r, i) {
  return { row: i + 2, id: S_(r[0]), tid: S_(r[1]), text: S_(r[3]), from: D_(r[4]), at: S_(r[5]), read: S_(r[6]) === 'نعم', readAt: S_(r[7]), by: S_(r[8]) };
}
function msgSend_(p, s) {
  const text = clip_(p.text, 500);
  if (!text) fail_('اكتب نص الرسالة');
  const from = S_(p.from) || todayStr_();
  if (!isDate_(from)) fail_('تاريخ غير صحيح');
  const tids = (p.tids || []).map(S_).filter(Boolean);
  if (!tids.length) fail_('اختر مستلماً واحداً على الأقل');
  const at = new Date().toISOString();
  let n = 0;
  tids.forEach(function (tid) {
    const t = findTeacher_(tid);
    if (!t) return;
    appendRow_('messages', [rid_('g'), tid, t.name, text, from, at, '', '', (s && s.name) || '']);
    n++;
  });
  return { sent: n };
}
function msgDelete_(p) {
  const rs = rows_('messages').map(msgFromRow_);
  for (let i = 0; i < rs.length; i++) if (rs[i].id === S_(p.id)) { delRow_('messages', rs[i].row); return; }
  fail_('لم يُعثر على الرسالة');
}
function msgRead_(s, p) {
  const rs = rows_('messages').map(msgFromRow_);
  for (let i = 0; i < rs.length; i++) {
    if (rs[i].id === S_(p.id) && rs[i].tid === s.id) {
      if (!rs[i].read) setCells_('messages', rs[i].row, 7, ['نعم', new Date().toISOString()]);
      return;
    }
  }
  fail_('لم يُعثر على الرسالة');
}
// محاولة استخراج الإحداثيات من رابط خرائط جوجل (أفضل مجهود عبر تتبّع التحويلات؛ الإدخال اليدوي يبقى الأساسي والموثوق دائماً)
function resolveMapLink_(p) {
  let url = S_(p.url);
  if (!url) fail_('الصق رابط خرائط جوجل أولاً');
  const texts = [url];
  for (let hop = 0; hop < 4; hop++) {
    let resp;
    try { resp = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true }); }
    catch (e) { break; }
    const headers = resp.getHeaders() || {};
    const loc = headers.Location || headers.location;
    if (!loc) { texts.push(resp.getContentText() || ''); break; }
    texts.push(loc);
    url = loc;
  }
  const m = texts.join(' ').match(/(-?\d{1,3}\.\d+),\+?\s*(-?\d{1,3}\.\d+)/);
  if (!m) fail_('تعذّر استخراج الإحداثيات من هذا الرابط تلقائياً. أدخلهما يدوياً بدل ذلك (خط العرض وخط الطول تجدهما بنسخ الأرقام من رابط خرائط جوجل الكامل).');
  const lat = Number(m[1]), lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) fail_('الإحداثيات المستخرجة غير صحيحة. أدخلهما يدوياً.');
  setSetting_('workLat', String(lat)); setSetting_('workLng', String(lng));
  return { lat: lat, lng: lng };
}

// ---------- الرموز والجلسات ----------
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}
function hashPin_(pin, salt) {
  salt = salt || Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  return salt + '$' + sha_(salt + '|' + pin + '|' + getSecret_());
}
function checkPin_(pin, stored) {
  if (!stored || stored.indexOf('$') < 0) return false;
  return hashPin_(String(pin), stored.split('$')[0]) === stored;
}
function validPin_(pin) { return /^\d{4,8}$/.test(String(pin || '')); }
function hv_(stored) { return sha_(stored).slice(0, 8); }
function sign_(body) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, getSecret_())); }
function makeToken_(role, id, stored) {
  const exp = Date.now() + (role === 'admin' ? ADMIN_SESSION_HOURS * 3600000 : TEACHER_SESSION_DAYS * 86400000);
  const body = [role, id, exp, hv_(stored)].join('|');
  return body + '.' + sign_(body);
}
function session_(token) {
  if (!token || typeof token !== 'string') authFail_();
  const k = token.lastIndexOf('.');
  if (k < 0) authFail_();
  const body = token.slice(0, k);
  if (sign_(body) !== token.slice(k + 1)) authFail_();
  const f = body.split('|');
  if (Number(f[2]) < Date.now()) authFail_();
  if (f[0] === 'admin') {
    if (f[1] === 'admin') {
      const st = getSetting_('adminPin');
      if (!st || hv_(st) !== f[3]) authFail_();
      return { role: 'admin', id: 'admin', name: ownerName_(), owner: true, perms: Object.keys(PERMS) };
    }
    const u = findUser_(f[1]);
    if (!u || !u.active || !u.pin || hv_(u.pin) !== f[3]) authFail_();
    return { role: 'admin', id: u.id, name: u.name, owner: false, perms: u.perms };
  }
  if (f[0] === 'teacher') {
    const t = findTeacher_(f[1]);
    if (!t || !t.active || !t.pin || hv_(t.pin) !== f[3]) authFail_();
    return { role: 'teacher', id: t.id, name: t.name, teacherRole: t.role, kind: t.kind, shiftIds: t.shiftIds };
  }
  authFail_();
}
function guardFails_(key) {
  if (Number(CacheService.getScriptCache().get('f_' + key) || 0) >= MAX_FAILS) fail_('محاولات كثيرة خاطئة. انتظر 15 دقيقة ثم حاول مجدداً.');
}
function addFail_(key) {
  const c = CacheService.getScriptCache();
  c.put('f_' + key, String(Number(c.get('f_' + key) || 0) + 1), LOCK_SECONDS);
}
function clearFails_(key) { CacheService.getScriptCache().remove('f_' + key); }

// ---------- الفترات ----------
function shiftFromRow_(r, i) {
  const g = parseInt(S_(r[4]), 10);
  return { row: i + 2, id: S_(r[0]), name: S_(r[1]), start: T_(r[2]), end: T_(r[3]), grace: isNaN(g) ? 0 : g, reqLoc: S_(r[5]) === 'نعم', manual: S_(r[6]) === 'نعم' };
}
function allShifts_() { return rows_('shifts').map(shiftFromRow_).filter(function (x) { return x.id && x.start && x.end; }); }
function findShift_(id) {
  if (!id) return null;
  const ss = allShifts_();
  for (let i = 0; i < ss.length; i++) if (ss[i].id === id) return ss[i];
  return null;
}
function shiftSave_(p) {
  const name = clip_(p.name, 60), start = S_(p.start), end = S_(p.end);
  if (!name) fail_('اسم الفترة مطلوب');
  if (!isTime_(start) || !isTime_(end)) fail_('وقت غير صحيح');
  if (end <= start) fail_('نهاية الدوام يجب أن تكون بعد بدايته (لا تدعم الفترات الليلية التي تعبر منتصف الليل)');
  let grace = parseInt(p.grace, 10);
  if (isNaN(grace) || grace < 0) grace = 0;
  if (grace > 120) grace = 120;
  const reqLoc = p.reqLoc ? 'نعم' : 'لا', manual = p.manual ? 'نعم' : 'لا';
  if (p.id) {
    const x = findShift_(S_(p.id));
    if (!x) fail_('الفترة غير موجودة');
    setCells_('shifts', x.row, 2, [name, start, end, String(grace), reqLoc, manual]);
  } else {
    appendRow_('shifts', [rid_('s'), name, start, end, String(grace), reqLoc, manual]);
  }
}
function shiftSetFlagAll_(p) {
  const field = p.field === 'reqLoc' ? 6 : p.field === 'manual' ? 7 : 0;
  if (!field) fail_('حقل غير معروف');
  const val = p.value ? 'نعم' : 'لا';
  const rs = rows_('shifts');
  for (let i = 0; i < rs.length; i++) { if (S_(rs[i][0])) setCells_('shifts', i + 2, field, [val]); }
}
function shiftDelete_(p) {
  const x = findShift_(S_(p.id));
  if (!x) fail_('الفترة غير موجودة');
  const used = allTeachers_().filter(function (t) { return t.shiftIds.indexOf(x.id) >= 0; }).length;
  if (used) fail_('لا يمكن حذف فترة مرتبطة بأفراد (' + used + '). انقلهم إلى فترة أخرى أولاً.');
  delRow_('shifts', x.row);
}
function shiftAssign_(p) {
  const x = findShift_(S_(p.shiftId));
  if (!x) fail_('الفترة غير موجودة');
  const chosen = {};
  (p.tids || []).forEach(function (id) { chosen[S_(id)] = true; });
  allTeachers_().forEach(function (t) {
    const has = t.shiftIds.indexOf(x.id) >= 0;
    if (chosen[t.id] && !has) setCells_('teachers', t.row, 8, [t.shiftIds.concat([x.id]).join(',')]);
    else if (!chosen[t.id] && has) setCells_('teachers', t.row, 8, [t.shiftIds.filter(function (i) { return i !== x.id; }).join(',')]);
  });
}

// ---------- الأفراد (معلمون وموظفون) ----------
function parseIds_(v) { return S_(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function kindOf_(v) { return S_(v) === 'موظف' || S_(v) === 'staff' ? 'staff' : 'teacher'; }
function kindCell_(k) { return k === 'staff' ? 'موظف' : 'معلم'; }
function teacherFromRow_(r, i) {
  return { row: i + 2, id: S_(r[0]), name: S_(r[1]), role: S_(r[2]), active: S_(r[3]) !== 'لا', order: Number(S_(r[4])) || 0, pin: S_(r[5]), kind: kindOf_(r[6]), shiftIds: parseIds_(r[7]) };
}
function allTeachers_() { return rows_('teachers').map(teacherFromRow_).filter(function (t) { return t.id; }); }
function findTeacher_(id) {
  const ts = allTeachers_();
  for (let i = 0; i < ts.length; i++) if (ts[i].id === id) return ts[i];
  return null;
}
function publicList_() {
  return allTeachers_().filter(function (t) { return t.active; })
    .sort(function (a, b) { return a.order - b.order; })
    .map(function (t) { return { id: t.id, name: t.name, kind: t.kind, activated: !!t.pin }; });
}
function activate_(p) {
  const t = findTeacher_(S_(p.tid));
  if (!t || !t.active) fail_('الاسم غير موجود');
  if (t.pin) fail_('هذا الحساب مفعّل مسبقاً. اطلب من الإدارة إعادة ضبط الرمز إن نسيته.');
  if (!validPin_(p.pin)) fail_('الرمز يجب أن يكون من 4 إلى 8 أرقام');
  const stored = hashPin_(String(p.pin));
  setCells_('teachers', t.row, 6, [stored]);
  bump_();
  return { ok: true, token: makeToken_('teacher', t.id, stored), role: 'teacher', tid: t.id, name: t.name };
}
function login_(p) {
  const id = S_(p.tid);
  guardFails_(id);
  const t = findTeacher_(id);
  if (!t || !t.active || !t.pin || !checkPin_(p.pin, t.pin)) {
    addFail_(id);
    fail_('الرمز غير صحيح');
  }
  clearFails_(id);
  return { ok: true, token: makeToken_('teacher', t.id, t.pin), role: 'teacher', tid: t.id, name: t.name };
}
// ---------- مستخدمو الإدارة والصلاحيات ----------
function ownerName_() { return getSetting_('ownerName') || 'المدير العام'; }
function userFromRow_(r, i) {
  return { row: i + 2, id: S_(r[0]), name: S_(r[1]), pin: S_(r[2]), perms: S_(r[3]).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return PERMS[x]; }), active: S_(r[4]) !== 'لا', at: S_(r[5]), by: S_(r[6]) };
}
function allUsers_() { return rows_('users').map(userFromRow_).filter(function (u) { return u.id; }); }
function findUser_(id) { const us = allUsers_(); for (let i = 0; i < us.length; i++) if (us[i].id === id) return us[i]; return null; }
function adminList_() {
  return [{ id: 'admin', name: ownerName_() }].concat(allUsers_().filter(function (u) { return u.active && u.pin; }).map(function (u) { return { id: u.id, name: u.name }; }));
}
function adminLogin_(p) {
  const uid = S_(p.uid) || 'admin';
  guardFails_('admin_' + uid);
  let stored = '', name = '';
  if (uid === 'admin') { stored = getSetting_('adminPin'); name = ownerName_(); }
  else { const u = findUser_(uid); if (u && u.active) { stored = u.pin; name = u.name; } }
  if (!stored || !checkPin_(p.pin, stored)) { addFail_('admin_' + uid); fail_('الرمز غير صحيح'); }
  clearFails_('admin_' + uid);
  log_({ name: name }, 'تسجيل دخول الإدارة', '');
  return { ok: true, token: makeToken_('admin', uid, stored), role: 'admin', tid: '', uid: uid, name: name };
}
function can_(s, perm) { return s.role === 'admin' && (s.owner || (s.perms || []).indexOf(perm) >= 0); }
function needPerm_(s, perm) {
  need_(s, 'admin');
  if (perm === 'owner') { if (!s.owner) fail_('هذا الإجراء للمدير العام فقط'); return; }
  if (perm && !can_(s, perm)) fail_('ليس لديك صلاحية: ' + (PERMS[perm] || perm) + '. اطلب من المدير العام منحك إياها.');
}
function userSave_(s, p) {
  const name = clip_(p.name, 60);
  if (!name) fail_('اكتب اسم المستخدم');
  const perms = (p.perms || []).map(S_).filter(function (x) { return PERMS[x]; }).join(',');
  const active = p.active === false ? 'لا' : 'نعم';
  if (p.pin !== undefined && p.pin !== '' && !validPin_(p.pin)) fail_('الرمز يجب أن يكون من 4 إلى 8 أرقام');
  if (p.id) {
    const u = findUser_(S_(p.id));
    if (!u) fail_('المستخدم غير موجود');
    setCells_('users', u.row, 2, [name]);
    if (p.pin) setCells_('users', u.row, 3, [hashPin_(String(p.pin))]);
    setCells_('users', u.row, 4, [perms, active]);
    return { uname: name };
  }
  if (!p.pin) fail_('ضع رمز دخول للمستخدم الجديد (4 إلى 8 أرقام)');
  appendRow_('users', [rid_('u'), name, hashPin_(String(p.pin)), perms, active, new Date().toISOString(), s.name]);
  return { uname: name };
}
function userDelete_(p) {
  const u = findUser_(S_(p.id));
  if (!u) fail_('المستخدم غير موجود');
  delRow_('users', u.row);
  return { uname: u.name };
}
// ---------- سجل التعديلات: من عدّل، ومتى، وماذا ----------
function log_(s, action, details) {
  try { appendRow_('audit', [new Date().toISOString(), (s && s.name) || '', action, clip_(details, 500)]); } catch (e) { /* السجل لا يعطّل العمل الأساسي */ }
}
function audit_(p) {
  const n = Math.min(Math.max(parseInt(p.limit, 10) || 400, 50), 3000);
  return tailRows_('audit', n).map(function (r) { return { at: S_(r[0]), by: S_(r[1]), action: S_(r[2]), details: S_(r[3]) }; }).filter(function (x) { return x.at; }).reverse();
}
function changePin_(s, p) {
  if (!validPin_(p.newPin)) fail_('الرمز الجديد يجب أن يكون من 4 إلى 8 أرقام');
  const stored = hashPin_(String(p.newPin));
  if (s.role === 'admin') {
    guardFails_('admin_' + s.id);
    if (s.owner) {
      if (!checkPin_(p.oldPin, getSetting_('adminPin'))) { addFail_('admin_' + s.id); fail_('الرمز الحالي غير صحيح'); }
      setSetting_('adminPin', stored);
    } else {
      const u = findUser_(s.id);
      if (!u || !checkPin_(p.oldPin, u.pin)) { addFail_('admin_' + s.id); fail_('الرمز الحالي غير صحيح'); }
      setCells_('users', u.row, 3, [stored]);
    }
    log_(s, 'تغيير رمز الدخول', '');
    bump_();
    return { ok: true, token: makeToken_('admin', s.id, stored) };
  }
  guardFails_(s.id);
  const t = findTeacher_(s.id);
  if (!t || !checkPin_(p.oldPin, t.pin)) { addFail_(s.id); fail_('الرمز الحالي غير صحيح'); }
  setCells_('teachers', t.row, 6, [stored]);
  bump_();
  return { ok: true, token: makeToken_('teacher', t.id, stored) };
}
function validShiftIds_(p) {
  let ids = p.shiftIds !== undefined ? p.shiftIds : (p.shiftId ? [p.shiftId] : []);
  if (!Array.isArray(ids)) ids = [];
  const out = [];
  ids.forEach(function (id) {
    id = S_(id);
    if (!id || out.indexOf(id) >= 0) return;
    if (!findShift_(id)) fail_('الفترة غير موجودة');
    out.push(id);
  });
  return out.slice(0, 8);
}
function teacherAdd_(p) {
  const names = (p.names || []).map(function (n) { return clip_(n, 80); }).filter(Boolean).slice(0, 300);
  if (!names.length) fail_('اكتب اسماً واحداً على الأقل');
  const role = clip_(p.role, 80), kind = kindCell_(kindOf_(p.kind)), shiftIds = validShiftIds_(p).join(',');
  const base = Date.now();
  names.forEach(function (n, i) { appendRow_('teachers', [rid_('t'), n, role, 'نعم', String(base + i), '', kind, shiftIds]); });
}
function teacherEdit_(p) {
  const t = findTeacher_(S_(p.id));
  if (!t) fail_('الفرد غير موجود');
  const n = clip_(p.name, 80);
  if (!n) fail_('الاسم مطلوب');
  const shiftIds = validShiftIds_(p).join(',');
  setCells_('teachers', t.row, 2, [n, clip_(p.role, 80)]);
  setCells_('teachers', t.row, 7, [kindCell_(kindOf_(p.kind)), shiftIds]);
}
function teacherActive_(p) {
  const t = findTeacher_(S_(p.id));
  if (!t) fail_('الفرد غير موجود');
  setCells_('teachers', t.row, 4, [p.active ? 'نعم' : 'لا']);
}
function teacherResetPin_(p) {
  const t = findTeacher_(S_(p.id));
  if (!t) fail_('الفرد غير موجود');
  setCells_('teachers', t.row, 6, ['']);
}
function teacherDelete_(p) {
  const t = findTeacher_(S_(p.id));
  if (!t) fail_('الفرد غير موجود');
  let removed = 0;
  if (p.purge) {
    const att = rows_('attendance'), keepA = att.filter(function (r) { return S_(r[0]) !== t.id; });
    removed = att.length - keepA.length;
    if (removed) rewriteRows_('attendance', keepA);
    const rq = rows_('requests'), keepR = rq.filter(function (r) { return S_(r[1]) !== t.id; });
    if (rq.length !== keepR.length) rewriteRows_('requests', keepR);
  }
  [['extra', 3], ['duty', 4], ['messages', 1]].forEach(function (x) {
    const rr = rows_(x[0]), kk = rr.filter(function (r) { return S_(r[x[1]]) !== t.id; });
    if (rr.length !== kk.length) rewriteRows_(x[0], kk);
  });
  delRow_('teachers', t.row);
  return { removed: removed };
}

// ---------- الحضور ----------
// البحث عن سجل فترة معيّنة لفرد في يوم (مع دعم السجلات القديمة التي لا تحمل معرّف الفترة)
function attFind_(rs, tid, date, sid, sh) {
  for (let i = 0; i < rs.length; i++) {
    if (S_(rs[i][0]) !== tid || D_(rs[i][2]) !== date) continue;
    const rsid = S_(rs[i][15]);
    if (rsid === sid) return i;
    if (!rsid && sh && T_(rs[i][12]) === sh.start && T_(rs[i][13]) === sh.end) return i;
  }
  return -1;
}
function shiftsOf_(ids) {
  return allShifts_().filter(function (x) { return ids.indexOf(x.id) >= 0; })
    .sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
}
function holidayOn_(date) {
  const rs = rows_('holidays');
  for (let i = 0; i < rs.length; i++) if (D_(rs[i][0]) === date) return S_(rs[i][1]) || 'إجازة';
  return '';
}
function shiftCells_(sh) {
  return sh ? [sh.name, sh.start, sh.end, String(sh.grace)] : ['', '', '', ''];
}
function minsOf_(hm) { const p = hm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function splitTimes_(v) { return S_(v).split(',').map(function (x) { return x.trim(); }).filter(isTime_); }
function splitIso_(v) { return S_(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
// عدد الاستئذانات المعتمدة اليوم التي تغطي هذه الفترة. كل استئذان معتمد يمنح فرصة عودة واحدة (خروج ثم دخول) لتلك الفترة.
function approvedLeaveCount_(tid, date, sh) {
  const rs = rows_('requests');
  let n = 0;
  for (let i = 0; i < rs.length; i++) {
    const r = reqFromRow_(rs[i], i);
    if (r.tid !== tid || r.type !== 'leave' || r.status !== 'approved' || r.from !== date) continue;
    if (!sh) { n++; continue; }
    if (!r.tf && !r.tt) { n++; continue; }
    const lf = r.tf || '00:00', lt = r.tt || '23:59';
    if (lf < sh.end && lt > sh.start) n++;
  }
  return n;
}
// اختيار الفترة المناسبة عندما لا يحددها العميل: سجل مفتوح أولاً، ثم أقرب فترة لم تُسجَّل
function suggestSid_(rs, tid, date, shifts, hm) {
  const left = [];
  for (let k = 0; k < shifts.length; k++) {
    const sh = shifts[k], i = attFind_(rs, tid, date, sh.id, sh);
    if (i >= 0) {
      const inL = splitTimes_(rs[i][4]), outL = splitTimes_(rs[i][5]);
      if (inL.length > outL.length) return sh.id;
      if (!inL.length) left.push(sh);
    } else left.push(sh);
  }
  if (!left.length) return shifts[0].id;
  const now = minsOf_(hm);
  const dist = function (sh) { const a = minsOf_(sh.start), b = minsOf_(sh.end); return now < a ? a - now : now > b ? now - b : 0; };
  left.sort(function (x, y) { return dist(x) - dist(y) || (x.start < y.start ? -1 : 1); });
  return left[0].id;
}
function minsOf_(hm) { const p = hm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
// التسجيل اليدوي: متاح للجميع ولكل الفترات عند تفعيل «manualAll» (الافتراضي)، وإلا للفترات المفعّل فيها فقط.
// الوقت يجب أن يكون ضمن حدود الفترة، ولا يتجاوز الوقت الحالي (لا يمكن تسجيل وقت في المستقبل).
function manualTimeAllowed_(sh, hm, nowHm) {
  if (!on_('manualAll') && !(sh && sh.manual)) fail_('التسجيل اليدوي غير مفعّل لهذه الفترة');
  if (!isTime_(hm)) fail_('وقت غير صحيح');
  if (sh && (hm < sh.start || hm > sh.end)) fail_('الوقت اليدوي يجب أن يكون ضمن حدود الفترة (' + sh.start + ' – ' + sh.end + ')');
  if (nowHm && hm > nowHm) fail_('لا يمكن تسجيل وقت لم يحن بعد (الساعة الآن ' + nowHm + ')');
}
function checkLocation_(sh, loc) {
  if (!sh || !sh.reqLoc) return;
  const lat = Number(getSetting_('workLat')), lng = Number(getSetting_('workLng')), radius = Number(getSetting_('workRadius')) || 200;
  if (!loc || !isNum_(loc.lat) || !isNum_(loc.lng)) fail_('هذه الفترة تتطلب تفعيل الموقع (GPS) عند التسجيل. فعّل صلاحية الموقع للمتصفح وحاول مرة أخرى.');
  const d = distMeters_(lat, lng, Number(loc.lat), Number(loc.lng));
  if (d > radius) fail_('أنت خارج نطاق موقع العمل (تبعد ' + Math.round(d) + ' متراً، والمسموح ' + radius + ' متراً). اقترب من موقع العمل وحاول مرة أخرى.');
}
function punch_(s, method, shiftId, loc, manualTime) {
  const now = new Date();
  const date = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const realIso = now.toISOString();
  let hm = Utilities.formatDate(now, TZ, 'HH:mm');
  const m = method === 'bio' ? 'رمز + بصمة الجوال' : 'رمز';
  // فترات اليوم: في يوم الدوام = فتراته المعتادة + أي فترة إضافية مكلّف بها اليوم؛ في يوم الإجازة أو السبت = المكلّف به فقط
  const extraIds = extraShiftIdsFor_(s.id, date);
  const offDay = !isWorkday_(date) || !!holidayOn_(date);
  if (offDay && !extraIds.length) fail_(isWorkday_(date) ? 'اليوم إجازة رسمية' : 'اليوم خارج أيام الدوام (الأحد إلى الخميس)');
  const baseIds = offDay ? [] : (s.shiftIds || []);
  const shifts = shiftsOf_(baseIds.concat(extraIds.filter(function (x) { return x && baseIds.indexOf(x) < 0; })));
  const rs = rows_('attendance');
  let sid = '', sh = null;
  if (shifts.length) {
    sid = S_(shiftId) || suggestSid_(rs, s.id, date, shifts, hm);
    sh = shifts.filter(function (x) { return x.id === sid; })[0] || null;
    if (!sh) fail_('هذه الفترة غير مخصصة لك اليوم');
  }
  checkLocation_(sh, loc);
  if (manualTime) { manualTimeAllowed_(sh, S_(manualTime), hm); hm = S_(manualTime); }
  // من لديه أكثر من فترة: لا يُقبل تسجيل حضور (أو عودة) فترته إلا ضمن وقتها المحدد، ولا يُطبَّق هذا على الانصراف
  const strict = shifts.length > 1 && sh;
  const checkWindow = function () {
    if (!strict) return;
    const now2 = minsOf_(hm), lo = minsOf_(sh.start) - MULTI_EARLY, hi = minsOf_(sh.end) + MULTI_LATE;
    if (now2 < lo || now2 > hi) fail_('فترة "' + sh.name + '" من ' + sh.start + ' إلى ' + sh.end + '. لا يمكن تسجيل الحضور فيها الآن (' + hm + ').');
  };
  const i = attFind_(rs, s.id, date, sid, sh);
  const day = DAY_NAMES[dow_(date)];
  const sc = shiftCells_(sh);
  const tag = { kind: null, hm: hm, shiftName: sh ? sh.name : '' };
  if (i < 0) {
    checkWindow();
    appendRow_('attendance', [s.id, s.name, date, day, hm, '', realIso, '', m + (manualTime ? ' (يدوي)' : ''), '', ''].concat(sc, [sid]));
    tag.kind = 'in';
    return tag;
  }
  const r = rs[i], row = i + 2;
  const inL = splitTimes_(r[4]), outL = splitTimes_(r[5]);
  const inAtL = splitIso_(r[6]), outAtL = splitIso_(r[7]);
  const fixSnap = function () { if (sh && (!S_(r[12]) || !S_(r[15]))) setCells_('attendance', row, 12, sc.concat([sid])); };
  if (inL.length > outL.length) {
    // فترة مفتوحة: الانصراف مسموح في أي وقت (لا يخضع للنافذة الصارمة)
    const lastInAt = inAtL.length ? new Date(inAtL[inAtL.length - 1]).getTime() : 0;
    if (lastInAt && now.getTime() - lastInAt < MIN_OUT_GAP_MS) fail_('تم تسجيل حضورك قبل قليل. انتظر دقيقتين ثم سجّل الانصراف.');
    outL.push(hm); outAtL.push(realIso);
    setCells_('attendance', row, 6, [outL.join(',')]);
    setCells_('attendance', row, 8, [outAtL.join(',')]);
    if (manualTime) setCells_('attendance', row, 9, [m + ' (يدوي)']);
    fixSnap();
    tag.kind = 'out';
    return tag;
  }
  if (inL.length > 0) {
    // الفترة مغلقة: كل استئذان معتمد اليوم لهذه الفترة يمنح فرصة عودة واحدة إضافية
    const allowed = 1 + approvedLeaveCount_(s.id, date, sh);
    if (inL.length >= allowed) fail_(sh ? 'سجّلت الحضور والانصراف لهذه الفترة، ولا يوجد استئذان معتمد إضافي يسمح بالعودة' : 'سجّلت الحضور والانصراف لهذا اليوم');
    const lastOutAt = outAtL.length ? new Date(outAtL[outAtL.length - 1]).getTime() : 0;
    if (lastOutAt && now.getTime() - lastOutAt < MIN_OUT_GAP_MS) fail_('تم تسجيل انصرافك قبل قليل. انتظر دقيقتين ثم سجّل العودة.');
  }
  checkWindow();
  inL.push(hm); inAtL.push(realIso);
  setCells_('attendance', row, 5, [inL.join(',')]);
  setCells_('attendance', row, 7, [inAtL.join(',')]);
  if (manualTime) setCells_('attendance', row, 9, [m + ' (يدوي)']);
  fixSnap();
  tag.kind = 'in';
  return tag;
}
// تعديل الإدارة ليوم: قائمة فترات، كل فترة {sid, in, out}. إن تُركت الخانتان فارغتين يُحذف سجل تلك الفترة.
function dayEdit_(p, s) {
  const by = (s && s.name) || '', at = new Date().toISOString();
  const t = findTeacher_(S_(p.tid));
  if (!t) fail_('الفرد غير موجود');
  const date = S_(p.date);
  if (!isDate_(date)) fail_('تاريخ غير صحيح');
  const per = (p.periods || []).slice(0, 10);
  if (!per.length) fail_('لا توجد فترات للتعديل');
  per.forEach(function (x) {
    const a = S_(x.in), b = S_(x.out);
    if ((a && !isTime_(a)) || (b && !isTime_(b))) fail_('وقت غير صحيح');
    if (a && b && b <= a) fail_('الانصراف يجب أن يكون بعد الحضور');
  });
  const note = clip_(p.note, 200);
  const rs = rows_('attendance');
  const del = [];
  per.forEach(function (x) {
    const a = S_(x.in), b = S_(x.out), sid = S_(x.sid);
    const sh = sid ? findShift_(sid) : null;
    if (sid && !sh) fail_('الفترة غير موجودة');
    const i = attFind_(rs, t.id, date, sid, sh);
    if (i >= 0) {
      if (!a && !b) { del.push(i + 2); return; }
      setCells_('attendance', i + 2, 5, [a, b]);
      setCells_('attendance', i + 2, 9, ['تعديل الإدارة', 'نعم', note]);
      setCells_('attendance', i + 2, 17, [by, at]);
      if (!S_(rs[i][12]) || !S_(rs[i][15])) setCells_('attendance', i + 2, 12, shiftCells_(sh).concat([sid]));
    } else if (a || b) {
      appendRow_('attendance', [t.id, t.name, date, DAY_NAMES[dow_(date)], a, b, '', '', 'تعديل الإدارة', 'نعم', note].concat(shiftCells_(sh), [sid, by, at]));
    }
  });
  del.sort(function (x, y) { return y - x; }).forEach(function (row) { delRow_('attendance', row); });
}
function dayDel_(p) {
  const rs = rows_('attendance'), del = [];
  for (let i = 0; i < rs.length; i++) if (S_(rs[i][0]) === S_(p.tid) && D_(rs[i][2]) === S_(p.date)) del.push(i + 2);
  del.sort(function (x, y) { return y - x; }).forEach(function (row) { delRow_('attendance', row); });
}
// حذف سجلات الحضور لفترة (لفرد أو للجميع)
function attDelete_(p) {
  const from = S_(p.from), to = S_(p.to), tid = S_(p.tid) || 'all';
  if (!isDate_(from) || !isDate_(to) || to < from) fail_('حدد فترة صحيحة');
  const rs = rows_('attendance');
  const keep = rs.filter(function (r) {
    const d = D_(r[2]);
    const hit = d && d >= from && d <= to && (tid === 'all' || S_(r[0]) === tid);
    return !hit;
  });
  const n = rs.length - keep.length;
  if (n) rewriteRows_('attendance', keep);
  return { removed: n };
}

// ---------- الإجازات ----------
function holAdd_(p) {
  const d = S_(p.date);
  if (!isDate_(d)) fail_('تاريخ غير صحيح');
  const rs = rows_('holidays');
  for (let i = 0; i < rs.length; i++) if (D_(rs[i][0]) === d) { setCells_('holidays', i + 2, 2, [clip_(p.name, 80)]); return; }
  appendRow_('holidays', [d, clip_(p.name, 80)]);
}
function holDel_(p) {
  const rs = rows_('holidays');
  for (let i = 0; i < rs.length; i++) if (D_(rs[i][0]) === S_(p.date)) { delRow_('holidays', i + 2); return; }
}

// ---------- الطلبات ----------
function reqFromRow_(r, i) {
  return { row: i + 2, id: S_(r[0]), tid: S_(r[1]), type: S_(r[3]), from: D_(r[4]), to: D_(r[5]), tf: T_(r[6]), tt: T_(r[7]), reason: S_(r[8]), at: S_(r[9]), status: S_(r[10]) || 'pending', note: S_(r[11]), decAt: S_(r[12]), decBy: S_(r[13]) };
}
function reqCreate_(s, p) {
  const type = p.type === 'absence' ? 'absence' : p.type === 'leave' ? 'leave' : '';
  if (!type) fail_('نوع الطلب غير صحيح');
  const from = S_(p.from);
  if (!isDate_(from)) fail_('حدد التاريخ');
  let to = from, tf = '', tt = '';
  if (type === 'absence') {
    to = S_(p.to) || from;
    if (!isDate_(to) || to < from) fail_('تاريخ النهاية غير صحيح');
  } else {
    tf = S_(p.tf); tt = S_(p.tt);
    if ((tf && !isTime_(tf)) || (tt && !isTime_(tt))) fail_('وقت غير صحيح');
    if (tf && tt && tt <= tf) fail_('وقت النهاية يجب أن يكون بعد البداية');
  }
  const reason = clip_(p.reason, 300);
  if (!reason) fail_('اكتب السبب');
  appendRow_('requests', [rid_('r'), s.id, s.name, type, from, to, tf, tt, reason, new Date().toISOString(), 'pending', '', '']);
}
function reqCancel_(s, p) {
  const rs = rows_('requests').map(reqFromRow_);
  for (let i = 0; i < rs.length; i++) {
    if (rs[i].id === S_(p.id) && rs[i].tid === s.id) {
      if (rs[i].status !== 'pending') fail_('صدر قرار في هذا الطلب');
      delRow_('requests', rs[i].row);
      return;
    }
  }
  fail_('الطلب غير موجود');
}
function reqDelete_(p) {
  const rs = rows_('requests').map(reqFromRow_);
  for (let i = 0; i < rs.length; i++) {
    if (rs[i].id === S_(p.id)) { delRow_('requests', rs[i].row); return; }
  }
  fail_('الطلب غير موجود');
}
function setDecision_(id, status, note, by) {
  const rs = rows_('requests').map(reqFromRow_);
  for (let i = 0; i < rs.length; i++) {
    if (rs[i].id === S_(id)) {
      setCells_('requests', rs[i].row, 11, [status, clip_(note, 200), status === 'pending' ? '' : new Date().toISOString(), status === 'pending' ? '' : (by || '')]);
      return;
    }
  }
  fail_('الطلب غير موجود');
}
function decide_(s, p) {
  if (p.status !== 'approved' && p.status !== 'rejected') fail_('قرار غير صحيح');
  setDecision_(p.id, p.status, p.note, s.name);
}

// ---------- الحالة المرسلة للصفحة ----------
function state_(s) {
  const st = { today: todayStr_(), ver: getVer_(), role: s.role, holidays: {}, shifts: {},
    settings: { workLat: getSetting_('workLat'), workLng: getSetting_('workLng'), workRadius: getSetting_('workRadius'), remindInText: getSetting_('remindInText'), remindOutText: getSetting_('remindOutText'), autoAbsentEnabled: getSetting_('autoAbsentEnabled') !== 'لا', remindersEnabled: getSetting_('remindersEnabled') !== 'لا',
      extraEnabled: on_('extraEnabled'), dutyEnabled: on_('dutyEnabled'), dutyReminderEnabled: on_('dutyReminderEnabled'),
      dutyReminderMinutes: parseInt(getSetting_('dutyReminderMinutes'), 10) || 0, dutyStartText: getSetting_('dutyStartText'), dutyEndText: getSetting_('dutyEndText'),
      messagesEnabled: on_('messagesEnabled'), msgNotifyEnabled: on_('msgNotifyEnabled'), manualAll: on_('manualAll'), ownerName: ownerName_(),
      pushEnabled: on_('pushEnabled'), pushAdminReq: on_('pushAdminReq'), pushInLead: parseInt(getSetting_('pushInLead'), 10) || 0 } };
  const mine = function (x) { return s.role === 'admin' || x.tid === s.id; };
  st.extra = allExtra_().filter(mine).map(function (x) { return { id: x.id, date: x.date, sid: x.sid, tid: x.tid, note: x.note }; });
  st.duty = allDuty_().filter(mine).map(function (x) { return { id: x.id, day: x.day, sid: x.sid, type: x.type, tid: x.tid, note: x.note }; });
  const today0 = todayStr_();
  const msgs = rows_('messages').map(msgFromRow_).filter(function (m) { return m.id && mine(m) && (s.role === 'admin' || !m.from || m.from <= today0); });
  msgs.sort(function (a, b) { return b.at < a.at ? -1 : b.at > a.at ? 1 : 0; });
  st.messages = msgs.slice(0, 200).map(function (m) { return { id: m.id, tid: m.tid, text: m.text, from: m.from, at: m.at, read: m.read, readAt: m.readAt, by: m.by }; });
  holRows_().forEach(function (h) { st.holidays[h[0]] = h[1]; });
  allShifts_().forEach(function (x) { st.shifts[x.id] = { name: x.name, start: x.start, end: x.end, grace: x.grace, reqLoc: x.reqLoc, manual: x.manual }; });
  const att = {};
  rows_('attendance').forEach(function (r) {
    const tid = S_(r[0]), d = D_(r[2]);
    if (!tid || !d) return;
    if (s.role === 'teacher' && tid !== s.id) return;
    const o = { sid: S_(r[15]), i: S_(r[4]), o: S_(r[5]), a: S_(r[9]) === 'نعم' ? 1 : 0, n: S_(r[10]) };
    if (o.a && S_(r[16])) { o.by = S_(r[16]); o.at = S_(r[17]); }
    const ss = T_(r[12]), se = T_(r[13]);
    if (ss && se) { o.ss = ss; o.se = se; o.sg = parseInt(S_(r[14]), 10) || 0; o.sn = S_(r[11]); }
    const byDay = (att[tid] = att[tid] || {});
    (byDay[d] = byDay[d] || []).push(o);
  });
  st.att = att;
  if (s.role === 'teacher') {
    st.me = { id: s.id, name: s.name, role: s.teacherRole || '', kind: s.kind, shiftIds: s.shiftIds || [] };
    st.requests = rows_('requests').map(reqFromRow_).filter(function (r) { return r.tid === s.id; }).map(pubReq_);
  } else {
    st.teachers = {};
    allTeachers_().forEach(function (t) { st.teachers[t.id] = { name: t.name, role: t.role, active: t.active, order: t.order, activated: !!t.pin, kind: t.kind, shiftIds: t.shiftIds }; });
    st.requests = rows_('requests').map(reqFromRow_).filter(function (r) { return r.id; }).map(pubReq_);
    st.sheetUrl = MEMO.ss ? MEMO.ss.getUrl() : ss_().getUrl();
    st.admin = { id: s.id, name: s.name, owner: !!s.owner, perms: s.perms || [] };
    st.permNames = PERMS;
    if (s.owner) st.users = allUsers_().map(function (u) { return { id: u.id, name: u.name, perms: u.perms, active: u.active, hasPin: !!u.pin, at: u.at, by: u.by }; });
  }
  return st;
}
function holRows_() { return rows_('holidays').map(function (r) { return [D_(r[0]), S_(r[1])]; }).filter(function (h) { return h[0]; }); }
function pubReq_(r) { return { id: r.id, tid: r.tid, type: r.type, from: r.from, to: r.to, tf: r.tf, tt: r.tt, reason: r.reason, at: r.at, status: r.status, note: r.note, decAt: r.decAt, decBy: r.decBy }; }
// ============================================================
//  إشعارات الجوال (Web Push) — تصل حتى لو كان الجهاز مقفلاً أو التطبيق مغلقاً
//  تنفيذ كامل لمعايير RFC 8291 (تشفير الرسالة) وRFC 8292 (توقيع VAPID) داخل Apps Script
// ============================================================
const PUSH_CONTACT = 'mailto:attendance@ibn-taymiyyah.app';
const P256 = (function () {
  if (typeof BigInt === 'undefined') return null;
  const p = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  const n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  const b = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');
  const G = [BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')];
  const md = function (a, m) { const r = a % m; return r < 0n ? r + m : r; };
  const pw = function (a, e, m) { let r = 1n; a = md(a, m); while (e > 0n) { if (e & 1n) r = r * a % m; a = a * a % m; e >>= 1n; } return r; };
  const inv = function (a, m) { return pw(a, m - 2n, m); };
  // نقاط بإحداثيات جاكوبي [X,Y,Z] لتجنّب القسمة في كل خطوة
  function dbl(P) {
    if (P === null) return null;
    const X = P[0], Y = P[1], Z = P[2];
    if (Y === 0n) return null;
    const ZZ = Z * Z % p, M = md(3n * (X - ZZ) * (X + ZZ), p), YY = Y * Y % p, S = 4n * X * YY % p;
    const X3 = md(M * M - 2n * S, p), Y3 = md(M * (S - X3) - 8n * YY * YY, p), Z3 = 2n * Y * Z % p;
    return [X3, Y3, Z3];
  }
  function add(P, Q) {
    if (P === null) return Q; if (Q === null) return P;
    const Z1Z1 = P[2] * P[2] % p, Z2Z2 = Q[2] * Q[2] % p;
    const U1 = P[0] * Z2Z2 % p, U2 = Q[0] * Z1Z1 % p, S1 = P[1] * Q[2] % p * Z2Z2 % p, S2 = Q[1] * P[2] % p * Z1Z1 % p;
    if (U1 === U2) return S1 === S2 ? dbl(P) : null;
    const H = md(U2 - U1, p), R = md(S2 - S1, p), HH = H * H % p, HHH = H * HH % p, V = U1 * HH % p;
    const X3 = md(R * R - HHH - 2n * V, p), Y3 = md(R * (V - X3) - S1 * HHH, p), Z3 = P[2] * Q[2] % p * H % p;
    return [X3, Y3, Z3];
  }
  function mul(k, A) {
    let R = null, Q = [A[0], A[1], 1n];
    while (k > 0n) { if (k & 1n) R = add(R, Q); Q = dbl(Q); k >>= 1n; }
    if (R === null) throw new Error('نقطة غير صالحة');
    const zi = inv(R[2], p), zi2 = zi * zi % p;
    return [R[0] * zi2 % p, R[1] * zi2 % p * zi % p];
  }
  function onCurve(P) { return md(P[1] * P[1] - (P[0] * P[0] * P[0] - 3n * P[0] + b), p) === 0n; }
  return { p: p, n: n, G: G, mul: mul, inv: inv, md: md, onCurve: onCurve };
})();
function u8_(a) { const o = new Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] & 255; return o; }
function s8_(a) { return a.map(function (x) { x &= 255; return x > 127 ? x - 256 : x; }); }
function utf8_(s) { return u8_(Utilities.newBlob(s).getBytes()); }
function cat_() { let o = []; for (let i = 0; i < arguments.length; i++) o = o.concat(arguments[i]); return o; }
function big_(a) { let x = 0n; for (let i = 0; i < a.length; i++) x = (x << 8n) | BigInt(a[i]); return x; }
function bytes_(x, len) { const o = new Array(len); for (let i = len - 1; i >= 0; i--) { o[i] = Number(x & 255n); x >>= 8n; } return o; }
function b64u_(a) { return Utilities.base64EncodeWebSafe(s8_(a)).replace(/=+$/, ''); }
function unb64u_(s) { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return u8_(Utilities.base64Decode(s)); }
function hmac_(key, data) { return u8_(Utilities.computeHmacSha256Signature(s8_(data), s8_(key))); }
function sha256_(data) { return u8_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8_(data))); }
function rand_(len) { let o = []; while (o.length < len) o = o.concat(sha256_(utf8_(Utilities.getUuid() + Utilities.getUuid() + Date.now()))); return o.slice(0, len); }
function randScalar_() { let k = 0n; while (k <= 0n || k >= P256.n) k = big_(rand_(32)); return k; }
function pubBytes_(P) { return cat_([4], bytes_(P[0], 32), bytes_(P[1], 32)); }
function hkdf_(salt, ikm, info, len) { const prk = hmac_(salt, ikm); return hmac_(prk, cat_(info, [1])).slice(0, len); }
// ---------- AES-128 (تشفير فقط) + GCM ----------
const AES_ = (function () {
  const S = [], X2 = function (a) { return ((a << 1) ^ (a & 128 ? 0x11b : 0)) & 255; };
  let pp = 1, q = 1;
  do { pp = pp ^ X2(pp); q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 255; if (q & 128) q ^= 0x09; const x = q ^ ((q << 1) | (q >> 7)) & 255 ^ ((q << 2) | (q >> 6)) & 255 ^ ((q << 3) | (q >> 5)) & 255 ^ ((q << 4) | (q >> 4)) & 255; S[pp] = (x ^ 0x63) & 255; } while (pp !== 1);
  S[0] = 0x63;
  function expand(key) {
    const w = key.slice(), rc = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
    for (let i = 16; i < 176; i += 4) {
      let t = w.slice(i - 4, i);
      if (i % 16 === 0) { t = [S[t[1]] ^ rc[i / 16 - 1], S[t[2]], S[t[3]], S[t[0]]]; }
      for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
    }
    return w;
  }
  function block(w, inp) {
    let s = inp.map(function (x, i) { return x ^ w[i]; });
    for (let r = 1; r <= 10; r++) {
      const t = new Array(16);
      for (let c = 0; c < 4; c++) for (let rw = 0; rw < 4; rw++) t[c * 4 + rw] = S[s[((c + rw) % 4) * 4 + rw]];
      if (r < 10) for (let c = 0; c < 4; c++) {
        const a0 = t[c * 4], a1 = t[c * 4 + 1], a2 = t[c * 4 + 2], a3 = t[c * 4 + 3];
        t[c * 4] = X2(a0) ^ X2(a1) ^ a1 ^ a2 ^ a3; t[c * 4 + 1] = a0 ^ X2(a1) ^ X2(a2) ^ a2 ^ a3;
        t[c * 4 + 2] = a0 ^ a1 ^ X2(a2) ^ X2(a3) ^ a3; t[c * 4 + 3] = X2(a0) ^ a0 ^ a1 ^ a2 ^ X2(a3);
      }
      s = t.map(function (x, i) { return x ^ w[r * 16 + i]; });
    }
    return s;
  }
  function gmul(X, Y) {
    const R = BigInt('0xe1') << 120n; let Z = 0n, V = Y;
    for (let i = 127; i >= 0; i--) { if ((X >> BigInt(i)) & 1n) Z ^= V; V = (V & 1n) ? (V >> 1n) ^ R : V >> 1n; }
    return Z;
  }
  function gcm(key, iv, pt) {
    const w = expand(key), H = big_(block(w, new Array(16).fill(0)));
    const ctr = function (i) { return cat_(iv, bytes_(BigInt(i), 4)); };
    const ct = [];
    for (let i = 0; i < pt.length; i += 16) {
      const ks = block(w, ctr(i / 16 + 2)), chunk = pt.slice(i, i + 16);
      for (let j = 0; j < chunk.length; j++) ct.push(chunk[j] ^ ks[j]);
    }
    let Y = 0n;
    for (let i = 0; i < ct.length; i += 16) { const c = ct.slice(i, i + 16); while (c.length < 16) c.push(0); Y = gmul(Y ^ big_(c), H); }
    Y = gmul(Y ^ ((0n << 64n) | BigInt(ct.length * 8)), H);
    const tag = bytes_(Y ^ big_(block(w, ctr(1))), 16);
    return ct.concat(tag);
  }
  return { gcm: gcm, block: block, expand: expand };
})();
// ---------- مفاتيح VAPID (تُنشأ مرة واحدة وتُحفظ في خصائص السكربت) ----------
function vapid_() {
  if (!P256) fail_('بيئة Apps Script لا تدعم الإشعارات (BigInt غير متاح)');
  const pr = props_();
  let d = pr.getProperty('VAPID_D'), pub = pr.getProperty('VAPID_PUB');
  if (!d || !pub) {
    const k = randScalar_();
    d = b64u_(bytes_(k, 32)); pub = b64u_(pubBytes_(P256.mul(k, P256.G)));
    pr.setProperty('VAPID_D', d); pr.setProperty('VAPID_PUB', pub);
  }
  return { d: big_(unb64u_(d)), pub: pub };
}
function es256_(d, msgBytes) {
  const z = big_(sha256_(msgBytes)) % P256.n;
  for (;;) {
    const k = randScalar_(), R = P256.mul(k, P256.G), r = R[0] % P256.n;
    if (r === 0n) continue;
    const s = P256.md(P256.inv(k, P256.n) * (z + r * d), P256.n);
    if (s === 0n) continue;
    return cat_(bytes_(r, 32), bytes_(s, 32));
  }
}
function vapidAuth_(endpoint) {
  const aud = endpoint.match(/^https?:\/\/[^\/]+/)[0], v = vapid_();
  const ck = 'vj_' + sha256_(utf8_(aud + v.pub)).slice(0, 8).join('');
  const cache = CacheService.getScriptCache(), hit = cache.get(ck);
  if (hit) return hit;
  const head = b64u_(utf8_(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u_(utf8_(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_CONTACT })));
  const sig = b64u_(es256_(v.d, utf8_(head + '.' + body)));
  const val = 'vapid t=' + head + '.' + body + '.' + sig + ', k=' + v.pub;
  cache.put(ck, val, 6 * 3600);
  return val;
}
// تشفير محتوى الإشعار لجهاز مشترك (RFC 8291 — aes128gcm)
function encryptPush_(sub, payloadStr, eph) {
  const ua = unb64u_(sub.p256dh), auth = unb64u_(sub.auth);
  const Q = [big_(ua.slice(1, 33)), big_(ua.slice(33, 65))];
  if (ua.length !== 65 || !P256.onCurve(Q)) fail_('مفتاح الجهاز غير صالح');
  const shared = bytes_(P256.mul(eph.k, Q)[0], 32);
  const ikm = hkdf_(auth, shared, cat_(utf8_('WebPush: info'), [0], ua, eph.pub), 32);
  const salt = rand_(16), prk = hmac_(salt, ikm);
  const cek = hmac_(prk, cat_(utf8_('Content-Encoding: aes128gcm'), [0, 1])).slice(0, 16);
  const nonce = hmac_(prk, cat_(utf8_('Content-Encoding: nonce'), [0, 1])).slice(0, 12);
  const ct = AES_.gcm(cek, nonce, cat_(utf8_(payloadStr), [2]));
  return cat_(salt, [0, 0, 16, 0], [65], eph.pub, ct);
}
function ephemeral_() { const k = randScalar_(); return { k: k, pub: pubBytes_(P256.mul(k, P256.G)) }; }

// ---------- اشتراكات الأجهزة ----------
function subFromRow_(r, i) { return { row: i + 2, role: S_(r[0]) === 'إدارة' ? 'admin' : 'teacher', id: S_(r[1]), name: S_(r[2]), endpoint: S_(r[3]), p256dh: S_(r[4]), auth: S_(r[5]) }; }
function allSubs_() { return rows_('subs').map(subFromRow_).filter(function (x) { return x.endpoint && x.p256dh && x.auth; }); }
function validEndpoint_(u) { return /^https:\/\/[a-z0-9.\-]+(:\d+)?\/\S+$/i.test(u) && u.length < 1200; }
function pushSub_(s, p) {
  const ep = S_(p.endpoint), k = S_(p.p256dh), au = S_(p.auth);
  if (!validEndpoint_(ep) || !/^[A-Za-z0-9_\-]{80,100}$/.test(k) || !/^[A-Za-z0-9_\-]{16,30}$/.test(au)) fail_('بيانات الاشتراك غير صحيحة');
  // الجهاز الواحد يمكن أن يحمل اشتراكاً للفرد وآخر للإدارة؛ يُستبدل اشتراك نفس الدور فقط
  const rs = rows_('subs').map(subFromRow_);
  for (let i = rs.length - 1; i >= 0; i--) if (rs[i].endpoint === ep && rs[i].role === s.role) delRow_('subs', rs[i].row);
  appendRow_('subs', [s.role === 'admin' ? 'إدارة' : 'فرد', s.id, s.name || '', ep, k, au, clip_(p.ua, 120), new Date().toISOString()]);
  ensurePushTrigger_();
  return { pushOn: true };
}
function pushUnsub_(s, p) {
  const ep = S_(p.endpoint);
  const rs = rows_('subs').map(subFromRow_);
  for (let i = rs.length - 1; i >= 0; i--) if (rs[i].endpoint === ep && rs[i].role === s.role) delRow_('subs', rs[i].row);
}
// تثبيت المؤقت الذي يفحص المواعيد كل 5 دقائق ويرسل التذكيرات (مرة واحدة)
function ensurePushTrigger_() {
  try {
    const pr = props_();
    if (pr.getProperty('PUSH_TRIGGER') === 'ok') return true;
    const has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'pushTick'; });
    if (!has) ScriptApp.newTrigger('pushTick').timeBased().everyMinutes(5).create();
    pr.setProperty('PUSH_TRIGGER', 'ok');
    return true;
  } catch (e) { console.warn('trigger: ' + (e && e.message)); return false; }
}
// إرسال إشعار إلى مجموعة اشتراكات دفعة واحدة؛ الاشتراكات المنتهية تُحذف تلقائياً
let PUSH_EPH = null;
function sendPush_(subs, msgFor) {
  if (!subs.length || !P256) return 0;
  if (!PUSH_EPH) PUSH_EPH = ephemeral_();
  const reqs = [], used = [];
  subs.forEach(function (sub) {
    const m = msgFor(sub);
    if (!m) return;
    try {
      const body = encryptPush_(sub, JSON.stringify(m), PUSH_EPH);
      reqs.push({ url: sub.endpoint, method: 'post', muteHttpExceptions: true, contentType: 'application/octet-stream', payload: s8_(body),
        headers: { Authorization: vapidAuth_(sub.endpoint), 'Content-Encoding': 'aes128gcm', TTL: String(m.ttl || 3600), Urgency: 'high'} });
      used.push(sub);
    } catch (e) { console.warn('push enc: ' + e.message); }
  });
  if (!reqs.length) return 0;
  let res = [];
  try { res = UrlFetchApp.fetchAll(reqs); } catch (e) { console.warn('push fetch: ' + e.message); return 0; }
  let ok = 0; const gone = [];
  res.forEach(function (r, i) {
    const c = r.getResponseCode();
    if (c >= 200 && c < 300) ok++;
    else if (c === 404 || c === 410) gone.push(used[i].endpoint);
    else console.warn('push ' + c + ': ' + String(r.getContentText()).slice(0, 200));
  });
  if (gone.length) {
    const rs = rows_('subs').map(subFromRow_);
    for (let i = rs.length - 1; i >= 0; i--) if (gone.indexOf(rs[i].endpoint) >= 0) delRow_('subs', rs[i].row);
  }
  return ok;
}
function pushTo_(role, ids, msg) {
  try {
    if (!on_('pushEnabled')) return 0;
    const subs = allSubs_().filter(function (x) { return x.role === role && (ids === null || ids.indexOf(x.id) >= 0); });
    return sendPush_(subs, function () { return msg; });
  } catch (e) { console.warn('pushTo: ' + e.message); return 0; }
}
// مستخدمو الإدارة الذين يملكون صلاحية الطلبات (والمدير العام)
function reqAdminIds_() {
  const ids = ['admin'];
  allUsers_().forEach(function (u) { if (u.active && (u.perms || []).indexOf('req') >= 0) ids.push(u.id); });
  return ids;
}
function notifyNewRequest_(s, p) {
  if (!on_('pushAdminReq')) return;
  const kind = p.type === 'absence' ? 'غياب' : 'استئذان';
  pushTo_('admin', reqAdminIds_(), { title: 'طلب ' + kind + ' جديد', body: (s.name || '') + ' — ' + S_(p.from) + (p.reason ? ' — ' + clip_(p.reason, 80) : ''), tag: 'req', url: './' });
}
function notifyMessages_(p) {
  if (!on_('messagesEnabled') || !on_('msgNotifyEnabled')) return;
  const from = S_(p.from) || todayStr_();
  if (from > todayStr_()) return;   // الرسائل المؤجلة تُرسل في يومها عبر المؤقت
  pushTo_('teacher', (p.tids || []).map(S_), { title: 'رسالة من الإدارة', body: clip_(p.text, 180), tag: 'msg', url: './' });
}
function pushTest_(s, p) {
  const ep = S_(p.endpoint);
  const sub = allSubs_().filter(function (x) { return x.endpoint === ep && x.role === s.role; })[0];
  if (!sub) fail_('هذا الجهاز غير مشترك في التنبيهات بعد');
  const n = sendPush_([sub], function () { return { title: 'تجربة التنبيه', body: 'التنبيهات تعمل على هذا الجهاز ✓ ستصلك التذكيرات حتى لو كان الجوال مقفلاً.', tag: 'test', url: './' }; });
  if (!n) fail_('تعذّر إرسال التنبيه التجريبي. أعد تفعيل التنبيهات على هذا الجهاز.');
  return { sent: n };
}

// ---------- المؤقت: يعمل كل 5 دقائق ويرسل التذكيرات المستحقة ----------
function pushTick() {
  resetMemo_();
  PUSH_EPH = null;
  const now = new Date(), hm = Utilities.formatDate(now, TZ, 'HH:mm'), date = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  if (hm < '04:30') return 'خارج الوقت';
  if (!on_('pushEnabled')) return 'الإشعارات موقوفة';
  const subs = allSubs_().filter(function (x) { return x.role === 'teacher'; });
  if (!subs.length) return 'لا أجهزة مشتركة';
  const due = pushDue_(date, hm, subs.map(function (x) { return x.id; }));
  const cache = CacheService.getScriptCache();
  const todo = due.filter(function (d) { return !cache.get(d.key); });
  if (!todo.length) return 'لا تذكيرات';
  const byTid = {};
  todo.forEach(function (d) { (byTid[d.tid] = byTid[d.tid] || []).push(d); });
  // كل جهاز يتلقى إشعاراً واحداً لكل تذكير مستحق
  let sent = 0;
  todo.forEach(function (d) {
    sent += sendPush_(subs.filter(function (x) { return x.id === d.tid; }), function () { return d.msg; });
    cache.put(d.key, '1', 21600);
  });
  return 'أُرسل ' + sent;
}
// حساب التذكيرات المستحقة الآن لأفراد محددين (دالة مستقلة لسهولة الاختبار)
function pushDue_(date, hm, tids) {
  const out = [], nowM = minsOf_(hm), uniq = {};
  tids.forEach(function (t) { uniq[t] = 1; });
  const offDay = !isWorkday_(date) || !!holidayOn_(date);
  const lead = Math.max(0, parseInt(getSetting_('pushInLead'), 10) || 0);
  const remOn = on_('remindersEnabled'), dutyOn = on_('dutyEnabled') && on_('dutyReminderEnabled');
  const dutyLead = parseInt(getSetting_('dutyReminderMinutes'), 10) || 0;
  const inText = getSetting_('remindInText') || 'لا تنسَ تسجيل حضورك', outText = getSetting_('remindOutText') || 'لا تنسَ تسجيل انصرافك';
  const att = rows_('attendance'), reqs = rows_('requests').map(reqFromRow_);
  const dutyAll = dutyOn ? allDuty_() : [], dow = String(dow_(date));
  const msgs = (on_('messagesEnabled') && on_('msgNotifyEnabled')) ? rows_('messages').map(msgFromRow_) : [];
  Object.keys(uniq).forEach(function (tid) {
    const t = findTeacher_(tid);
    if (!t || !t.active) return;
    const absent = reqs.some(function (r) { return r.tid === tid && r.type === 'absence' && r.status === 'approved' && r.from <= date && r.to >= date; });
    const extraIds = extraShiftIdsFor_(tid, date);
    const baseIds = offDay ? [] : (t.shiftIds || []);
    const shifts = shiftsOf_(baseIds.concat(extraIds.filter(function (x) { return x && baseIds.indexOf(x) < 0; })));
    if (remOn && !absent) shifts.forEach(function (sh) {
      const i = attFind_(att, tid, date, sh.id, sh);
      const inL = i >= 0 ? splitTimes_(att[i][4]) : [], outL = i >= 0 ? splitTimes_(att[i][5]) : [];
      const a = minsOf_(sh.start), b = minsOf_(sh.end);
      // تذكير الحضور: قبل بداية الفترة بالمدة المحددة وحتى ساعة بعد بدايتها، ما لم يسجّل
      if (!inL.length && nowM >= a - lead && nowM <= Math.min(b, a + 60))
        out.push({ tid: tid, key: 'pi_' + tid + date + sh.id, msg: { title: 'تذكير الحضور — ' + sh.name, body: inText + ' (تبدأ ' + sh.name + ' الساعة ' + t12_(sh.start) + ')', tag: 'in' + sh.id, url: './', ttl: 3600 } });
      // تذكير الانصراف: عند نهاية الفترة إن كان الحضور مفتوحاً
      if (inL.length > outL.length && nowM >= b && nowM <= b + 90)
        out.push({ tid: tid, key: 'po_' + tid + date + sh.id, msg: { title: 'تذكير الانصراف — ' + sh.name, body: outText, tag: 'out' + sh.id, url: './', ttl: 3600 } });
    });
    dutyAll.forEach(function (d) {
      if (d.tid !== tid || (d.day !== date && d.day !== dow)) return;
      if (d.day === dow && offDay && extraIds.indexOf(d.sid) < 0) return;
      const sh = findShift_(d.sid);
      if (!sh) return;
      const tm = d.type === 'end' ? sh.end : sh.start, at = minsOf_(tm);
      if (nowM < at - dutyLead || nowM > at + 15) return;
      const txt = S_(getSetting_(d.type === 'end' ? 'dutyEndText' : 'dutyStartText')).replace(/\{الفترة\}/g, sh.name).replace(/\{الوقت\}/g, t12_(tm)) || 'لديك مناوبة اليوم';
      out.push({ tid: tid, key: 'pd_' + d.id + date, msg: { title: 'تذكير بالمناوبة', body: txt, tag: 'duty' + d.id, url: './', ttl: 3600 } });
    });
    // رسائل مؤجلة حلّ يومها ولم تُقرأ
    msgs.forEach(function (m) {
      if (m.tid !== tid || m.read || !m.from || m.from !== date || m.at.slice(0, 10) >= date) return;
      if (hm < '06:00') return;
      out.push({ tid: tid, key: 'pm_' + m.id, msg: { title: 'رسالة من الإدارة', body: clip_(m.text, 180), tag: 'msg', url: './', ttl: 43200 } });
    });
  });
  return out;
}
function t12_(hm) {
  const p = String(hm).split(':'), h = Number(p[0]);
  return ((h % 12) || 12) + ':' + p[1] + (h < 12 ? ' ص' : ' م');
}
// تُشغَّل يدوياً من المحرر عند الحاجة: تثبيت مؤقت التذكيرات وإنشاء مفاتيح الإشعار
function installReminders() {
  props_().deleteProperty('PUSH_TRIGGER');
  resetMemo_();
  vapid_();
  return ensurePushTrigger_() ? 'تم تفعيل مؤقت التذكيرات (كل 5 دقائق).' : 'تعذّر تثبيت المؤقت — امنح الصلاحية ثم أعد التشغيل.';
}
/*CORE-END*/
