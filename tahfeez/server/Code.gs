/**
 * خادم «منصة متابعة الحلقات» — Google Sheets + Apps Script
 * جمعية تعلم للقرآن وعلومه (فرع الخبر والدمام) — مجمع ابن تيمية القرآني
 *
 * طريقة التركيب (مرة واحدة):
 * 1) أنشئ Google Sheet جديداً (يفضل من حساب المجمع) ثم: الإضافات ← Apps Script
 * 2) الصق هذا الملف كاملاً مكان Code.gs واحفظ
 * 3) شغّل الدالة setup مرة واحدة ووافق على الصلاحيات
 * 4) نشر ← نشر جديد ← تطبيق ويب: التنفيذ بصفتي، الوصول: أي شخص
 * 5) انسخ رابط الويب (ينتهي بـ /exec) والصقه في التطبيق: الإعدادات ← الربط بالخادم
 *
 * عند تحديث هذا الملف لاحقاً: نشر ← إدارة عمليات النشر ← تعديل ← إصدار جديد (حتى لا يتغير الرابط)
 */

var TABLES = {
  students: ['id', 'name', 'status', 'classId', 'guardianName', 'guardianPhone', 'updatedAt', 'json'],
  classes:  ['id', 'name', 'teacherId', 'track', 'updatedAt', 'json'],
  users:    ['id', 'name', 'username', 'role', 'active', 'updatedAt', 'json'],
  records:  ['id', 'studentId', 'classId', 'date', 'updatedAt', 'json'],
  payments: ['id', 'studentId', 'date', 'amount', 'updatedAt', 'json'],
  invites:  ['id', 'phone', 'name', 'sentAt', 'updatedAt', 'json'],
  settings: ['id', 'updatedAt', 'json']
};
var SECRET_FIELDS = ['passHash'];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABLES).forEach(function (t) { sheet_(t); });
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1');
  if (s1 && ss.getSheets().length > 1) { try { ss.deleteSheet(s1); } catch (e) {} }
  return 'تم التجهيز';
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, TABLES[name].length).setValues([TABLES[name]]).setFontWeight('bold').setBackground('#0f5c55').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}

function readAll_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var cols = TABLES[name];
  var ji = cols.indexOf('json');
  var vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i][ji];
    if (!raw) continue;
    try { var o = JSON.parse(raw); o._row = i + 2; out.push(o); } catch (e) {}
  }
  return out;
}

