/**
 * مصروفات مجمع ابن تيمية — الخادم (Google Apps Script)
 * ------------------------------------------------------------
 * يُحمَّل هذا الملف تلقائياً من GitHub عبر Loader.gs، فأي تعديل يُرفع هنا
 * يصل للبرنامج خلال 10 دقائق دون نشر جديد.
 *
 * البيانات كلها في جدول جوجل الذي يحتوي السكربت، وصور الفواتير في مجلد على Google Drive.
 * لتغيير عناوين أعمدة الكشف عدّل العمود الثاني في INV بالأسفل (لا تغيّر المفاتيح الإنجليزية).
 */

// ---------- إعدادات عامة ----------
const TZ = 'Asia/Riyadh';
const SESSION_DAYS = 7;          // مدة بقاء المستخدم مسجّلاً
const MAX_FAILS = 6;             // محاولات الدخول الخاطئة قبل القفل المؤقت
const LOCK_SECONDS = 900;        // مدة القفل 15 دقيقة
const FOLDER_NAME = 'مصروفات مجمع ابن تيمية - صور الفواتير';

const KIND = { TAX: 'ضريبية', NOTAX: 'بدون ضريبة', PAPER: 'ورقة مكتوبة' };
const STATUS = { OK: 'سليمة', DUP: 'مكررة', REVIEW: 'تحتاج مراجعة' };

// أعمدة ورقة الفواتير — الأعمدة الثمانية الأولى بترتيب الكشف المعتمد
const INV = [
  ['total', 'المبلغ'],
  ['category', 'التصنيف'],
  ['description', 'بيان الصرف'],
  ['vendor', 'اسم المؤسسة (عملية شراء إن وجد)'],
  ['number', 'رقم الفاتورة'],
  ['date', 'تاريخ الفاتورة'],
  ['image', 'الفاتورة'],
  ['code', 'الرمز'],
  ['subtotal', 'المبلغ قبل الضريبة'],
  ['vat', 'الضريبة'],
  ['vat_no', 'الرقم الضريبي للمورد'],
  ['kind', 'نوع المستند'],
  ['status', 'الحالة'],
  ['dup_of', 'مكررة من (الرمز)'],
  ['notes', 'ملاحظات'],
  ['file_url', 'رابط الصورة'],
  ['file_id', 'معرّف الملف'],
  ['file_hash', 'بصمة الملف'],
  ['mime', 'نوع الملف'],
  ['created_by', 'أدخلها'],
  ['created_at', 'وقت الإدخال'],
  ['updated_by', 'آخر تعديل بواسطة'],
  ['updated_at', 'وقت آخر تعديل'],
  ['not_dup', 'أُكِّد أنها غير مكررة'],
  ['deleted', 'محذوفة'],
  ['id', 'المعرّف']
];
const INV_KEYS = INV.map(function (c) { return c[0]; });
const NUM_KEYS = ['total', 'subtotal', 'vat'];
const EDITABLE = ['total', 'category', 'description', 'vendor', 'number', 'date', 'code', 'subtotal', 'vat', 'vat_no', 'kind', 'notes'];

const USERS_COLS = ['المعرّف', 'الاسم', 'اسم الدخول', 'كلمة المرور (مشفّرة)', 'الحالة', 'مدير', 'إضافة', 'تعديل', 'حذف', 'الكشوف', 'وقت الطلب', 'وافق عليه', 'وقت الموافقة', 'آخر دخول'];
const PERMS = ['admin', 'add', 'edit', 'delete', 'reports'];
const U_ACTIVE = 'مفعّل', U_PENDING = 'بانتظار الموافقة', U_STOPPED = 'موقوف';

const SHEETS = {
  inv: { name: 'الفواتير', cols: INV.map(function (c) { return c[1]; }) },
  users: { name: 'المستخدمون', cols: USERS_COLS },
  log: { name: 'السجل', cols: ['الوقت', 'المستخدم', 'العملية', 'الرمز', 'معرّف الفاتورة', 'التفاصيل'] },
  settings: { name: 'الإعدادات', cols: ['المفتاح', 'القيمة'] }
};

// القيم الافتراضية للإعدادات (تُعدَّل من أيقونة الإعدادات في البرنامج)
const DEFAULTS = {
  appName: 'مصروفات مجمع ابن تيمية',
  orgRight: 'جمعية تعلّم للقرآن وعلومه - فرع الخبر والدمام',
  orgLeft: 'مجمع ابن تيمية القرآني',
  reportTitle: 'مصروفات مجمع ابن تيمية',
  categories: 'دعاية وإعلام\nضيافة ونثرية\nتصوير وقرطاسية\nمكافئة\nأدوات\nحوافز\nصيانة\nراتب العامل',
  vatRate: '15',
  currency: 'ريال',
  codePrefix: '',
  aiEnabled: 'نعم',
  aiProvider: 'تلقائي',            // تلقائي = Claude إن وُجد مفتاحه، وإلا Gemini
  claudeModel: 'claude-sonnet-5-5',
  aiModel: 'gemini-flash-latest',
  dupHash: 'نعم',
  dupNumber: 'نعم',
  dupAmount: 'نعم',
  allowRegister: 'نعم',
  signatures: 'المحاسب\nالمشرف المالي\nمدير المجمع',
  reportFooter: '',
  dateMode: 'ميلادي',
  logoRight: '',
  logoLeft: ''
};
const SECRET_KEYS = ['geminiKey', 'claudeKey'];

// =====================================================================
//  نقاط الدخول
// =====================================================================
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: getSetting_('appName'), msg: 'خادم المصروفات يعمل. افتح الواجهة من رابط GitHub Pages.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { req = {}; }
  return ContentService.createTextOutput(JSON.stringify(api(req))).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  MEMO = {};
  const ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SSID', ss.getId());
  try { ss.setActiveSheet(ss.getSheets()[0]); } catch (e) { }
  Object.keys(SHEETS).forEach(function (k) { sheet_(k); });
  Object.keys(DEFAULTS).forEach(function (k) { if (getSetting_(k) === null) setSetting_(k, DEFAULTS[k]); });
  secret_();
  folder_();
  formatInvSheet_();
  return 'تم التجهيز. عدد المستخدمين: ' + users_().length;
}

