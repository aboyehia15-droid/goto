/* ===================== المتابعة اليومية ===================== */
const ATT = { p: ['حاضر', 'p'], a: ['غائب', 'a'], l: ['متأخر', 'l'], e: ['مستأذن', 'e'] };
const ERR_TYPES = ['نسيان', 'خطأ في الحركة', 'خطأ في الحرف', 'تجويد', 'تردد', 'تلقين', 'خلط بين الآيات'];
let DAY = { cls: '', date: '' };

function classSubjects(c) { const f = features(); return (c && c.subjects || ['quran', 'noor', 'zad']).filter(s => f[s]); }
function lastRec(sid, before, key) { const rs = T('records').filter(r => r.studentId === sid && r.date < before && r[key] && (key !== 'noor' ? r[key].s1 : r[key].lesson)).sort((a, b) => a.date < b.date ? 1 : -1); return rs[0]; }

function recSummary(r, subj) {
  if (!r) return '<span class="chip gray">لم يُسجَّل</span>';
  if (r.att === 'a') return '<span class="chip red">غائب</span>';
  if (r.att === 'e') return '<span class="chip blue">مستأذن</span>';
  const out = [];
  if (subj.includes('quran') && r.hifz && r.hifz.s1) out.push(`<span class="chip">📖 ${Q.rangeText(r.hifz)} · ${num(r.hifz.pages)}و</span>${gradeChip(r.hifz.grade)}`);
  if (subj.includes('quran') && r.review && r.review.s1) out.push(`<span class="chip blue">🔁 ${Q.rangeText(r.review)} · ${num(r.review.pages)}و</span>${gradeChip(r.review.grade)}`);
  if (subj.includes('noor') && r.noor && r.noor.lesson) out.push(`<span class="chip gold">🔤 د${r.noor.lesson}${r.noor.from ? ' (' + r.noor.from + '–' + r.noor.to + ')' : ''}</span>${gradeChip(r.noor.grade)}`);
  if (subj.includes('zad') && r.zad && r.zad.length) out.push(`<span class="chip" style="background:#fbe7ee;color:#a3325a">🌸 ${r.zad.length} من زاد الطفل</span>`);
  if (r.errors && r.errors.length) out.push(`<span class="chip red">✏️ ${r.errors.filter(e => !e.fixed).length}/${r.errors.length} خطأ</span>`);
  if (r.behavior) out.push(stars(r.behavior));
  if (r.note) out.push('<span class="chip gray">📝 ملاحظة</span>');
  return out.join(' ') || '<span class="chip green">حاضر</span>';
}
function dailySummaryText(r) {
  if (!r) return '';
  if (r.att === 'a') return 'غائب';
  const L = [];
  if (r.att === 'l') L.push('⏰ متأخر');
  if (r.hifz && r.hifz.s1) L.push('📖 الحفظ: ' + Q.rangeText(r.hifz) + (r.hifz.grade ? ' — ' + gradeLabel(r.hifz.grade) : ''));
  if (r.review && r.review.s1) L.push('🔁 المراجعة: ' + Q.rangeText(r.review) + (r.review.grade ? ' — ' + gradeLabel(r.review.grade) : ''));
  if (r.noor && r.noor.lesson) L.push('🔤 النورانية: ' + NOORANIA[r.noor.lesson - 1].title + (r.noor.grade ? ' — ' + gradeLabel(r.noor.grade) : ''));
  (r.zad || []).forEach(z => { const c = zadCurriculum().find(c => c.id === z.cat); L.push('🌸 ' + (c ? c.name : '') + ': ' + z.item + (z.grade ? ' — ' + gradeLabel(z.grade) : '')); });
  const errs = (r.errors || []).filter(e => !e.fixed); if (errs.length) L.push('✏️ أخطاء تحتاج مراجعة: ' + errs.length);
  if (r.note) L.push('📝 ' + r.note);
  return L.join('\n');
}

