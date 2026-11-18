/* ===== أدوات المصحف: حساب الأوجه (مصحف المدينة 604)، اختيار المقطع، الإدخال الصوتي ===== */
const Q = (() => {
  const SUR = window.QURAN.surahs; // [name, ayahCount]
  const PG = window.QURAN.pages;   // page per absolute ayah (6236)
  const start = []; let acc = 0; SUR.forEach((s, i) => { start[i] = acc; acc += s[1]; });
  const perPage = {}; PG.forEach(p => perPage[p] = (perPage[p] || 0) + 1);
  const cum = []; let c = 0; PG.forEach((p, i) => { c += 1 / perPage[p]; cum[i] = c; });
  const norm = s => String(s || '').replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
  const names = SUR.map(s => s[0]);
  const nameNorm = names.map(n => norm(n));
  const alias = { 'عم': 78, 'النبا': 78, 'تبارك': 67, 'الملك': 67, 'ن': 68, 'القلم': 68, 'الدهر': 76, 'هل اتي': 76, 'الانسان': 76, 'المسد': 111, 'تبت': 111, 'اللهب': 111, 'الشرح': 94, 'الانشراح': 94, 'الم نشرح': 94, 'قد سمع': 58, 'المجادله': 58, 'بني اسرائيل': 17, 'الاسراء': 17, 'غافر': 40, 'المومن': 40, 'فصلت': 41, 'حم السجده': 41, 'التوبه': 9, 'براءه': 9, 'الفاتحه': 1, 'الحمد': 1, 'الكافرون': 109, 'الاخلاص': 112, 'التكاثر': 102, 'الهمزه': 104, 'قريش': 106, 'الماعون': 107, 'الكوثر': 108, 'الزلزله': 99, 'الزلزال': 99, 'العاديات': 100, 'القارعه': 101, 'البينه': 98, 'العلق': 96, 'اقرا': 96 };
  const idx = (s, a) => start[s - 1] + a - 1; // s 1-based
  function pagesBetween(s1, a1, s2, a2) {
    if (!s1 || !a1 || !s2 || !a2) return 0;
    let i = idx(s1, a1), j = idx(s2, a2); if (i > j) [i, j] = [j, i];
    return cum[j] - (i > 0 ? cum[i - 1] : 0);
  }
  function rangeText(r) {
    if (!r || !r.s1) return '';
    const n1 = names[r.s1 - 1], n2 = names[(r.s2 || r.s1) - 1];
    if (!r.s2 || r.s1 === r.s2) {
      if (r.a1 == 1 && r.a2 == SUR[r.s1 - 1][1]) return 'سورة ' + n1 + ' كاملة';
      return n1 + ' ' + r.a1 + '–' + r.a2;
    }
    const full = (r.s1 < r.s2 && r.a1 == 1 && r.a2 == SUR[r.s2 - 1][1]) || (r.s1 > r.s2 && r.a1 == SUR[r.s1 - 1][1] && r.a2 == 1);
    if (full) return 'من سورة ' + n1 + ' إلى سورة ' + n2;
    return 'من ' + n1 + ' ' + r.a1 + ' إلى ' + n2 + ' ' + r.a2;
  }
  function ayahSet(r) { const out = []; if (!r || !r.s1 || !r.a1 || !r.s2 || !r.a2) return out; let i = idx(r.s1, r.a1), j = idx(r.s2, r.a2); if (i > j) [i, j] = [j, i]; for (let k = i; k <= j; k++) out.push(k); return out; }
  function absToSA(k) { let s = 0; while (s < SUR.length - 1 && start[s + 1] <= k) s++; return [s + 1, k - start[s] + 1]; }
  function findSurah(txt) {
    const t = ' ' + norm(txt).replace(/سوره\s*/g, '') + ' ';
    let best = null, bestLen = 0;
    const tryName = (nm, sn) => { const n2 = nm.replace(/^ال/, ''); [nm, n2].forEach(v => { if (v.length < 2 && v !== 'ن' && v !== 'ق' && v !== 'ص') return; const re = new RegExp('(^|\\s|ال|بال|و)' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)'); const m = re.exec(t); if (m && v.length > bestLen) { best = { s: sn, pos: m.index }; bestLen = v.length; } }); };
    nameNorm.forEach((nm, i) => tryName(nm, i + 1));
    Object.keys(alias).forEach(k => tryName(k, alias[k]));
    return best;
  }
  function findAllSurahs(txt) {
    const res = []; const t = norm(txt).replace(/سوره\s*/g, m => ' '.repeat(m.length));
    const all = nameNorm.map((n, i) => [n, i + 1]).concat(Object.keys(alias).map(k => [k, alias[k]]));
    all.forEach(([nm, sn]) => { [nm, nm.replace(/^ال/, '').trim()].forEach((v, vi) => { if (v.length < (vi ? 3 : 2)) return; let p = -1; const re = new RegExp('(^|\\s|ال|بال|و)' + v + '(?=\\s|$)', 'g'); let m; while ((m = re.exec(t))) { p = m.index; res.push({ s: sn, pos: p, len: v.length }); } }); });
    res.sort((a, b) => a.pos - b.pos || b.len - a.len);
    const out = []; res.forEach(r => { if (!out.length || Math.abs(out[out.length - 1].pos - r.pos) > 3) out.push(r); });
    return out;
  }
  return { SUR, names, idx, pagesBetween, rangeText, ayahSet, absToSA, findSurah, findAllSurahs, norm, count: s => SUR[s - 1] ? SUR[s - 1][1] : 0, total: PG.length, pageOf: k => PG[k], cum };
})();

/* ——— تحويل الأعداد المنطوقة إلى أرقام ——— */
const AR_NUM = (() => {
  const ones = { 'صفر': 0, 'واحد': 1, 'واحده': 1, 'احد': 1, 'الاولي': 1, 'الاول': 1, 'اولي': 1, 'اثنين': 2, 'اثنان': 2, 'اثنتين': 2, 'ثنتين': 2, 'الثانيه': 2, 'الثاني': 2, 'ثلاث': 3, 'ثلاثه': 3, 'الثالثه': 3, 'الثالث': 3, 'اربع': 4, 'اربعه': 4, 'الرابعه': 4, 'الرابع': 4, 'خمس': 5, 'خمسه': 5, 'الخامسه': 5, 'الخامس': 5, 'ست': 6, 'سته': 6, 'السادسه': 6, 'السادس': 6, 'سبع': 7, 'سبعه': 7, 'السابعه': 7, 'السابع': 7, 'ثمان': 8, 'ثماني': 8, 'ثمانيه': 8, 'الثامنه': 8, 'الثامن': 8, 'تسع': 9, 'تسعه': 9, 'التاسعه': 9, 'التاسع': 9, 'عشر': 10, 'عشره': 10, 'العاشره': 10, 'العاشر': 10, 'الحاديه': 1, 'الحادي': 1 };
  const tens = { 'عشرين': 20, 'عشرون': 20, 'العشرين': 20, 'ثلاثين': 30, 'ثلاثون': 30, 'اربعين': 40, 'اربعون': 40, 'خمسين': 50, 'خمسون': 50, 'ستين': 60, 'ستون': 60, 'سبعين': 70, 'سبعون': 70, 'ثمانين': 80, 'ثمانون': 80, 'تسعين': 90, 'تسعون': 90 };
  const hund = { 'ميه': 100, 'مئه': 100, 'مايه': 100, 'مائه': 100, 'مية': 100, 'مئتين': 200, 'ميتين': 200, 'مائتين': 200, 'مئتان': 200, 'ثلاثمئه': 300, 'ثلاثمائه': 300, 'ثلاثميه': 300 };
  function convert(text) {
    let t = Q.norm(text).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const toks = t.split(/\s+/); const out = []; let curNum = null; let teen = false;
    const flush = () => { if (curNum != null) out.push(String(curNum)); curNum = null; };
    for (let i = 0; i < toks.length; i++) {
      let w = toks[i]; let joined = false;
      if (w.startsWith('و') && w.length > 2 && (ones[w.slice(1)] != null || tens[w.slice(1)] != null || hund[w.slice(1)] != null)) { w = w.slice(1); joined = true; }
      let v = ones[w] != null ? ones[w] : tens[w] != null ? tens[w] : hund[w] != null ? hund[w] : null;
      if (v == null && /^\d+$/.test(w)) v = +w;
      if (v == null) { flush(); out.push(toks[i]); continue; }
      if ((w === 'عشر' || w === 'عشره') && curNum != null && curNum < 10) { curNum += 10; continue; }
      if (curNum == null) curNum = v;
      else if (joined || (curNum >= 100 && v < 100) || (curNum < 10 && v >= 20 && v < 100)) curNum += v;
      else { flush(); curNum = v; }
    }
    flush();
    return out.join(' ');
  }
  return { convert };
})();

/* ——— تحليل الجملة الصوتية لمقطع قرآني ——— */
function parseQuranSpeech(text) {
  const t = AR_NUM.convert(text);
  const sur = Q.findAllSurahs(t);
  const nums = (t.match(/\d+/g) || []).map(Number);
  const r = {};
  if (/مراجع/.test(t)) r.kind = 'review'; else if (/حفظ/.test(t)) r.kind = 'hifz';
  if (!sur.length) return null;
  r.s1 = sur[0].s;
  r.s2 = sur.length > 1 ? sur[sur.length - 1].s : r.s1;
  if (sur.length > 1) {
    // أرقام بعد السورة الأولى وقبل الثانية = آية البداية، وبعد الثانية = آية النهاية
    const p2 = sur[sur.length - 1].pos;
    const before = (t.slice(0, p2).match(/\d+/g) || []).map(Number);
    const after = (t.slice(p2).match(/\d+/g) || []).map(Number);
    const rev = r.s1 > r.s2;
    r.a1 = before.length ? before[before.length - 1] : (rev ? Q.count(r.s1) : 1);
    r.a2 = after.length ? after[0] : (rev ? 1 : Q.count(r.s2));
  } else if (nums.length >= 2) { r.a1 = nums[0]; r.a2 = nums[1]; }
  else if (nums.length === 1) {
    if (/(الي|حتي)\s*(ايه|اية|الايه)?\s*\d/.test(t) && !/من/.test(t)) { r.a1 = 1; r.a2 = nums[0]; }
    else { r.a1 = nums[0]; r.a2 = /(الي|حتي)/.test(t) ? nums[0] : Q.count(r.s1); }
  } else { r.a1 = 1; r.a2 = Q.count(r.s1); }
  r.a1 = Math.max(1, Math.min(r.a1, Q.count(r.s1))); r.a2 = Math.max(1, Math.min(r.a2, Q.count(r.s2)));
  return r;
}
function parseNoorSpeech(text) {
  const t = AR_NUM.convert(text);
  const m = t.match(/الدرس\s*(\d+)/) || t.match(/درس\s*(\d+)/);
  const nums = (t.match(/\d+/g) || []).map(Number);
  const r = {};
  if (m) { r.lesson = +m[1]; nums.splice(nums.indexOf(+m[1]), 1); }
  else if (/الاخير/.test(t)) r.lesson = NOORANIA.length;
  if (nums.length >= 2) { r.from = nums[0]; r.to = nums[1]; } else if (nums.length === 1) { r.from = 1; r.to = nums[0]; }
  return r.lesson || r.from ? r : null;
}

/* ——— التعرف على الكلام ——— */
function speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function listen(btn, onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('المتصفح لا يدعم الإدخال الصوتي — استخدم Chrome'); return; }
  if (btn._rec) { btn._rec.stop(); return; }
  const rec = new SR(); rec.lang = 'ar-SA'; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = false;
  btn._rec = rec; btn.classList.add('rec');
  let finalT = '';
  rec.onresult = e => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; finalT = s; onText(s, false); };
  rec.onerror = e => { toast(e.error === 'not-allowed' ? 'اسمح للمتصفح باستخدام الميكروفون' : 'لم أتمكن من السماع، أعد المحاولة'); };
  rec.onend = () => { btn.classList.remove('rec'); btn._rec = null; if (finalT) onText(finalT, true); };
  rec.start();
}

/* ——— مكوّن اختيار المقطع القرآني ——— */
function surahOptions(sel) { return Q.names.map((n, i) => `<option value="${i + 1}" ${sel == i + 1 ? 'selected' : ''}>${i + 1}. ${n}</option>`).join(''); }
function ayahOptions(s, sel) { let h = ''; const c = Q.count(s); for (let i = 1; i <= c; i++) h += `<option ${sel == i ? 'selected' : ''}>${i}</option>`; return h; }
function rangePicker(r, onChange) {
  r = r || {};
  const el = document.createElement('div');
  const draw = () => {
    const pages = Q.pagesBetween(r.s1, r.a1, r.s2, r.a2);
    el.innerHTML = `
      <div class="range-grid">
        <div class="field"><label>من سورة</label><select class="inp" data-k="s1"><option value="">— اختر —</option>${surahOptions(r.s1)}</select></div>
        <div class="field"><label>من آية</label><select class="inp" data-k="a1">${r.s1 ? ayahOptions(r.s1, r.a1) : ''}</select></div>
        <div class="field"><label>إلى سورة</label><select class="inp" data-k="s2"><option value="">— اختر —</option>${surahOptions(r.s2)}</select></div>
        <div class="field"><label>إلى آية</label><select class="inp" data-k="a2">${r.s2 ? ayahOptions(r.s2, r.a2) : ''}</select></div>
      </div>
      <div class="row small">${r.s1 ? `<span class="pages-badge">${num(pages)} وجه</span><span class="muted">${Q.rangeText(r)}</span>` : '<span class="muted">اختر يدوياً أو اضغط 🎤 وقل مثلاً: «سورة النبأ من آية ١ إلى ١٦»</span>'}
      ${r.s1 ? '<button type="button" class="btn sm ghost" data-whole>السورة كاملة</button>' : ''}</div>`;
    $$('select', el).forEach(sl => sl.onchange = () => {
      const k = sl.dataset.k; r[k] = +sl.value || null;
      if (k === 's1') { r.a1 = 1; if (!r.s2 || r.s2 === r.s1 || true) { r.s2 = r.s1; r.a2 = Q.count(r.s1); } }
      if (k === 's2') { if (r.s2 < r.s1) { r.a2 = 1; if (r.a1 == 1) r.a1 = Q.count(r.s1); } else r.a2 = Q.count(r.s2); }
      r.pages = Q.pagesBetween(r.s1, r.a1, r.s2, r.a2); draw(); onChange && onChange(r);
    });
    const wb = $('[data-whole]', el); if (wb) wb.onclick = () => { r.s2 = r.s1; r.a1 = 1; r.a2 = Q.count(r.s1); r.pages = Q.pagesBetween(r.s1, r.a1, r.s2, r.a2); draw(); onChange && onChange(r); };
  };
  el.set = v => { Object.assign(r, v); r.pages = Q.pagesBetween(r.s1, r.a1, r.s2, r.a2); draw(); onChange && onChange(r); };
  draw();
  return el;
}

/* ——— نص الآيات (جزء عم) مع تحديد الأخطاء بالنقر على الكلمة ——— */
function ayahTextAvailable(s) { const t = window.JUZAMMA[Q.names[s - 1]]; return t && t.length === Q.count(s) ? t : null; }
function ayahBoxHTML(range, errors) {
  if (!range || !range.s1) return '';
  const set = Q.ayahSet(range); if (!set.length || set.length > 60) return '';
  let html = ''; let any = false; let lastS = 0;
  set.forEach(k => {
    const [s, a] = Q.absToSA(k); const txt = ayahTextAvailable(s); if (!txt) return; any = true;
    if (s !== lastS) { html += `<div style="text-align:center;font-family:Tajawal;font-size:13px;color:#8a6d0e;margin:4px 0">﴿ سورة ${Q.names[s - 1]} ﴾</div>`; lastS = s; }
    txt[a - 1].split(/\s+/).forEach((w, wi) => {
      const e = (errors || []).find(x => x.s == s && x.a == a && x.w == wi);
      html += `<span class="w ${e ? (e.fixed ? 'fixed' : 'err') : ''}" data-s="${s}" data-a="${a}" data-w="${wi}">${esc(w)}</span> `;
    });
    html += `<span class="ayah-num">${a}</span> `;
  });
  return any ? `<div class="ayah-box">${html}</div>` : '';
}
function wordOf(s, a, w) { const t = ayahTextAvailable(s); return t ? (t[a - 1].split(/\s+/)[w] || '') : ''; }

/* ——— ما حفظه الطالب (مجموعة الآيات) ——— */
function memorizedSet(recs) {
  const set = new Set();
  recs.forEach(r => { if (r.att === 'a' || r.att === 'e') return; if (r.hifz && r.hifz.s1 && (r.hifz.grade || 3) >= 2) Q.ayahSet(r.hifz).forEach(k => set.add(k)); });
  return set;
}
function surahProgress(set) { return Q.SUR.map((s, i) => { let c = 0; for (let a = 1; a <= s[1]; a++) if (set.has(Q.idx(i + 1, a))) c++; return c / s[1]; }); }
function pagesOfSet(set) { let p = 0; set.forEach(k => { p += (Q.cum[k] - (k > 0 ? Q.cum[k - 1] : 0)); }); return p; }

/* ——— اقتراح المقطع التالي تلقائياً ——— */
function suggestNext(range, dir) {
  if (!range || !range.s2) return null;
  const s = range.s2, a = range.a2, c = Q.count(s);
  const len = Math.max(1, Math.abs(Q.idx(range.s2, range.a2) - Q.idx(range.s1, range.a1)) + 1);
  if (a < c) { const a2 = Math.min(c, a + Math.min(len, c - a)); return { s1: s, a1: a + 1, s2: s, a2 }; }
  const ns = dir === 'asc' ? s + 1 : s - 1;
  if (ns < 1 || ns > 114) return null;
  const c2 = Q.count(ns);
  return { s1: ns, a1: 1, s2: ns, a2: Math.min(c2, Math.max(len, c2 <= 20 ? c2 : len)) };
}