// يعيد تفعيل حساب المدير الأول ويضع كلمة مرور مؤقتة (للطوارئ عند نسيان كلمة المرور)
function resetAdmin() {
  MEMO = {};
  const list = users_();
  const a = list.filter(function (u) { return u.perms.admin; })[0];
  if (!a) return 'لا يوجد مدير بعد — افتح البرنامج وأنشئ حساب المدير.';
  const pw = String(Math.floor(100000 + Math.random() * 900000));
  setUserCells_(a.row, { pass: hashPass_(pw), status: U_ACTIVE });
  CacheService.getScriptCache().remove('fail_' + a.username.toLowerCase());
  return 'اسم الدخول: ' + a.username + ' | كلمة المرور المؤقتة: ' + pw + ' — غيّرها بعد الدخول.';
}

function api(req) {
  MEMO = {};
  try {
    const a = String(req.action || '');
    const pub = { boot: boot_, firstAdmin: firstAdmin_, login: login_, register: register_ };
    if (pub[a]) return { ok: true, data: pub[a](req) };
    const me = auth_(req.token);
    const R = ROUTES[a];
    if (!R) throw new Error('عملية غير معروفة: ' + a);
    if (R.perm && !can_(me, R.perm)) throw new Error('ليست لديك صلاحية لهذه العملية');
    return { ok: true, data: R.fn(req, me) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), auth: !!(e && e.auth) };
  }
}

const ROUTES = {
  me: { fn: function (r, me) { return publicUser_(me); } },
  changePassword: { fn: changePassword_ },
  list: { fn: listInvoices_ },
  add: { perm: 'add', fn: addInvoice_ },
  update: { perm: 'edit', fn: updateInvoice_ },
  reread: { perm: 'edit', fn: rereadInvoice_ },
  setNotDup: { perm: 'edit', fn: setNotDup_ },
  remove: { perm: 'delete', fn: removeInvoice_ },
  history: { fn: invoiceHistory_ },
  fileData: { fn: fileData_ },
  log: { perm: 'admin', fn: readLog_ },
  getSettings: { fn: getSettingsApi_ },
  saveSettings: { perm: 'admin', fn: saveSettingsApi_ },
  testAi: { perm: 'admin', fn: testAi_ },
  users: { perm: 'admin', fn: function () { return users_().map(publicUser_); } },
  saveUser: { perm: 'admin', fn: saveUser_ },
  deleteUser: { perm: 'admin', fn: deleteUser_ },
  links: { perm: 'admin', fn: function () { return { sheet: ss_().getUrl(), folder: folder_().getUrl() }; } }
};

// =====================================================================
//  الجدول والأوراق
// =====================================================================
let MEMO = {};
function ss_() {
  if (MEMO.ss) return MEMO.ss;
  let s = SpreadsheetApp.getActiveSpreadsheet();
  if (!s) {
    const id = PropertiesService.getScriptProperties().getProperty('SSID');
    if (!id) throw new Error('افتح السكربت من داخل جدول جوجل: الإضافات > Apps Script ثم شغّل setup');
    s = SpreadsheetApp.openById(id);
  }
  return (MEMO.ss = s);
}
function sheet_(k) {
  const key = 'sh_' + k;
  if (MEMO[key]) return MEMO[key];
  const def = SHEETS[k];
  const s = ss_();
  let sh = s.getSheetByName(def.name);
  if (!sh) {
    // نحدد موضع الورقة الجديدة صراحةً حتى لا يعتمد الإدراج على «الورقة النشطة» (قد تكون محذوفة)
    try { sh = s.insertSheet(def.name, s.getSheets().length); }
    catch (e) { s.setActiveSheet(s.getSheets()[0]); sh = s.insertSheet(def.name, s.getSheets().length); }
    sh.setRightToLeft(true);
  }
  const n = def.cols.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  const head = sh.getRange(1, 1, 1, n).getValues()[0];
  if (head.join('|') !== def.cols.join('|')) {
    sh.getRange(1, 1, 1, n).setValues([def.cols]).setFontWeight('bold').setBackground('#d9ead3').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  }
  return (MEMO[key] = sh);
}
function formatInvSheet_() {
  const sh = sheet_('inv');
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  const col = function (k) { return INV_KEYS.indexOf(k) + 1; };
  ['date', 'number', 'code', 'vat_no', 'file_hash', 'id', 'created_at', 'updated_at'].forEach(function (k) { sh.getRange(2, col(k), rows, 1).setNumberFormat('@'); });
  NUM_KEYS.forEach(function (k) { sh.getRange(2, col(k), rows, 1).setNumberFormat('#,##0.00'); });
  sh.setColumnWidth(col('image'), 140);
  sh.setColumnWidth(col('category'), 160);
  sh.setColumnWidth(col('description'), 220);
  sh.setColumnWidth(col('vendor'), 220);
  try {
    const cats = String(getSetting_('categories') || '').split('\n').map(function (s) { return s.trim(); }).filter(String);
    if (cats.length) sh.getRange(2, col('category'), rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(cats, true).setAllowInvalid(true).build());
  } catch (e) { }
}