function viewDaily(v, sub) {
  const classes = myClasses();
  if (sub && byId('classes', sub)) DAY.cls = sub;
  if (!DAY.cls || !classes.some(c => c.id === DAY.cls)) DAY.cls = (classes[0] || {}).id || '';
  if (!DAY.date) DAY.date = todayISO();
  if (!classes.length) { v.innerHTML = `<div class="card empty"><span class="e">🏫</span>${canAdmin() ? 'أنشئ فصلاً ووزّع الطلاب عليه أولاً<br><br><a class="btn" href="#/classes">🏫 الفصول</a>' : 'لم يُسند إليك فصل بعد — راجع إدارة المجمع'}</div>`; return; }
  const c = byId('classes', DAY.cls); const subj = classSubjects(c);
  const list = studentsOfClass(DAY.cls);
  const recs = list.map(s => getRec(s.id, DAY.date));
  const pres = recs.filter(r => r && (r.att === 'p' || r.att === 'l')).length, abs = recs.filter(r => r && r.att === 'a').length;
  const pages = recs.reduce((a, r) => a + (r ? (+(r.hifz || {}).pages || 0) + (+(r.review || {}).pages || 0) : 0), 0);
  const isWork = (S.settings.workDays || []).includes(parseISO(DAY.date).getDay());
  v.innerHTML = `
    <div class="daybar">
      <select class="inp" id="dcls" style="width:auto;font-weight:700">${classes.map(x => `<option value="${x.id}" ${x.id === DAY.cls ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="btn sm light" id="dprev">▶</button><input type="date" class="inp" id="ddate" value="${DAY.date}" style="width:auto"><button class="btn sm light" id="dnext">◀</button>
      <span class="small muted">${dayName(DAY.date)} · ${hijri(DAY.date)}</span>${DAY.date !== todayISO() ? '<button class="btn sm ghost" id="dtoday">اليوم</button>' : ''}
      <span style="flex:1"></span><span class="chip green">حاضر ${pres}</span><span class="chip red">غائب ${abs}</span><span class="chip">${num(pages, 1)} وجه</span>
    </div>
    ${!isWork ? '<div class="card small" style="background:#fff8e1">ℹ️ هذا اليوم ليس من أيام الدراسة المحددة في الإعدادات — يمكنك التسجيل مع ذلك.</div>' : ''}
    <div class="row" style="margin-bottom:10px"><button class="btn sm" id="allp">✅ الكل حاضر</button><button class="btn sm light" id="absWa">💬 إشعار الغائبين</button><button class="btn sm light" id="dailyWa">📤 إرسال تقارير اليوم</button><a class="btn sm light" href="#/reports/week/${DAY.cls}">🗓️ جدول الأسبوع</a></div>
    <div id="dlist">${list.map((s, i) => { const r = recs[i]; return `<div class="stu-card ${r && r.att === 'a' ? 'absent' : ''}" data-id="${s.id}">
      <div class="top"><div class="avatar" style="background:${colorOf(s.name)};width:38px;height:38px;font-size:14px">${initials(s.name)}</div><div class="nm" data-open>${esc(s.name)}</div>
      <div class="att">${Object.entries(ATT).map(([k, [t, cl]]) => `<button class="${cl} ${r && r.att === k ? 'on' : ''}" data-att="${k}">${t}</button>`).join('')}</div></div>
      <div class="sum" data-open>${recSummary(r, subj)} <button class="btn sm light" style="margin-inline-start:auto">✏️ تسجيل</button></div></div>`; }).join('') || '<div class="card empty"><span class="e">👦</span>لا يوجد طلاب في هذا الفصل<br><br>' + (canAdmin() ? '<a class="btn" href="#/classes">إضافة طلاب للفصل</a>' : '') + '</div>'}</div>`;
  $('#dcls').onchange = e => { DAY.cls = e.target.value; render(); };
  $('#ddate').onchange = e => { DAY.date = e.target.value || todayISO(); render(); };
  const step = d => { let x = DAY.date; for (let k = 0; k < 7; k++) { x = addDays(x, d); if ((S.settings.workDays || []).includes(parseISO(x).getDay())) break; } DAY.date = x; render(); };
  $('#dprev').onclick = () => step(-1); $('#dnext').onclick = () => step(1);
  const dt = $('#dtoday'); if (dt) dt.onclick = () => { DAY.date = todayISO(); render(); };
  $('#allp').onclick = () => { list.forEach(s => { const r = getRec(s.id, DAY.date) || newRec(s); if (!r.att) { r.att = 'p'; save('records', r); } }); render(); };
  $('#dlist').onclick = e => {
    const card = e.target.closest('.stu-card'); if (!card) return; const s = byId('students', card.dataset.id);
    const ab = e.target.closest('[data-att]');
    if (ab) { const r = getRec(s.id, DAY.date) || newRec(s); r.att = r.att === ab.dataset.att ? '' : ab.dataset.att; save('records', r); render(); return; }
    if (e.target.closest('[data-open]')) recordEditor(s, DAY.date);
  };
  $('#absWa').onclick = () => waQueueDialog(list.filter(s => (getRec(s.id, DAY.date) || {}).att === 'a').map(s => ({ name: s.name, phone: s.guardianPhone, text: fillTpl(S.settings.waAbsent, { student: s.name, date: fmtDate(DAY.date) }) })), 'إشعار غياب');
  $('#dailyWa').onclick = () => waQueueDialog(list.map(s => ({ s, r: getRec(s.id, DAY.date) })).filter(x => x.r && x.r.att !== 'a').map(({ s, r }) => { if (!s.parentToken) { s.parentToken = token20(); save('students', s); } return { name: s.name, phone: s.guardianPhone, text: fillTpl(S.settings.waDaily, { student: s.name, date: fmtDate(DAY.date), summary: dailySummaryText(r), link: parentLink(s) }) }; }), 'تقارير اليوم لأولياء الأمور');
}
function newRec(s, date) { return { id: recId(s.id, date || DAY.date), studentId: s.id, classId: s.classId, date: date || DAY.date }; }

/* ——— محرر سجل الطالب اليومي ——— */
function recordEditor(s, date) {
  const c = classOf(s); const subj = classSubjects(c); const f = features();
  const orig = getRec(s.id, date);
  const r = JSON.parse(JSON.stringify(orig || newRec(s, date)));
  r.classId = s.classId; r.errors = r.errors || []; r.zad = r.zad || [];
  if (!r.att) r.att = 'p';
  const body = document.createElement('div');
  const list = studentsOfClass(s.classId); const idx = list.findIndex(x => x.id === s.id); const next = list[idx + 1];
  const m = modal({ title: `${esc(s.name)} <span class="small muted">— ${fmtDate(date)}</span>`, body, wide: true,
    foot: `<button class="btn" data-save>💾 حفظ</button>${next ? `<button class="btn gold" data-next>💾 حفظ والتالي ◀</button>` : ''}<button class="btn wa" data-wa title="إرسال تقرير اليوم">💬</button><span style="flex:1"></span>${orig ? '<button class="btn ghost" data-del>🗑️</button>' : ''}` });

  const sec = (id, title, inner, mic) => `<div class="sec" id="sec-${id}"><div class="sec-h">${title}<span class="sp"></span>${mic && f.voice && speechSupported() ? `<button type="button" class="mic" data-mic="${id}" title="إدخال صوتي">🎤</button>` : ''}</div>${inner}</div>`;
  body.innerHTML = `
    <div class="sec"><div class="sec-h">الحضور</div><div class="att" id="eatt" style="flex-wrap:wrap">${Object.entries(ATT).map(([k, [t, cl]]) => `<button class="${cl} ${r.att === k ? 'on' : ''}" data-att="${k}" style="padding:8px 16px;font-size:14px">${t}</button>`).join('')}</div></div>
    <div id="eb"></div>`;
  const eb = $('#eb', body);
  const drawBody = () => {
    if (r.att === 'a' || r.att === 'e') { eb.innerHTML = `<div class="sec">${r.att === 'a' ? '❌ الطالب غائب' : 'ℹ️ الطالب مستأذن'} — <span class="muted">لا يُسجَّل له حفظ أو مراجعة.</span><div class="field" style="margin-top:8px"><label>ملاحظة (اختياري)</label><textarea class="inp" id="enote">${esc(r.note || '')}</textarea></div></div>`; $('#enote', eb).oninput = e => r.note = e.target.value; return; }
    let h = '';
    if (subj.includes('quran')) {
      const lh = lastRec(s.id, date, 'hifz'), lr = lastRec(s.id, date, 'review');
      const sugH = lh ? suggestNext(lh.hifz, s.direction || S.settings.directionDefault) : null;
      h += sec('hifz', '📖 الحفظ الجديد', `${lh ? `<div class="small muted" style="margin-bottom:6px">آخر حفظ (${fmtDate(lh.date, false)}): <b>${Q.rangeText(lh.hifz)}</b> ${gradeChip(lh.hifz.grade)}${sugH && !(r.hifz && r.hifz.s1) ? ` <button class="btn sm gold" data-sug="hifz">↩️ متابعة: ${Q.rangeText(sugH)}</button>` : ''}</div>` : ''}<div data-rp="hifz"></div><div class="voice-text" data-vt="hifz" hidden></div><div style="margin-top:8px">${gradeButtons((r.hifz || {}).grade, 'hifz')}</div><div data-ab="hifz"></div>`, true);
      h += sec('review', '🔁 المراجعة', `${lr ? `<div class="small muted" style="margin-bottom:6px">آخر مراجعة (${fmtDate(lr.date, false)}): <b>${Q.rangeText(lr.review)}</b>${!(r.review && r.review.s1) ? ` <button class="btn sm light" data-sug="review">↩️ نفس المقطع</button>` : ''}${lh && !(r.review && r.review.s1) ? ` <button class="btn sm light" data-sug="review-h">📖 مراجعة آخر حفظ</button>` : ''}</div>` : ''}<div data-rp="review"></div><div class="voice-text" data-vt="review" hidden></div><div style="margin-top:8px">${gradeButtons((r.review || {}).grade, 'review')}</div><div data-ab="review"></div>`, true);
    }
    if (subj.includes('noor')) {
      const ln = lastRec(s.id, date, 'noor'); r.noor = r.noor || {};
      h += sec('noor', '🔤 القاعدة النورانية', `${ln ? `<div class="small muted" style="margin-bottom:6px">آخر تسجيل: <b>الدرس ${ln.noor.lesson}</b> ${ln.noor.from ? '(' + ln.noor.from + '–' + ln.noor.to + ')' : ''} ${gradeChip(ln.noor.grade)}${!r.noor.lesson ? ` <button class="btn sm gold" data-sug="noor">↩️ متابعة</button>` : ''}</div>` : ''}
        <select class="inp" id="nles"><option value="">— اختر الدرس —</option>${NOORANIA.map((l, i) => `<option value="${i + 1}" ${r.noor.lesson == i + 1 ? 'selected' : ''}>${i + 1}. ${esc(l.title.replace(/^الدرس\s*\S+\s*-?\s*/, ''))}</option>`).join('')}</select>
        <div class="voice-text" data-vt="noor" hidden></div><div id="nitems" style="margin-top:8px"></div><div style="margin-top:8px">${gradeButtons(r.noor.grade, 'noor')}</div>`, true);
    }
    if (subj.includes('zad')) {
      h += sec('zad', '🌸 زاد الطفل المسلم', zadCurriculum().map(cat => { const cur = r.zad.filter(z => z.cat === cat.id); return `<div class="zad-cat"><div class="t"><span>${cat.icon}</span>${esc(cat.name)}<span style="flex:1"></span><select class="inp" data-zadd="${cat.id}" style="width:auto;max-width:60%;font-size:13px"><option value="">➕ إضافة بند…</option>${cat.items.map(it => `<option>${esc(it)}</option>`).join('')}</select></div>${cur.map(z => `<div class="row" style="margin:4px 0"><span style="flex:1;min-width:120px">• ${esc(z.item)}</span>${gradeButtons(z.grade, 'zad|' + cat.id + '|' + z.item).replace('class="grades"', 'class="grades" style="flex:2"')}<button class="btn sm ghost" data-zdel="${cat.id}|${esc(z.item)}">✕</button></div>`).join('')}</div>`; }).join(''));
    }
    h += sec('errs', '✏️ الأخطاء والتصويب', `<div class="small muted" style="margin-bottom:6px">${subj.includes('quran') ? 'في جزء عم: اضغط على الكلمة الخاطئة في نص الآيات أعلاه لتسجيلها. ' : ''}أو أضف الخطأ يدوياً:</div><div class="err-list" id="elist"></div><button class="btn sm light" id="eadd">➕ إضافة خطأ</button>`);
    h += sec('note', '📝 ملاحظات المعلم', `${f.behavior ? `<div class="row" style="margin-bottom:8px"><span>السلوك والانضباط:</span><span id="beh">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-b="${n}" style="border:0;background:none;font-size:26px;cursor:pointer;color:${(r.behavior || 0) >= n ? '#e2b93b' : '#ddd'}">★</button>`).join('')}</span></div>` : ''}<textarea class="inp" id="enote" placeholder="ملاحظة تظهر لولي الأمر في صفحة الطالب">${esc(r.note || '')}</textarea>
      <div class="row small" style="margin-top:6px">${['أحسنت، ممتاز 👏', 'يحتاج مراجعة في البيت', 'تحسن ملحوظ', 'يحتاج تركيزاً أكثر', 'نرجو الحرص على الحضور مبكراً'].map(t => `<button type="button" class="chip" data-qn="${t}" style="border:0;cursor:pointer">${t}</button>`).join('')}</div>`);
    eb.innerHTML = h;
    // مكونات اختيار المقطع
    ['hifz', 'review'].forEach(k => {
      const host = $(`[data-rp="${k}"]`, eb); if (!host) return;
      r[k] = r[k] || {};
      const rp = rangePicker(r[k], rr => { r[k] = Object.assign(r[k], rr); drawAyahs(k); });
      host.appendChild(rp); host._rp = rp; drawAyahs(k);
    });
    drawNoor(); drawErrs();
    bindGrades(eb, (name, g) => {
      if (name === 'hifz' || name === 'review') { r[name] = r[name] || {}; r[name].grade = g; }
      else if (name === 'noor') r.noor.grade = g;
      else if (name.startsWith('zad|')) { const [, cat, item] = name.split('|'); const z = r.zad.find(z => z.cat === cat && z.item === item); if (z) z.grade = g; }
    });
  };
  function drawAyahs(k) {
    const host = $(`[data-ab="${k}"]`, eb); if (!host) return;
    const errs = r.errors.filter(e => e.sub === k);
    host.innerHTML = ayahBoxHTML(r[k], errs);
    const box = $('.ayah-box', host); if (!box) return;
    box.onclick = e => { const w = e.target.closest('.w'); if (!w) return; const s1 = +w.dataset.s, a1 = +w.dataset.a, wi = +w.dataset.w; const ex = r.errors.find(x => x.sub === k && x.s == s1 && x.a == a1 && x.w == wi); if (ex) { if (!ex.fixed) ex.fixed = true; else r.errors = r.errors.filter(x => x !== ex); } else r.errors.push({ id: uid('e'), sub: k, s: s1, a: a1, w: wi, word: wordOf(s1, a1, wi), type: 'نسيان', note: '' }); drawAyahs(k); drawErrs(); };
  }
  function drawNoor() {
    const host = $('#nitems', eb); if (!host) return;
    const L = r.noor.lesson ? NOORANIA[r.noor.lesson - 1] : null;
    if (!L) { host.innerHTML = '<span class="small muted">اختر الدرس ثم اضغط على أول بند وآخر بند قرأه الطالب، واضغط مطولاً (أو مرتين) على البند الذي أخطأ فيه.</span>'; return; }
    const from = r.noor.from || 0, to = r.noor.to || 0; const errs = r.errors.filter(e => e.sub === 'noor' && e.lesson == r.noor.lesson);
    host.innerHTML = `<div class="row small" style="margin-bottom:6px"><span class="chip gold">${esc(L.title)}</span>${from ? `<span class="chip">من ${from} إلى ${to} (${Math.abs(to - from) + 1} بند)</span>` : '<span class="muted">اضغط أول بند ثم آخر بند</span>'}<button type="button" class="btn sm ghost" id="nall">الدرس كاملاً</button><label class="row"><input type="checkbox" id="nerrmode" ${host._errMode ? 'checked' : ''}> وضع تحديد الأخطاء</label></div>
      <div class="noor-items">${L.items.map((it, i) => { const n = i + 1; const inR = from && n >= Math.min(from, to) && n <= Math.max(from, to); const er = errs.find(e => e.item === n); return `<button type="button" data-n="${n}" class="${er ? 'err' : inR ? 'in' : ''}" title="${n}">${esc(it)}</button>`; }).join('')}</div>`;
    $('#nall', host).onclick = () => { r.noor.from = 1; r.noor.to = L.items.length; drawNoor(); };
    $('#nerrmode', host).onchange = e => { host._errMode = e.target.checked; };
    let pressT;
    const toggleErr = n => { const ex = r.errors.find(e => e.sub === 'noor' && e.lesson == r.noor.lesson && e.item === n); if (ex) r.errors = r.errors.filter(e => e !== ex); else r.errors.push({ id: uid('e'), sub: 'noor', lesson: r.noor.lesson, item: n, word: L.items[n - 1], type: 'خطأ في الحرف', note: '' }); drawNoor(); drawErrs(); };
    $('.noor-items', host).onclick = e => { const b = e.target.closest('button'); if (!b) return; const n = +b.dataset.n; if (host._errMode || b._long) { b._long = false; if (host._errMode) toggleErr(n); return; } if (!r.noor.from || (r.noor.from && r.noor.to && r.noor._picked)) { r.noor.from = n; r.noor.to = n; r.noor._picked = false; } else { r.noor.to = n; r.noor._picked = true; } drawNoor(); };
    $('.noor-items', host).ondblclick = e => { const b = e.target.closest('button'); if (b) toggleErr(+b.dataset.n); };
    $$('.noor-items button', host).forEach(b => { b.addEventListener('touchstart', () => { pressT = setTimeout(() => { b._long = true; toggleErr(+b.dataset.n); }, 550); }, { passive: true }); b.addEventListener('touchend', () => clearTimeout(pressT)); });
  }
  function drawErrs() {
    const host = $('#elist', eb); if (!host) return;
    host.innerHTML = r.errors.map((e, i) => { const where = e.sub === 'noor' ? `النورانية د${e.lesson}: «${esc(e.word || e.item)}»` : e.sub === 'zad' ? 'زاد الطفل' : `${e.sub === 'review' ? 'مراجعة' : 'حفظ'} — ${Q.names[e.s - 1] || ''} ${e.a || ''}${e.word ? ': «' + esc(e.word) + '»' : ''}`; return `<div class="e ${e.fixed ? 'fixed' : ''}"><div style="flex:1"><div class="small"><b>${where}</b></div><div class="row" style="margin-top:4px"><select class="inp" data-et="${i}" style="width:auto;font-size:12px;padding:5px">${ERR_TYPES.map(t => `<option ${e.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select><input class="inp grow" data-en="${i}" placeholder="التصويب / ملاحظة" value="${esc(e.note || '')}" style="font-size:13px;padding:6px"></div></div><label class="small row" style="white-space:nowrap"><input type="checkbox" data-ef="${i}" ${e.fixed ? 'checked' : ''}> صُوِّب</label><button type="button" class="btn sm ghost" data-ed="${i}">✕</button></div>`; }).join('') || '<div class="small muted">لا توجد أخطاء مسجلة ✨</div>';
    host.oninput = e => { const t = e.target; if (t.dataset.et) r.errors[+t.dataset.et].type = t.value; if (t.dataset.en) r.errors[+t.dataset.en].note = t.value; };
    host.onchange = e => { const t = e.target; if (t.dataset.ef) { r.errors[+t.dataset.ef].fixed = t.checked; drawErrs(); ['hifz', 'review'].forEach(drawAyahs); drawNoor(); } };
    host.onclick = e => { const d = e.target.closest('[data-ed]'); if (d) { r.errors.splice(+d.dataset.ed, 1); drawErrs(); ['hifz', 'review'].forEach(drawAyahs); drawNoor(); } };
  }
  function addErrorManual() {
    const subs = []; if (subj.includes('quran')) subs.push(['hifz', 'الحفظ'], ['review', 'المراجعة']); if (subj.includes('noor')) subs.push(['noor', 'النورانية']); if (subj.includes('zad')) subs.push(['zad', 'زاد الطفل']);
    const mm = modal({ title: 'إضافة خطأ', body: `<div class="field"><label>المادة</label><select class="inp" id="xs">${subs.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div><div id="xw"></div><div class="field"><label>نوع الخطأ</label><select class="inp" id="xt">${ERR_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div><div class="field"><label>الخطأ والتصويب</label><input class="inp" id="xn" placeholder="مثال: قرأ «الرحيم» بدل «الرحمن»"></div>`, foot: '<button class="btn" data-ok>إضافة</button>' });
    const dw = () => { const k = $('#xs', mm.el).value; const rg = r[k]; if ((k === 'hifz' || k === 'review') && rg && rg.s1) { const set = Q.ayahSet(rg); $('#xw', mm.el).innerHTML = `<div class="field"><label>الآية</label><select class="inp" id="xa">${set.map(kk => { const [ss, aa] = Q.absToSA(kk); return `<option value="${ss}|${aa}">${Q.names[ss - 1]} ${aa}</option>`; }).join('')}</select></div>`; } else $('#xw', mm.el).innerHTML = ''; };
    dw(); $('#xs', mm.el).onchange = dw;
    $('[data-ok]', mm.el).onclick = () => { const k = $('#xs', mm.el).value; const e = { id: uid('e'), sub: k, type: $('#xt', mm.el).value, note: $('#xn', mm.el).value }; const xa = $('#xa', mm.el); if (xa) { const [ss, aa] = xa.value.split('|').map(Number); e.s = ss; e.a = aa; } if (k === 'noor') { e.lesson = r.noor.lesson; } r.errors.push(e); mm.close(); drawErrs(); };
  }
  drawBody();
  // أحداث
  $('#eatt', body).onclick = e => { const b = e.target.closest('[data-att]'); if (!b) return; r.att = b.dataset.att; $$('#eatt button', body).forEach(x => x.classList.toggle('on', x === b)); drawBody(); };
  eb.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'nles') { r.noor = { lesson: +t.value || null, grade: r.noor.grade }; drawNoor(); }
    if (t.dataset.zadd) { if (t.value && !r.zad.some(z => z.cat === t.dataset.zadd && z.item === t.value)) r.zad.push({ cat: t.dataset.zadd, item: t.value, grade: 0 }); drawBody(); }
  });
  eb.addEventListener('input', e => { if (e.target.id === 'enote') r.note = e.target.value; });
  eb.addEventListener('click', e => {
    const t = e.target;
    const sg = t.closest('[data-sug]');
    if (sg) {
      const k = sg.dataset.sug;
      if (k === 'hifz') { const lh = lastRec(s.id, date, 'hifz'); const sug = suggestNext(lh.hifz, s.direction || S.settings.directionDefault); if (sug) $('[data-rp="hifz"]', eb)._rp.set(sug); sg.remove(); }
      if (k === 'review') { const lr = lastRec(s.id, date, 'review'); $('[data-rp="review"]', eb)._rp.set({ s1: lr.review.s1, a1: lr.review.a1, s2: lr.review.s2, a2: lr.review.a2 }); sg.remove(); }
      if (k === 'review-h') { const lh = lastRec(s.id, date, 'hifz'); $('[data-rp="review"]', eb)._rp.set({ s1: lh.hifz.s1, a1: lh.hifz.a1, s2: lh.hifz.s2, a2: lh.hifz.a2 }); sg.remove(); }
      if (k === 'noor') { const ln = lastRec(s.id, date, 'noor'); const L = NOORANIA[ln.noor.lesson - 1]; let les = ln.noor.lesson, fr = (Math.max(ln.noor.from || 0, ln.noor.to || 0)) + 1; if (fr > L.items.length) { les = Math.min(NOORANIA.length, les + 1); fr = 1; } const len = Math.max(5, Math.abs((ln.noor.to || 0) - (ln.noor.from || 0)) + 1); r.noor = { lesson: les, from: fr, to: Math.min(NOORANIA[les - 1].items.length, fr + len - 1), grade: 0 }; drawBody(); }
      return;
    }
    const mic = t.closest('[data-mic]');
    if (mic) {
      const k = mic.dataset.mic; const vt = $(`[data-vt="${k}"]`, eb);
      listen(mic, (txt, fin) => {
        vt.hidden = false; vt.textContent = '🎤 ' + txt;
        if (!fin) return;
        if (k === 'noor') { const p = parseNoorSpeech(txt); if (!p) { vt.textContent += ' — لم أفهم الدرس، قل مثلاً: «الدرس الرابع من ١ إلى ٢٠»'; return; } r.noor = Object.assign(r.noor || {}, p); if (p.lesson && !p.from) { r.noor.from = 1; r.noor.to = NOORANIA[p.lesson - 1].items.length; } drawBody(); const v2 = $(`[data-vt="noor"]`, eb); v2.hidden = false; v2.textContent = '✔️ ' + txt; return; }
        const p = parseQuranSpeech(txt);
        if (!p) { vt.textContent += ' — لم أتعرف على اسم السورة، أعد المحاولة'; return; }
        const target = p.kind && p.kind !== k ? p.kind : k;
        $(`[data-rp="${target}"]`, eb)._rp.set(p);
        vt.textContent = '✔️ ' + txt + ' ← ' + Q.rangeText(p);
      });
      return;
    }
    const zd = t.closest('[data-zdel]'); if (zd) { const [cat, ...it] = zd.dataset.zdel.split('|'); r.zad = r.zad.filter(z => !(z.cat === cat && z.item === it.join('|'))); drawBody(); return; }
    const bh = t.closest('[data-b]'); if (bh) { r.behavior = r.behavior == +bh.dataset.b ? 0 : +bh.dataset.b; $$('#beh button', eb).forEach(b => b.style.color = (r.behavior || 0) >= +b.dataset.b ? '#e2b93b' : '#ddd'); return; }
    const qn = t.closest('[data-qn]'); if (qn) { r.note = (r.note ? r.note + ' — ' : '') + qn.dataset.qn; $('#enote', eb).value = r.note; return; }
    if (t.id === 'eadd') addErrorManual();
  });
  const doSave = () => {
    ['hifz', 'review'].forEach(k => { if (r[k] && r[k].s1) { r[k].s2 = r[k].s2 || r[k].s1; r[k].pages = +Q.pagesBetween(r[k].s1, r[k].a1, r[k].s2, r[k].a2).toFixed(3); } else delete r[k]; });
    if (r.noor && !r.noor.lesson) delete r.noor; if (r.noor) delete r.noor._picked;
    if (r.att === 'a' || r.att === 'e') { delete r.hifz; delete r.review; delete r.noor; r.zad = []; }
    save('records', r); toast('✔️ تم الحفظ');
  };
  $('[data-save]', m.el).onclick = () => { doSave(); m.close(); render(); };
  const nx = $('[data-next]', m.el); if (nx) nx.onclick = () => { doSave(); m.close(); render(); recordEditor(next, date); };
  $('[data-wa]', m.el).onclick = () => { doSave(); if (!s.parentToken) { s.parentToken = token20(); save('students', s); } window.open(waLink(s.guardianPhone, r.att === 'a' ? fillTpl(S.settings.waAbsent, { student: s.name, date: fmtDate(date) }) : fillTpl(S.settings.waDaily, { student: s.name, date: fmtDate(date), summary: dailySummaryText(r), link: parentLink(s) })), '_blank'); };
  const dl = $('[data-del]', m.el); if (dl) dl.onclick = async () => { if (await confirmBox('حذف تسجيل هذا اليوم للطالب؟')) { remove('records', r.id); m.close(); render(); } };
}