function upsert_(name, rows) {
  var sh = sheet_(name);
  var cols = TABLES[name];
  var last = sh.getLastRow();
  var ids = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var appends = [];
  rows.forEach(function (o) {
    if (!o || !o.id) return;
    delete o._row;
    if (!o.updatedAt) o.updatedAt = Date.now();
    var line = cols.map(function (c) {
      if (c === 'json') return JSON.stringify(o);
      var v = o[c];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    var idx = ids.indexOf(String(o.id));
    if (idx >= 0) sh.getRange(idx + 2, 1, 1, cols.length).setValues([line]);
    else { appends.push(line); ids.push(String(o.id)); }
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, cols.length).setValues(appends);
}

function stripSecrets_(list) {
  return list.map(function (o) {
    var c = {}; for (var k in o) if (SECRET_FIELDS.indexOf(k) < 0 && k !== '_row') c[k] = o[k]; return c;
  });
}

function hash_(s) {
  var salt = PropertiesService.getScriptProperties().getProperty('SALT');
  if (!salt) { salt = Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty('SALT', salt); }
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + s, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ ok: true, app: 'tahfeez', time: Date.now() });
}

function doPost(e) {
  var req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'طلب غير صالح' }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    return json_(route_(req));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function settings_() {
  var s = readAll_('settings').filter(function (x) { return x.id === 'main'; })[0];
  return s || { id: 'main' };
}

function session_(token) {
  if (!token) return null;
  var uid = PropertiesService.getScriptProperties().getProperty('S_' + token);
  if (!uid) return null;
  var u = readAll_('users').filter(function (x) { return x.id === uid && x.active !== false; })[0];
  return u || null;
}

function route_(r) {
  var a = r.action;

  // ——— عام (بدون دخول) ———
  if (a === 'ping') return { ok: true, hasUsers: readAll_('users').length > 0 };

  if (a === 'bootstrap') { // إنشاء أول مدير ونقل البيانات المحلية
    if (readAll_('users').length > 0) return { ok: false, error: 'يوجد مستخدمون مسبقاً، سجّل الدخول' };
    var admin = r.admin;
    admin.passHash = hash_(admin.password); delete admin.password;
    admin.role = 'admin'; admin.active = true;
    upsert_('users', [admin]);
    if (r.data) Object.keys(r.data).forEach(function (t) {
      if (TABLES[t] && t !== 'users' && r.data[t] && r.data[t].length) upsert_(t, r.data[t]);
    });
    var tok = Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty('S_' + tok, admin.id);
    return { ok: true, token: tok, user: stripSecrets_([admin])[0] };
  }

  if (a === 'login') {
    var u = readAll_('users').filter(function (x) { return String(x.username).trim() === String(r.username).trim() && x.active !== false; })[0];
    if (!u || u.passHash !== hash_(r.password)) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    var t = Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty('S_' + t, u.id);
    return { ok: true, token: t, user: stripSecrets_([u])[0] };
  }

  if (a === 'regInfo') {
    var st = settings_();
    return { ok: true, settings: publicSettings_(st), classes: readAll_('classes').map(function (c) { return { id: c.id, name: c.name, track: c.track }; }) };
  }

  if (a === 'register') {
    var st2 = settings_();
    if (st2.regClosed) return { ok: false, error: 'التسجيل مغلق حالياً' };
    var f = r.student || {};
    if (!f.name || !f.guardianPhone) return { ok: false, error: 'الاسم وجوال ولي الأمر مطلوبان' };
    var dup = readAll_('students').filter(function (x) { return x.idNumber && f.idNumber && String(x.idNumber) === String(f.idNumber); })[0];
    if (dup) return { ok: false, error: 'هذا الطالب مسجل مسبقاً (رقم السجل مكرر)' };
    f.id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    f.status = 'pending';
    f.source = 'form';
    f.parentToken = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    f.createdAt = Date.now(); f.updatedAt = Date.now();
    upsert_('students', [f]);
    return { ok: true, id: f.id };
  }

  if (a === 'parent') { // صفحة الطالب لولي الأمر
    var stu = readAll_('students').filter(function (x) { return x.parentToken && x.parentToken === r.t; })[0];
    if (!stu) return { ok: false, error: 'الرابط غير صحيح أو منتهي' };
    var cls = readAll_('classes').filter(function (c) { return c.id === stu.classId; })[0] || null;
    var users = readAll_('users');
    var teacher = cls ? users.filter(function (u) { return u.id === cls.teacherId; })[0] : null;
    var allRecs = readAll_('records');
    var recs = allRecs.filter(function (x) { return x.studentId === stu.id; });
    var mates = readAll_('students').filter(function (x) { return x.classId === stu.classId && x.status === 'active'; }).map(function (x) { return { id: x.id, name: x.name }; });
    var mateRecs = allRecs.filter(function (x) { return x.classId === stu.classId; }).map(function (x) { return { studentId: x.studentId, date: x.date, hifz: x.hifz ? { pages: x.hifz.pages, grade: x.hifz.grade } : null, review: x.review ? { pages: x.review.pages, grade: x.review.grade } : null, att: x.att, noor: x.noor ? { grade: x.noor.grade } : null, zad: x.zad ? x.zad.map(function (z) { return { grade: z.grade }; }) : null }; });
    var st3 = settings_();
    var pays = st3.parentShowFees === false ? [] : readAll_('payments').filter(function (p) { return p.studentId === stu.id; });
    var safe = {}; for (var k in stu) if (['idNumber', 'guardianId', 'parentToken', '_row'].indexOf(k) < 0) safe[k] = stu[k];
    return { ok: true, student: safe, cls: cls, teacher: teacher ? { name: teacher.name, phone: teacher.phone } : null,
      records: recs, payments: pays, mates: mates, mateRecords: mateRecs, settings: publicSettings_(st3) };
  }

  // ——— يتطلب دخولاً ———
  var me = session_(r.token);
  if (!me) return { ok: false, error: 'انتهت الجلسة، سجّل الدخول من جديد', auth: false };

  if (a === 'sync') {
    var data = {};
    Object.keys(TABLES).forEach(function (t) { data[t] = stripSecrets_(readAll_(t)); });
    if (me.role === 'teacher') { // المعلم يرى فصوله فقط
      var my = data.classes.filter(function (c) { return c.teacherId === me.id || (c.teacherIds || []).indexOf(me.id) >= 0; }).map(function (c) { return c.id; });
      data.students = data.students.filter(function (s) { return my.indexOf(s.classId) >= 0; });
      data.records = data.records.filter(function (x) { return my.indexOf(x.classId) >= 0; });
      data.payments = []; data.invites = [];
      data.users = data.users.map(function (u) { return { id: u.id, name: u.name, role: u.role }; });
      data.settings = data.settings.map(function (x) { var c = {}; for (var k in x) if (k !== 'waToken' && k !== 'waInstance') c[k] = x[k]; return c; });
    }
    return { ok: true, data: data, me: stripSecrets_([me])[0], time: Date.now() };
  }

  if (a === 'save') {
    if (!TABLES[r.table]) return { ok: false, error: 'جدول غير معروف' };
    if (me.role === 'teacher' && ['records', 'students'].indexOf(r.table) < 0) return { ok: false, error: 'لا تملك الصلاحية' };
    var rows = r.rows || [];
    if (r.table === 'users') {
      if (me.role !== 'admin') return { ok: false, error: 'للمدير فقط' };
      var old = readAll_('users');
      rows.forEach(function (u) {
        var o = old.filter(function (x) { return x.id === u.id; })[0];
        if (u.password) { u.passHash = hash_(u.password); delete u.password; }
        else if (o) u.passHash = o.passHash;
      });
    }
    upsert_(r.table, rows);
    return { ok: true, time: Date.now() };
  }

  if (a === 'del') {
    if (me.role === 'teacher' && r.table !== 'records') return { ok: false, error: 'لا تملك الصلاحية' };
    var sh = sheet_(r.table);
    var last = sh.getLastRow();
    if (last >= 2) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues().map(function (x) { return String(x[0]); });
      for (var i = ids.length - 1; i >= 0; i--) if ((r.ids || []).indexOf(ids[i]) >= 0) sh.deleteRow(i + 2);
    }
    return { ok: true };
  }

  if (a === 'sendWA') { // إرسال تلقائي عبر مزود واتساب (اختياري)
    var st4 = settings_();
    var inst = PropertiesService.getScriptProperties().getProperty('WA_INSTANCE') || st4.waInstance;
    var tk = PropertiesService.getScriptProperties().getProperty('WA_TOKEN') || st4.waToken;
    if (!inst || !tk) return { ok: false, error: 'لم يتم إعداد مزود الواتساب' };
    var results = [];
    (r.messages || []).forEach(function (m) {
      try {
        var resp = UrlFetchApp.fetch('https://api.ultramsg.com/' + inst + '/messages/chat', {
          method: 'post', muteHttpExceptions: true,
          payload: { token: tk, to: m.to, body: m.body }
        });
        results.push({ to: m.to, ok: resp.getResponseCode() === 200, res: resp.getContentText().slice(0, 200) });
        Utilities.sleep(1200);
      } catch (err) { results.push({ to: m.to, ok: false, res: String(err) }); }
    });
    return { ok: true, results: results };
  }

  return { ok: false, error: 'إجراء غير معروف' };
}

function publicSettings_(s) {
  var keys = ['orgName', 'branchName', 'complexName', 'programName', 'supervisor', 'logoRight', 'logoLeft', 'regClosed', 'regNote',
    'gradeLabels', 'workDays', 'zad', 'features', 'parentShowFees', 'feeDefault', 'currency', 'phone', 'regFields'];
  var o = {}; keys.forEach(function (k) { if (s[k] !== undefined) o[k] = s[k]; });
  return o;
}