function readAll_(k) {
  const sh = sheet_(k);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, SHEETS[k].cols.length).getValues();
}
function ensureRow_(sh, row) {
  const max = sh.getMaxRows();
  if (row > max) sh.insertRowsAfter(max, Math.max(row - max, 200));
}
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}
function num_(v) {
  if (v === '' || v == null) return '';
  let s = String(v).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
  s = s.replace(/٫/g, '.').replace(/[٬,\s]/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(s);
  return isFinite(n) && s !== '' ? Math.round(n * 100) / 100 : '';
}

// =====================================================================
//  الإعدادات
// =====================================================================
function settingsMap_() {
  if (MEMO.settings) return MEMO.settings;
  const m = {};
  readAll_('settings').forEach(function (r, i) { if (r[0]) m[String(r[0])] = { v: String(r[1]), row: i + 2 }; });
  return (MEMO.settings = m);
}
function getSetting_(k) {
  const m = settingsMap_();
  return m[k] ? m[k].v : null;
}
function setSetting_(k, v) {
  const m = settingsMap_();
  const sh = sheet_('settings');
  v = String(v == null ? '' : v);
  if (v.length > 49000) throw new Error('قيمة الإعداد كبيرة جداً: ' + k);
  if (m[k]) sh.getRange(m[k].row, 2).setNumberFormat('@').setValue(v);
  else {
    sh.appendRow([k, '']);
    const row = sh.getLastRow();
    sh.getRange(row, 2).setNumberFormat('@').setValue(v);
    m[k] = { row: row };
  }
  m[k].v = v;
}
function S_(k) { const v = getSetting_(k); return v === null ? (DEFAULTS[k] || '') : v; }
function yes_(k) { return S_(k) === 'نعم'; }
function categories_() { return S_('categories').split('\n').map(function (s) { return s.trim(); }).filter(String); }

function publicSettings_() {
  const o = {};
  Object.keys(DEFAULTS).forEach(function (k) { o[k] = S_(k); });
  return o;
}
function getSettingsApi_(r, me) {
  const o = publicSettings_();
  if (can_(me, 'admin')) {
    SECRET_KEYS.forEach(function (n) {
      const key = PropertiesService.getScriptProperties().getProperty(n) || '';
      o[n + 'Set'] = !!key;
      o[n + 'Hint'] = key ? key.slice(0, 7) + '••••' + key.slice(-4) : '';
    });
    o.aiActive = provider_();
  }
  return o;
}
function saveSettingsApi_(r, me) {
  const s = r.settings || {};
  const changed = [];
  Object.keys(s).forEach(function (k) {
    if (SECRET_KEYS.indexOf(k) >= 0) {
      const v = String(s[k] || '').trim();
      if (v === '__clear__') PropertiesService.getScriptProperties().deleteProperty(k);
      else if (v) PropertiesService.getScriptProperties().setProperty(k, v);
      else return;
      changed.push(k === 'claudeKey' ? 'مفتاح Claude' : 'مفتاح Gemini');
      return;
    }
    if (!(k in DEFAULTS)) return;
    if (String(s[k]) !== S_(k)) { setSetting_(k, s[k]); changed.push(k); }
  });
  if (changed.indexOf('categories') >= 0) formatInvSheet_();
  if (changed.length) log_(me, 'تعديل الإعدادات', '', '', changed.join('، '));
  return getSettingsApi_(r, me);
}

// =====================================================================
//  المستخدمون والدخول
// =====================================================================
function secret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  return s;
}
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function hashPass_(pw, salt) {
  salt = salt || Utilities.getUuid().slice(0, 8);
  return salt + '$' + sha_(salt + '|' + pw + '|' + secret_());
}
function checkPass_(pw, stored) { return !!stored && hashPass_(String(pw), String(stored).split('$')[0]) === String(stored); }

function users_() {
  if (MEMO.users) return MEMO.users;
  return (MEMO.users = readAll_('users').map(function (r, i) {
    const perms = { admin: r[5] === 'نعم', add: r[6] === 'نعم', edit: r[7] === 'نعم', delete: r[8] === 'نعم', reports: r[9] === 'نعم' };
    return {
      row: i + 2, id: str_(r[0]), name: str_(r[1]), username: str_(r[2]), pass: str_(r[3]), status: str_(r[4]), perms: perms,
      requestedAt: str_(r[10]), approvedBy: str_(r[11]), approvedAt: str_(r[12]), lastLogin: str_(r[13])
    };
  }).filter(function (u) { return u.id; }));
}
function publicUser_(u) {
  return { id: u.id, name: u.name, username: u.username, status: u.status, perms: u.perms, requestedAt: u.requestedAt, approvedBy: u.approvedBy, approvedAt: u.approvedAt, lastLogin: u.lastLogin };
}
function can_(u, p) { return !!(u && u.perms && (u.perms.admin || u.perms[p])); }
function setUserCells_(row, o) {
  const sh = sheet_('users');
  const map = { name: 2, username: 3, pass: 4, status: 5, admin: 6, add: 7, edit: 8, delete: 9, reports: 10, requestedAt: 11, approvedBy: 12, approvedAt: 13, lastLogin: 14 };
  Object.keys(o).forEach(function (k) { sh.getRange(row, map[k]).setNumberFormat('@').setValue(o[k]); });
  MEMO.users = null;
}
function findUser_(username) {
  const u = String(username || '').trim().toLowerCase();
  return users_().filter(function (x) { return x.username.toLowerCase() === u; })[0];
}
function validNew_(r) {
  const name = String(r.name || '').trim(), username = String(r.username || '').trim(), pw = String(r.password || '');
  if (name.length < 2) throw new Error('اكتب الاسم');
  if (!/^[A-Za-z0-9_.؀-ۿ-]{3,30}$/.test(username)) throw new Error('اسم الدخول من 3 إلى 30 حرفاً أو رقماً دون مسافات');
  if (pw.length < 6) throw new Error('كلمة المرور 6 أحرف أو أرقام على الأقل');
  if (findUser_(username)) throw new Error('اسم الدخول مستخدم من قبل، اختر غيره');
  return { name: name, username: username, pw: pw };
}
function appendUser_(v, status, perms, approvedBy) {
  const id = 'U' + Utilities.getUuid().slice(0, 8);
  const t = now_();
  const yn = function (b) { return b ? 'نعم' : 'لا'; };
  const row = [id, v.name, v.username, hashPass_(v.pw), status, yn(perms.admin), yn(perms.add), yn(perms.edit), yn(perms.delete), yn(perms.reports), t, approvedBy || '', approvedBy ? t : '', ''];
  const sh = sheet_('users');
  ensureRow_(sh, sh.getLastRow() + 1);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  MEMO.users = null;
  return findUser_(v.username);
}

