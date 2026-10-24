// ============================================================
//  بصمة مجمع ابن تيمية — مُحمِّل الخادم ذاتي التحديث
//  هذا هو الملف الوحيد المطلوب في محرر Apps Script (مع حذف Code.gs القديم).
//  يجلب أحدث نسخة من الخادم والواجهة من مستودع GitHub تلقائياً كل 10 دقائق،
//  فكل تحديث يُرفع إلى GitHub يصل للبرنامج دون لصق أو نشر جديد.
//  إن تعذّر الوصول إلى GitHub يعمل البرنامج بآخر نسخة سليمة محفوظة في جدول البيانات.
// ============================================================
const CORE_BASE = 'https://raw.githubusercontent.com/aboyehia15-droid/goto/main/server/';
const CORE_TTL = 600;            // مدة الاحتفاظ بالنسخة قبل فحص التحديث (ثوانٍ)
const CORE_CHUNK = 90000;        // حجم الجزء في الذاكرة المؤقتة
const CORE_SHEET = 'نسخة الخادم'; // ورقة مخفية تحفظ آخر نسخة سليمة

// ---------- الدوال التي يستدعيها جوجل ----------
function doGet(e) { return core_().doGet(e); }
function doPost(e) { return core_().doPost(e); }
function api(req) { return core_().api(req); }
function pushTick() { return core_().pushTick(); }
function setup() { const r = core_().setup(); return r + ' | نسخة الخادم: ' + coreInfo_(); }
function installReminders() { return core_().installReminders(); }
function resetAdminPin() { return core_().resetAdminPin(); }
// تشغيلها يدوياً لجلب آخر تحديث فوراً بدل انتظار 10 دقائق
function updateNow() { CacheService.getScriptCache().removeAll(['core_v_Code.js', 'core_v_Index.html']); CORE_MEM = null; HTML_MEM = null; core_(); LOADER_HTML_(); return 'تم التحديث: ' + coreInfo_(); }

// ---------- التحميل ----------
let CORE_MEM = null, HTML_MEM = null;
function core_() {
  if (CORE_MEM) return CORE_MEM;
  const src = getFile_('Code.js', function (s) { return s.indexOf('/*CORE-END*/') > 0 && compile_(s) !== null; });
  CORE_MEM = compile_(src);
  if (!CORE_MEM) throw new Error('تعذّر تشغيل نسخة الخادم');
  return CORE_MEM;
}
function LOADER_HTML_() {
  if (HTML_MEM) return HTML_MEM;
  HTML_MEM = getFile_('Index.html', function (s) { return s.indexOf('</html>') > 0 && s.indexOf('google.script') > 0; });
  return HTML_MEM;
}
function compile_(src) {
  try {
    return (new Function(src + '\n;return {api: api, doGet: doGet, doPost: doPost, setup: setup, pushTick: pushTick, installReminders: installReminders, resetAdminPin: resetAdminPin};'))();
  } catch (e) { console.error('compile: ' + e); return null; }
}
// يقرأ الملف من الذاكرة المؤقتة، وإلا من GitHub، وإلا من آخر نسخة محفوظة في الجدول
function getFile_(name, valid) {
  const cache = CacheService.getScriptCache();
  const meta = cache.get('core_v_' + name);
  if (meta) {
    const n = Number(meta.split('|')[0]);
    const keys = []; for (let i = 0; i < n; i++) keys.push('core_' + name + '_' + i);
    const got = cache.getAll(keys);
    if (keys.every(function (k) { return got[k] != null; })) return keys.map(function (k) { return got[k]; }).join('');
  }
  let src = null;
  try {
    const r = UrlFetchApp.fetch(CORE_BASE + name + '?t=' + Math.floor(Date.now() / 60000), { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() === 200) {
      const s = r.getContentText('UTF-8');
      if (valid(s)) src = s; else console.error('نسخة غير سليمة من GitHub: ' + name);
    }
  } catch (e) { console.warn('github: ' + e); }
  const saved = savedGet_(name);
  if (src) { if (saved !== src) savedPut_(name, src); }
  else src = saved;
  if (!src) throw new Error('تعذّر جلب نسخة الخادم من GitHub ولا توجد نسخة محفوظة. تأكد أن المستودع عام وأن مجلد server موجود.');
  const parts = [];
  for (let i = 0; i < src.length; i += CORE_CHUNK) parts.push(src.slice(i, i + CORE_CHUNK));
  const obj = {}; parts.forEach(function (p, i) { obj['core_' + name + '_' + i] = p; });
  try { cache.putAll(obj, CORE_TTL + 60); cache.put('core_v_' + name, parts.length + '|' + new Date().toISOString(), CORE_TTL); } catch (e) { }
  return src;
}
function coreSheet_(create) {
  const id = PropertiesService.getScriptProperties().getProperty('SSID');
  const ss = SpreadsheetApp.getActiveSpreadsheet() || (id ? SpreadsheetApp.openById(id) : null);
  if (!ss) return null;
  let sh = ss.getSheetByName(CORE_SHEET);
  if (!sh && create) { sh = ss.insertSheet(CORE_SHEET); sh.hideSheet(); }
  return sh;
}
function savedGet_(name) {
  try {
    const sh = coreSheet_(false);
    if (!sh || sh.getLastRow() < 1) return null;
    const rows = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
    const parts = rows.filter(function (r) { return r[0] === name; }).map(function (r) { return String(r[1]); });
    return parts.length ? parts.join('') : null;
  } catch (e) { return null; }
}
function savedPut_(name, src) {
  try {
    const sh = coreSheet_(true);
    const n = sh.getLastRow();
    const keep = n ? sh.getRange(1, 1, n, 2).getValues().filter(function (r) { return r[0] && r[0] !== name; }) : [];
    for (let i = 0; i < src.length; i += 45000) keep.push([name, src.slice(i, i + 45000)]);
    if (n) sh.getRange(1, 1, n, 2).clearContent();
    sh.getRange(1, 1, keep.length, 2).setNumberFormat('@').setValues(keep);
  } catch (e) { console.warn('save copy: ' + e); }
}
function coreInfo_() {
  const m = CacheService.getScriptCache().get('core_v_Code.js');
  return m ? 'جُلبت ' + m.split('|')[1] : 'محفوظة';
}