function token_(u) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const body = u.id + '.' + exp;
  return body + '.' + sha_(body + '|' + u.pass + '|' + secret_()).slice(0, 32);
}
function auth_(tok) {
  const fail = function (m) { const e = new Error(m || 'انتهت الجلسة، سجّل الدخول من جديد'); e.auth = true; throw e; };
  const p = String(tok || '').split('.');
  if (p.length !== 3 || Number(p[1]) < Date.now()) fail();
  const u = users_().filter(function (x) { return x.id === p[0]; })[0];
  if (!u) fail();
  if (sha_(p[0] + '.' + p[1] + '|' + u.pass + '|' + secret_()).slice(0, 32) !== p[2]) fail();
  if (u.status !== U_ACTIVE) fail(u.status === U_PENDING ? 'حسابك بانتظار موافقة المدير' : 'حسابك موقوف، راجع المدير');
  return u;
}

function boot_() {
  const s = publicSettings_();
  return {
    needsSetup: users_().length === 0,
    appName: s.appName, orgRight: s.orgRight, orgLeft: s.orgLeft, logoRight: s.logoRight, logoLeft: s.logoLeft,
    allowRegister: s.allowRegister === 'نعم'
  };
}
function firstAdmin_(r) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (users_().length) throw new Error('تم إنشاء حساب المدير من قبل. سجّل الدخول.');
    const v = validNew_(r);
    const u = appendUser_(v, U_ACTIVE, { admin: true, add: true, edit: true, delete: true, reports: true }, v.name);
    log_(u, 'إنشاء حساب المدير', '', '', u.username);
    return { token: token_(u), user: publicUser_(u) };
  } finally { lock.releaseLock(); }
}
function register_(r) {
  if (!yes_('allowRegister')) throw new Error('التسجيل مغلق، اطلب من المدير إضافتك');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const v = validNew_(r);
    const u = appendUser_(v, U_PENDING, { add: true }, '');
    log_(u, 'طلب حساب جديد', '', '', u.username);
    return { msg: 'تم إرسال طلبك. يمكنك الدخول بعد موافقة المدير ومنحك الصلاحيات.' };
  } finally { lock.releaseLock(); }
}
function login_(r) {
  const cache = CacheService.getScriptCache();
  const key = 'fail_' + String(r.username || '').trim().toLowerCase();
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) throw new Error('محاولات كثيرة خاطئة. حاول بعد 15 دقيقة');
  const u = findUser_(r.username);
  if (!u || !checkPass_(r.password, u.pass)) {
    cache.put(key, String(fails + 1), LOCK_SECONDS);
    throw new Error('اسم الدخول أو كلمة المرور غير صحيحة');
  }
  cache.remove(key);
  if (u.status === U_PENDING) throw new Error('حسابك بانتظار موافقة المدير');
  if (u.status !== U_ACTIVE) throw new Error('حسابك موقوف، راجع المدير');
  setUserCells_(u.row, { lastLogin: now_() });
  return { token: token_(u), user: publicUser_(u) };
}
function changePassword_(r, me) {
  if (!checkPass_(r.oldPassword, me.pass)) throw new Error('كلمة المرور الحالية غير صحيحة');
  if (String(r.newPassword || '').length < 6) throw new Error('كلمة المرور الجديدة 6 أحرف أو أرقام على الأقل');
  setUserCells_(me.row, { pass: hashPass_(String(r.newPassword)) });
  log_(me, 'تغيير كلمة المرور', '', '', '');
  const u = users_().filter(function (x) { return x.id === me.id; })[0];
  return { token: token_(u) };
}
function saveUser_(r, me) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const d = r.user || {};
    const perms = d.perms || {};
    if (!d.id) {
      const v = validNew_(d);
      const u = appendUser_(v, U_ACTIVE, perms, me.name);
      log_(me, 'إضافة مستخدم', '', '', u.name + ' (' + u.username + ')');
      return users_().map(publicUser_);
    }
    const u = users_().filter(function (x) { return x.id === d.id; })[0];
    if (!u) throw new Error('المستخدم غير موجود');
    const o = {}, notes = [];
    const yn = function (b) { return b ? 'نعم' : 'لا'; };
    if (d.name && d.name !== u.name) { o.name = String(d.name).trim(); notes.push('الاسم'); }
    PERMS.forEach(function (p) {
      if (p in perms && !!perms[p] !== !!u.perms[p]) { o[p] = yn(perms[p]); notes.push((perms[p] ? '+' : '-') + p); }
    });
    if (d.status && d.status !== u.status) {
      o.status = d.status; notes.push('الحالة: ' + d.status);
      if (d.status === U_ACTIVE && u.status === U_PENDING) { o.approvedBy = me.name; o.approvedAt = now_(); }
    }
    if (d.password) {
      if (String(d.password).length < 6) throw new Error('كلمة المرور 6 أحرف أو أرقام على الأقل');
      o.pass = hashPass_(String(d.password)); notes.push('كلمة مرور جديدة');
    }
    if (u.id === me.id && (o.status && o.status !== U_ACTIVE || o.admin === 'لا')) throw new Error('لا يمكنك إيقاف حسابك أو سحب صلاحية المدير من نفسك');
    if (Object.keys(o).length) {
      setUserCells_(u.row, o);
      log_(me, o.approvedBy ? 'موافقة على مستخدم' : 'تعديل مستخدم', '', '', u.name + ': ' + notes.join('، '));
    }
    return users_().map(publicUser_);
  } finally { lock.releaseLock(); }
}
function deleteUser_(r, me) {
  const u = users_().filter(function (x) { return x.id === r.id; })[0];
  if (!u) throw new Error('المستخدم غير موجود');
  if (u.id === me.id) throw new Error('لا يمكنك حذف حسابك');
  sheet_('users').deleteRow(u.row);
  MEMO.users = null;
  log_(me, 'حذف مستخدم', '', '', u.name + ' (' + u.username + ')');
  return users_().map(publicUser_);
}

// =====================================================================
//  السجل
// =====================================================================
function log_(u, action, code, invId, details) {
  try {
    const sh = sheet_('log');
    ensureRow_(sh, sh.getLastRow() + 1);
    sh.getRange(sh.getLastRow() + 1, 1, 1, 6).setNumberFormat('@')
      .setValues([[now_(), u ? u.name : '', action, code || '', invId || '', String(details || '').slice(0, 4000)]]);
  } catch (e) { console.warn('log: ' + e); }
}
function readLog_(r) {
  const rows = readAll_('log');
  const lim = Math.min(Number(r.limit) || 500, 3000);
  return rows.slice(-lim).reverse().map(function (x) { return { at: str_(x[0]), user: str_(x[1]), action: str_(x[2]), code: str_(x[3]), id: str_(x[4]), details: str_(x[5]) }; });
}
function invoiceHistory_(r) {
  return readAll_('log').filter(function (x) { return str_(x[4]) === r.id; }).reverse()
    .map(function (x) { return { at: str_(x[0]), user: str_(x[1]), action: str_(x[2]), details: str_(x[5]) }; });
}

// =====================================================================
//  الفواتير
// =====================================================================
function rowToInv_(r, i) {
  const o = { row: i + 2 };
  INV_KEYS.forEach(function (k, j) {
    if (k === 'image') return;
    o[k] = NUM_KEYS.indexOf(k) >= 0 ? (r[j] === '' ? '' : Number(r[j])) : str_(r[j]);
  });
  return o;
}
function invoices_() {
  if (MEMO.inv) return MEMO.inv;
  return (MEMO.inv = readAll_('inv').map(rowToInv_).filter(function (x) { return x.id; }));
}
function clientInv_(x) { const o = {}; Object.keys(x).forEach(function (k) { if (k !== 'row') o[k] = x[k]; }); return o; }
function listInvoices_() {
  return invoices_().filter(function (x) { return x.deleted !== 'نعم'; }).map(clientInv_);
}
function thumbUrl_(id) { return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000' : ''; }
function writeInv_(o, row) {
  const sh = sheet_('inv');
  const vals = INV_KEYS.map(function (k) {
    if (k === 'image') return o.file_id ? '=IMAGE("' + thumbUrl_(o.file_id) + '")' : '';
    const v = o[k];
    return v == null ? '' : v;
  });
  if (!row) row = sh.getLastRow() + 1;
  ensureRow_(sh, row);
  const fmts = INV_KEYS.map(function (k) { return k === 'image' ? 'General' : NUM_KEYS.indexOf(k) >= 0 ? '#,##0.00' : '@'; });
  sh.getRange(row, 1, 1, vals.length).setNumberFormats([fmts]).setValues([vals]);
  if (o.file_id) try { sh.setRowHeight(row, 110); } catch (e) { }
  MEMO.inv = null;
  return row;
}
// ترتيب ورقة الفواتير حسب تاريخ الفاتورة (الأقدم في الأعلى)، ثم وقت الإدخال
function sortInvSheet_() {
  try {
    const sh = sheet_('inv'), n = sh.getLastRow() - 1;
    if (n < 2) return;
    sh.getRange(2, 1, n, INV_KEYS.length).sort([
      { column: INV_KEYS.indexOf('date') + 1, ascending: true },
      { column: INV_KEYS.indexOf('created_at') + 1, ascending: true }
    ]);
    sh.setRowHeights(2, n, 110);
    MEMO.inv = null;
  } catch (e) { console.warn('sort: ' + e); }
}
function nextCode_() {
  const prefix = S_('codePrefix');
  let max = 0;
  invoices_().forEach(function (x) {
    const m = String(x.code || '').match(/(\d+)\s*$/);
    if (m && String(x.code).indexOf(prefix) === 0) max = Math.max(max, Number(m[1]));
  });
  return prefix + (max + 1);
}
function normNum_(s) { return String(s || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^0-9A-Za-z]/g, '').replace(/^0+/, '').toUpperCase(); }
function normName_(s) { return String(s || '').replace(/[\sً-ْـ.,،\-]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase(); }

// هل الفاتورة a أُدخلت قبل b؟ (الأصل دائماً هو الأقدم إدخالاً)
function older_(a, b) {
  if (!b.created_at) return true;
  const x = a.created_at || '', y = b.created_at;
  return x < y || (x === y && a.row < b.row);
}
// يبحث عن فاتورة أصلية تطابق هذه — يعيدها أو null
function findDup_(o) {
  if (o.not_dup === 'نعم') return null;
  // الأصل دائماً هو الأقدم إدخالاً، فلا تُعلَّم فاتورة قديمة مكررةً من فاتورة أحدث منها
  const list = invoices_().filter(function (x) { return x.deleted !== 'نعم' && x.id !== o.id && x.status !== STATUS.DUP && older_(x, o); });
  const num = normNum_(o.number), vat = normNum_(o.vat_no), total = Number(o.total), vend = normName_(o.vendor);
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    if (yes_('dupHash') && o.file_hash && x.file_hash === o.file_hash) return { inv: x, why: 'نفس ملف الصورة' };
    if (yes_('dupNumber') && num.length >= 2 && normNum_(x.number) === num) {
      if (vat && normNum_(x.vat_no) === vat) return { inv: x, why: 'نفس رقم الفاتورة ونفس الرقم الضريبي للمورد' };
      if (!vat || !x.vat_no) {
        if ((vend && normName_(x.vendor) === vend) || (total && Number(x.total) === total)) return { inv: x, why: 'نفس رقم الفاتورة ونفس المورد أو المبلغ' };
      }
    }
    if (yes_('dupAmount') && total && o.date && x.date === o.date && Number(x.total) === total && vend && normName_(x.vendor) === vend)
      return { inv: x, why: 'نفس المورد والتاريخ والمبلغ' };
  }
  return null;
}
function applyDup_(o) {
  const d = findDup_(o);
  if (d) { o.status = STATUS.DUP; o.dup_of = d.inv.code; return d.why; }
  if (o.status === STATUS.DUP) o.status = '';
  o.dup_of = '';
  if (!o.status) o.status = needsReview_(o) ? STATUS.REVIEW : STATUS.OK;
  return '';
}
function needsReview_(o) { return !(Number(o.total) > 0) || !o.date; }
function refreshStatus_(o) {
  if (o.status === STATUS.DUP) return;
  o.status = needsReview_(o) ? STATUS.REVIEW : STATUS.OK;
}
function cleanFields_(src, o) {
  EDITABLE.forEach(function (k) {
    if (!(k in src)) return;
    let v = src[k];
    if (NUM_KEYS.indexOf(k) >= 0) v = num_(v);
    else v = String(v == null ? '' : v).trim().slice(0, 1000);
    if (k === 'date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('التاريخ يجب أن يكون بصيغة سنة-شهر-يوم');
    if (k === 'kind' && v && [KIND.TAX, KIND.NOTAX, KIND.PAPER].indexOf(v) < 0) v = KIND.NOTAX;
    o[k] = v;
  });
  // إكمال المبالغ تلقائياً
  const rate = Number(S_('vatRate')) / 100 || 0.15;
  if (o.kind === KIND.TAX) {
    if (o.total !== '' && o.subtotal === '' && o.vat === '') { o.subtotal = Math.round(o.total / (1 + rate) * 100) / 100; o.vat = Math.round((o.total - o.subtotal) * 100) / 100; }
    else if (o.total !== '' && o.vat !== '' && o.subtotal === '') o.subtotal = Math.round((o.total - o.vat) * 100) / 100;
    else if (o.total !== '' && o.subtotal !== '' && o.vat === '') o.vat = Math.round((o.total - o.subtotal) * 100) / 100;
    else if (o.total === '' && o.subtotal !== '') { if (o.vat === '') o.vat = Math.round(o.subtotal * rate * 100) / 100; o.total = Math.round((o.subtotal + o.vat) * 100) / 100; }
  } else if (o.kind) {
    if (o.total === '' && o.subtotal !== '') o.total = o.subtotal;
    if (o.vat === '' || o.vat === 0) { o.vat = 0; if (o.subtotal === '' && o.total !== '') o.subtotal = o.total; }
  }
  return o;
}

function folder_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  p.setProperty('FOLDER_ID', f.getId());
  return f;
}
function monthFolder_(date) {
  const root = folder_();
  const name = (date && /^\d{4}-\d{2}/.test(date)) ? date.slice(0, 7) : Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
function saveFile_(file, code, date) {
  if (!file || !file.data) return null;
  const bytes = Utilities.base64Decode(String(file.data));
  if (bytes.length > 15 * 1024 * 1024) throw new Error('حجم الملف أكبر من 15 ميجا');
  const mime = String(file.mime || 'image/jpeg');
  const ext = mime.indexOf('pdf') >= 0 ? '.pdf' : mime.indexOf('png') >= 0 ? '.png' : '.jpg';
  const f = monthFolder_(date).createFile(Utilities.newBlob(bytes, mime, 'فاتورة ' + code + ext));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { console.warn('sharing: ' + e); }
  return { id: f.getId(), url: f.getUrl(), mime: mime };
}

function addInvoice_(r, me) {
  const file = r.file || null;
  let ai = null, aiErr = '';
  if (file && file.data && r.useAi !== false && yes_('aiEnabled')) {
    try { ai = readWithAi_(file.data, file.mime); } catch (e) { aiErr = String(e.message || e); }
  }
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    MEMO.inv = null;
    const o = { id: 'INV' + Utilities.getUuid().slice(0, 10), total: '', subtotal: '', vat: '', kind: '', status: '' };
    const base = {};
    if (ai) Object.keys(ai).forEach(function (k) { if (ai[k] !== '' && ai[k] != null) base[k] = ai[k]; });
    const manual = r.data || {};
    Object.keys(manual).forEach(function (k) { if (manual[k] !== '' && manual[k] != null) base[k] = manual[k]; });
    if (r.forceKind) base.kind = r.forceKind;
    if (r.forceCategory) base.category = r.forceCategory;
    if (!base.kind) base.kind = (Number(num_(base.vat)) > 0 || base.vat_no) ? KIND.TAX : KIND.NOTAX;
    cleanFields_(base, o);
    if (o.category && categories_().indexOf(o.category) < 0) { o.notes = (o.notes ? o.notes + ' — ' : '') + 'تصنيف مقترح: ' + o.category; o.category = ''; }
    o.code = String(manual.code || '').trim() || nextCode_();
    o.file_hash = String(r.fileHash || '').slice(0, 80);
    const why = applyDup_(o);
    if (!ai && file && file.data && aiErr) o.status = o.status === STATUS.DUP ? o.status : STATUS.REVIEW;
    const saved = file ? saveFile_(file, o.code, o.date) : null;
    if (saved) { o.file_id = saved.id; o.file_url = saved.url; o.mime = saved.mime; }
    o.created_by = me.name; o.created_at = now_();
    o.deleted = ''; o.not_dup = '';
    writeInv_(o);
    sortInvSheet_();
    log_(me, file ? 'رفع فاتورة' : 'إدخال يدوي', o.code, o.id, [o.vendor, o.total, o.kind, why ? 'مكررة: ' + why + ' (' + o.dup_of + ')' : ''].filter(String).join(' | '));
    const res = clientInv_(o);
    res._dupReason = why; res._aiError = aiErr; res._ai = !!ai;
    return res;
  } finally { lock.releaseLock(); }
}
function getInv_(id) {
  const x = invoices_().filter(function (v) { return v.id === id && v.deleted !== 'نعم'; })[0];
  if (!x) throw new Error('الفاتورة غير موجودة');
  return x;
}
function updateInvoice_(r, me) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    MEMO.inv = null;
    const x = getInv_(r.id);
    const before = JSON.parse(JSON.stringify(x));
    cleanFields_(r.data || {}, x);
    if (x.kind !== KIND.TAX && before.kind === KIND.TAX && !('vat' in (r.data || {}))) { x.vat = 0; x.subtotal = x.total; }
    if (r.file && r.file.data) {
      const saved = saveFile_(r.file, x.code, x.date);
      x.file_id = saved.id; x.file_url = saved.url; x.mime = saved.mime; x.file_hash = String(r.fileHash || '');
    }
    if (x.status !== STATUS.DUP) x.status = '';
    const why = applyDup_(x);
    if (!why) refreshStatus_(x);
    x.updated_by = me.name; x.updated_at = now_();
    writeInv_(x, x.row);
    if (before.date !== x.date) sortInvSheet_();
    const diff = EDITABLE.filter(function (k) { return String(before[k]) !== String(x[k]); }).map(function (k) { return colName_(k) + ': ' + before[k] + ' ← ' + x[k]; });
    if (r.file && r.file.data) diff.push('استبدال صورة الفاتورة');
    log_(me, 'تعديل فاتورة', x.code, x.id, diff.join(' | ') + (why ? ' | مكررة: ' + why : ''));
    const res = clientInv_(x); res._dupReason = why;
    return res;
  } finally { lock.releaseLock(); }
}
function colName_(k) { const c = INV.filter(function (x) { return x[0] === k; })[0]; return c ? c[1] : k; }
function setNotDup_(r, me) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    MEMO.inv = null;
    const x = getInv_(r.id);
    x.not_dup = r.value === false ? '' : 'نعم';
    x.status = '';
    const why = applyDup_(x);
    x.updated_by = me.name; x.updated_at = now_();
    writeInv_(x, x.row);
    log_(me, x.not_dup ? 'تأكيد أنها غير مكررة' : 'إلغاء تأكيد عدم التكرار', x.code, x.id, why);
    return clientInv_(x);
  } finally { lock.releaseLock(); }
}
function removeInvoice_(r, me) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    MEMO.inv = null;
    const x = getInv_(r.id);
    x.deleted = 'نعم'; x.updated_by = me.name; x.updated_at = now_();
    writeInv_(x, x.row);
    log_(me, 'حذف فاتورة', x.code, x.id, [x.vendor, x.total, x.date].join(' | '));
    return true;
  } finally { lock.releaseLock(); }
}
function rereadInvoice_(r, me) {
  const x = getInv_(r.id);
  if (!x.file_id) throw new Error('لا توجد صورة لهذه الفاتورة');
  const blob = DriveApp.getFileById(x.file_id).getBlob();
  const ai = readWithAi_(Utilities.base64Encode(blob.getBytes()), blob.getContentType());
  if (!r.save) return ai; // تُعرض في نافذة التعديل ليؤكدها المستخدم
  // حفظ مباشر: تُملأ الحقول الفارغة فقط، فلا يُمسّ ما عدّله المستخدم بيده
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    MEMO.inv = null;
    const y = getInv_(r.id);
    const before = JSON.parse(JSON.stringify(y));
    const fill = {};
    EDITABLE.forEach(function (k) {
      if (k === 'code' || ai[k] === '' || ai[k] == null) return;
      const cur = y[k];
      const empty = cur === '' || cur == null || (NUM_KEYS.indexOf(k) >= 0 && !Number(cur)) || (k === 'kind' && !y.total);
      if (empty) fill[k] = ai[k];
    });
    if (fill.kind || fill.total) { if (!('subtotal' in fill)) y.subtotal = ''; if (!('vat' in fill)) y.vat = ''; }
    cleanFields_(fill, y);
    if (fill.category && categories_().indexOf(fill.category) < 0) y.category = '';
    if (y.status !== STATUS.DUP) y.status = '';
    const why = applyDup_(y);
    if (!why) refreshStatus_(y);
    y.updated_by = me.name; y.updated_at = now_();
    writeInv_(y, y.row);
    if (before.date !== y.date) sortInvSheet_();
    log_(me, 'إعادة القراءة الآلية', y.code, y.id, Object.keys(fill).map(function (k) { return colName_(k) + ': ' + y[k]; }).join(' | ') + (why ? ' | مكررة: ' + why : ''));
    const res = clientInv_(y); res._dupReason = why;
    return res;
  } finally { lock.releaseLock(); }
}
function fileData_(r) {
  const x = getInv_(r.id);
  if (!x.file_id) throw new Error('لا توجد صورة');
  const f = DriveApp.getFileById(x.file_id);
  if (r.thumb) {
    try {
      const t = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + x.file_id + '&sz=w' + (Number(r.size) || 400),
        { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (t.getResponseCode() === 200 && /image/.test(t.getHeaders()['Content-Type'] || '')) return { mime: 'image/jpeg', data: Utilities.base64Encode(t.getContent()) };
    } catch (e) { }
  }
  const b = f.getBlob();
  if (b.getBytes().length > 12 * 1024 * 1024) throw new Error('الملف كبير، افتحه من الرابط');
  return { mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
}

// =====================================================================
//  القراءة الآلية للفاتورة (Gemini)
// =====================================================================
function aiKey_(name) {
  const k = PropertiesService.getScriptProperties().getProperty(name || 'geminiKey');
  if (!k) throw new Error('لم يُضبط مفتاح ' + (name === 'claudeKey' ? 'Claude' : 'Gemini') + ' في الإعدادات');
  return k;
}
// أي خدمة تقرأ الفواتير: Claude أو Gemini
function provider_() {
  const p = S_('aiProvider');
  if (p === 'Claude' || p === 'Gemini') return p;
  return PropertiesService.getScriptProperties().getProperty('claudeKey') ? 'Claude' : 'Gemini';
}
// القراءة بـ Claude من Anthropic
function callClaude_(prompt, b64, mime) {
  const key = aiKey_('claudeKey');
  const content = [];
  if (b64) {
    const isPdf = /pdf/i.test(mime || '');
    content.push(isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: /png/i.test(mime) ? 'image/png' : 'image/jpeg', data: b64 } });
  }
  content.push({ type: 'text', text: prompt });
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: S_('claudeModel') || DEFAULTS.claudeModel, max_tokens: 1024, temperature: 0, messages: [{ role: 'user', content: content }] })
  });
  const code = res.getResponseCode(), txt = res.getContentText();
  if (code === 200) {
    const j = JSON.parse(txt);
    return (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  }
  let msg = ''; try { msg = JSON.parse(txt).error.message; } catch (e) { msg = txt.slice(0, 200); }
  if (code === 401) throw new Error('مفتاح Claude غير صحيح');
  if (code === 400 && /credit|balance|billing/i.test(msg)) throw new Error('رصيد حساب Claude لا يكفي — أضف رصيداً من console.anthropic.com');
  if (code === 404 && /model/i.test(msg)) throw new Error('اسم نموذج Claude غير صحيح في الإعدادات: ' + S_('claudeModel'));
  if (code === 429) throw new Error('طلبات كثيرة على Claude في وقت واحد، حاول بعد دقيقة');
  if (code === 529 || code >= 500) throw new Error('خدمة Claude مشغولة الآن، حاول بعد قليل');
  throw new Error('تعذّرت القراءة بـ Claude (' + code + ': ' + msg + ')');
}
function askAi_(prompt, b64, mime) {
  if (provider_() === 'Claude') return callClaude_(prompt, b64, mime);
  const parts = [{ text: prompt }];
  if (b64) parts.push({ inline_data: { mime_type: mime || 'image/jpeg', data: b64 } });
  return callGemini_(parts);
}
function parseJson_(txt) {
  let t = String(txt || '').replace(/```(json)?/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}
function callGemini_(parts) {
  const key = aiKey_('geminiKey');
  // عند الضغط على نموذج (503) ننتظر قليلاً ثم نجرب نموذجاً آخر بدل التوقف
  const models = [S_('aiModel') || DEFAULTS.aiModel, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
    .filter(function (m, i, a) { return m && a.indexOf(m) === i; });
  const started = Date.now();
  let lastErr = '', busy = false, quota = false;
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < models.length; i++) {
      if (Date.now() - started > 150000) break;   // لا نتجاوز مهلة جوجل
      let res;
      try {
        res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[i]) + ':generateContent', {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-goog-api-key': key },
          payload: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } })
        });
      } catch (e) { lastErr = String(e.message || e); continue; }
      const code = res.getResponseCode();
      const txt = res.getContentText();
      if (code === 200) {
        const j = JSON.parse(txt);
        const out = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        const t = out.map(function (p) { return p.text || ''; }).join('');
        if (t) return t;
        lastErr = 'رد فارغ'; continue;
      }
      lastErr = code + ': ' + (function () { try { return JSON.parse(txt).error.message; } catch (e) { return txt.slice(0, 200); } })();
      if ((code === 400 || code === 403) && /API key|API_KEY|permission/i.test(txt)) throw new Error('مفتاح Gemini غير صحيح أو غير مفعّل');
      if (code === 503 || code === 500 || code === 502 || code === 504) { busy = true; Utilities.sleep(1500 + round * 2500); continue; }
      if (code === 429) { quota = true; Utilities.sleep(2000); continue; }
      // 404 أو نموذج غير متاح: ننتقل للنموذج التالي
    }
    Utilities.sleep(3000);
  }
  if (busy) throw new Error('خدمة Gemini مزدحمة الآن — أعد القراءة بعد قليل');
  if (quota) throw new Error('تجاوزت حد Gemini المجاني مؤقتاً — أعد القراءة بعد دقيقة');
  throw new Error('تعذّرت القراءة الآلية (' + lastErr + ')');
}
function readWithAi_(b64, mime) {
  const cats = categories_();
  const prompt = [
    'أنت محاسب سعودي. استخرج بيانات هذا المستند (فاتورة أو إيصال أو ورقة مكتوبة باليد) وأعد JSON فقط بهذه المفاتيح:',
    '{"is_document":true/false, "kind":"tax|no_tax|paper", "date":"YYYY-MM-DD", "date_hijri":"", "number":"", "vendor":"", "vat_no":"",',
    ' "subtotal":0, "vat":0, "total":0, "description":"", "category":""}',
    'القواعد:',
    '- kind = tax إذا كانت فاتورة ضريبية فيها رقم ضريبي للمورد (15 رقماً يبدأ بـ 3 غالباً) أو ضريبة قيمة مضافة. no_tax إذا كانت فاتورة أو إيصال مطبوع بلا ضريبة. paper إذا كانت ورقة مكتوبة بخط اليد أو سند صرف بدل فاتورة.',
    '- date بالتاريخ الميلادي. إن لم يوجد إلا تاريخ هجري فضعه في date_hijri وحوّله إلى ميلادي (تقويم أم القرى) في date.',
    '- number: رقم الفاتورة كما هو. vendor: اسم المؤسسة أو المتجر البائع (ليس اسم المشتري). vat_no: الرقم الضريبي للبائع فقط.',
    '- المبالغ أرقام بلا عملة. total هو المبلغ النهائي المدفوع شامل الضريبة. إن لم تُذكر الضريبة فاجعل vat = 0 و subtotal = total.',
    '- description: بيان صرف عربي مختصر (3 إلى 8 كلمات) يصف ما تم شراؤه أو صرفه.',
    '- category: اختر واحداً فقط من هذه القائمة يناسب المشتريات: ' + cats.join('، ') + '. إن لم يناسب أيٌّ منها فاتركه فارغاً.',
    '- اكتب الأرقام بالأرقام الإنجليزية. اترك الحقل فارغاً "" إن لم تجده ولا تخمّن.'
  ].join('\n');
  const txt = askAi_(prompt + '\nأعد كائن JSON واحداً فقط دون أي شرح.', b64, mime);
  let j;
  try { j = parseJson_(txt); } catch (e) { throw new Error('لم تُفهم نتيجة القراءة الآلية'); }
  if (Array.isArray(j)) j = j[0] || {};
  const kindMap = { tax: KIND.TAX, no_tax: KIND.NOTAX, paper: KIND.PAPER };
  const o = {
    kind: kindMap[j.kind] || '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(j.date || '')) ? j.date : '',
    number: String(j.number || ''), vendor: String(j.vendor || ''), vat_no: String(j.vat_no || '').replace(/\s/g, ''),
    subtotal: num_(j.subtotal), vat: num_(j.vat), total: num_(j.total),
    description: String(j.description || ''), category: cats.indexOf(String(j.category || '')) >= 0 ? j.category : ''
  };
  if (j.date_hijri) o.notes = 'التاريخ الهجري: ' + j.date_hijri;
  if (j.is_document === false) o.notes = (o.notes ? o.notes + ' — ' : '') + 'قد لا يكون المستند فاتورة';
  return o;
}
function testAi_() {
  const p = provider_();
  const t = askAi_('أعد هذا JSON كما هو فقط: {"ok":true}');
  return { ok: /true/.test(t), provider: p, model: p === 'Claude' ? S_('claudeModel') : S_('aiModel') };
}
/*CORE-END*/
