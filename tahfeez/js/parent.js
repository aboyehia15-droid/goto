/* ===================== صفحة الطالب لولي الأمر + نموذج التسجيل ===================== */
let PV = { k: 'month', f: '', t: '' };

async function viewParent(root, tokenP) {
  root.innerHTML = '<div class="splash"><img src="assets/logo-ibntaymiyah.jpg"><div>جاري تحميل صفحة الطالب…</div></div>';
  let s;
  if (S.server) {
    try {
      const r = await api('parent', { t: tokenP });
      if (!r.ok) { root.innerHTML = `<div class="splash"><div style="font-size:50px">⚠️</div><div>${esc(r.error)}</div></div>`; return; }
      S.data = { students: [], classes: [], users: [], records: [], payments: [], invites: [], settings: [Object.assign({ id: 'main' }, r.settings)] };
      S.data.students = r.mates.map(m => ({ id: m.id, name: m.name, status: 'active', classId: r.student.classId }));
      const i = S.data.students.findIndex(x => x.id === r.student.id); if (i >= 0) S.data.students[i] = Object.assign({ status: 'active' }, r.student); else S.data.students.push(r.student);
      if (r.cls) S.data.classes = [r.cls];
      if (r.teacher && r.cls) S.data.users = [{ id: r.cls.teacherId, name: r.teacher.name, phone: r.teacher.phone }];
      S.data.records = r.mateRecords.filter(x => x.studentId !== r.student.id).map(x => Object.assign({ id: x.studentId + '|' + x.date, classId: r.student.classId }, x)).concat(r.records);
      S.data.payments = r.payments || [];
      s = byId('students', r.student.id);
    } catch (e) { root.innerHTML = '<div class="splash"><div style="font-size:50px">📡</div><div>تعذر الاتصال، تحقق من الإنترنت وأعد المحاولة</div><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div>'; return; }
  } else {
    s = T('students').find(x => x.parentToken === tokenP);
    if (!s) { root.innerHTML = '<div class="splash"><div style="font-size:50px">🔒</div><div>الرابط غير صحيح — أو أن التطبيق غير مربوط بالخادم بعد</div></div>'; return; }
  }
  document.title = 'متابعة الطالب: ' + s.name;
  drawParent(root, s);
}

function drawParent(root, s) {
  const st = S.settings; const f = features(); const c = classOf(s); const t = teacherOf(c);
  const subj = classSubjects(c);
  const [from, to] = periodRange(PV.k, todayISO(), PV.f, PV.t);
  const o = statsOf(s.id, from, to); const all = recsOf(s.id);
  const rk = c && st.parentShowRank !== false ? rankClass(c.id, from, to).find(x => x.s.id === s.id) : null;
  const lbl = { day: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', custom: 'الفترة المحددة', all: 'منذ البداية' }[PV.k];
  const today = getRec(s.id, todayISO());
  const memo = memorizedSet(all); const prog = surahProgress(memo); const memPages = pagesOfSet(memo);
  const lastNoor = all.filter(r => r.noor && r.noor.lesson).pop();
  const zadAll = all.flatMap(r => r.zad || []);
  const pays = T('payments').filter(p => p.studentId === s.id).sort((a, b) => a.date < b.date ? 1 : -1);
  const fee = feeOf(s), paid = paidOf(s);
  const calMonth = PV.k === 'custom' || PV.k === 'all' ? todayISO() : (to || todayISO());
  const [m1, m2] = monthRange(calMonth);
  const recMap = {}; all.forEach(r => recMap[r.date] = r);
  let cal = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(d => `<div class="h" style="font-size:10.5px">${d}</div>`).join('');
  for (let i = 0; i < parseISO(m1).getDay(); i++) cal += '<div class="d x"></div>';
  for (let d = m1; d <= m2; d = addDays(d, 1)) { const r = recMap[d]; cal += `<div class="d ${r && r.att ? r.att : ''}" title="${r && r.att ? ATT[r.att][0] : ''}">${parseISO(d).getDate()}</div>`; }
  const timeline = o.recs.slice().reverse();
  root.innerHTML = `<div class="parent">
    <div class="p-hero"><div class="logos"><img src="${logoR()}"><img src="${logoL()}"></div>
      <h1>${esc(s.name)}</h1><div class="sub">🏫 ${esc(c ? c.name : '')}${t ? ' · 👨‍🏫 الأستاذ ' + esc(t.name) : ''} · ${esc(st.programName)}</div></div>
    <div class="p-body">
      <div class="card no-print" style="padding:8px"><div class="tabs" style="margin:0;justify-content:center">${[['day', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['all', 'الكل'], ['custom', 'من–إلى']].map(([k, tt]) => `<button data-k="${k}" class="${PV.k === k ? 'on' : ''}">${tt}</button>`).join('')}</div>
        ${PV.k === 'custom' ? `<div class="row" style="justify-content:center;margin-top:8px"><input type="date" class="inp" id="pf" value="${from}" style="width:auto"> إلى <input type="date" class="inp" id="pt" value="${to}" style="width:auto"></div>` : ''}</div>
      <div class="grid g3">
        ${f.quran && subj.includes('quran') ? `<div class="stat"><span class="i">📖</span><div class="n">${num(o.hifz)}</div><div class="l">وجه حفظ ${lbl}</div></div><div class="stat"><span class="i">🔁</span><div class="n">${num(o.review)}</div><div class="l">وجه مراجعة ${lbl}</div></div>` : ''}
        <div class="stat"><span class="i">📅</span><div class="n">${o.days ? o.attPct + '%' : '—'}</div><div class="l">الحضور (${o.p + o.l}/${o.days})${o.a ? ` · <b style="color:var(--red)">غياب ${o.a}</b>` : ''}</div></div>
        ${rk ? `<div class="stat"><span class="i">🏆</span><div class="n">${rk.rank}<small style="font-size:14px;color:var(--muted)"> / ${studentsOfClass(c.id).length}</small></div><div class="l">الترتيب في الفصل</div></div>` : ''}
        <div class="stat"><span class="i">🎖️</span><div class="n" style="font-size:20px">${levelOf(o)}</div><div class="l">المستوى العام</div></div>
        <div class="stat"><span class="i">⭐</span><div class="n">${o.points}</div><div class="l">النقاط</div></div>
      </div>
      ${today ? `<div class="card" style="margin-top:14px;border:2px solid var(--gold)"><h3>📌 تسجيل اليوم — ${fmtDate(todayISO())}</h3>${parentDay(today, subj)}</div>` : ''}
      ${f.quran && subj.includes('quran') ? `<div class="card" style="margin-top:14px"><h3>📖 خريطة الحفظ</h3>
        <div class="row" style="margin-bottom:10px"><div style="flex:1"><div class="small muted">المحفوظ من المصحف: <b style="color:var(--teal)">${num(memPages, 1)} وجه</b> من 604 (${num(memPages / 604 * 100, 1)}%)</div><div class="prog" style="margin-top:4px"><i style="width:${Math.max(1, memPages / 604 * 100)}%"></i></div></div></div>
        <div class="small muted" style="margin-bottom:6px">جزء عمّ:</div>
        <div class="surah-map">${Array.from({ length: 37 }, (_, i) => 114 - i).map(n => { const p = prog[n - 1]; return `<div class="${p >= 1 ? 'done' : p > 0 ? 'part' : ''}">${Q.names[n - 1]}${p > 0 && p < 1 ? `<i style="width:${p * 100}%"></i>` : ''}</div>`; }).join('')}</div>
        ${prog.slice(0, 77).some(p => p > 0) ? `<div class="small" style="margin-top:8px"><b>سور أخرى:</b> ${prog.slice(0, 77).map((p, i) => p > 0 ? Q.names[i] + (p < 1 ? ' (' + Math.round(p * 100) + '%)' : ' ✓') : '').filter(Boolean).join('، ')}</div>` : ''}</div>` : ''}
      ${f.noor && subj.includes('noor') ? `<div class="card"><h3>🔤 القاعدة النورانية</h3>${lastNoor ? `<div style="margin-bottom:8px">وصل إلى: <b>${esc(NOORANIA[lastNoor.noor.lesson - 1].title)}</b>${lastNoor.noor.to ? ` — البند «<span style="font-family:var(--quran);font-size:20px">${esc(NOORANIA[lastNoor.noor.lesson - 1].items[Math.max(lastNoor.noor.from, lastNoor.noor.to) - 1] || '')}</span>»` : ''}</div>` : '<div class="muted small">لم يبدأ بعد</div>'}
        <div class="noor-path">${NOORANIA.map((l, i) => `<span class="${lastNoor ? (i + 1 < lastNoor.noor.lesson ? 'done' : i + 1 === lastNoor.noor.lesson ? 'cur' : '') : ''}" title="${esc(l.title)}">${i + 1}</span>`).join('')}</div></div>` : ''}
      ${f.zad && subj.includes('zad') ? `<div class="card"><h3>🌸 زاد الطفل المسلم</h3><div class="badges">${zadCurriculum().map(z => { const got = [...new Set(zadAll.filter(x => x.cat === z.id).map(x => x.item))]; return `<div class="badge-it" style="border-color:${got.length ? z.color : ''}"><span class="e">${z.icon}</span><b>${esc(z.name)}</b><div>${got.length} / ${z.items.length}</div></div>`; }).join('')}</div>
        ${zadAll.length ? `<div class="small" style="margin-top:10px;line-height:2">${zadCurriculum().map(z => { const got = [...new Set(zadAll.filter(x => x.cat === z.id).map(x => x.item))]; return got.length ? `<b>${z.icon} ${esc(z.name)}:</b> ${got.map(esc).join('، ')}` : ''; }).filter(Boolean).join('<br>')}</div>` : ''}</div>` : ''}
      <div class="card"><h3>📅 الحضور — ${MONTHS[parseISO(m1).getMonth()]}</h3><div class="cal">${cal}</div><div class="row small" style="margin-top:8px"><span class="chip green">حاضر</span><span class="chip red">غائب</span><span class="chip gold">متأخر</span><span class="chip blue">مستأذن</span></div></div>
      <div class="card"><h3>🗒️ السجل اليومي — ${lbl}</h3><div class="timeline">${timeline.length ? timeline.map(r => `<div class="ti"><div class="dt">${fmtDate(r.date)} <span class="small muted">${hijri(r.date)}</span></div>${parentDay(r, subj)}</div>`).join('') : '<div class="empty small">لا توجد تسجيلات في هذه الفترة</div>'}</div></div>
      ${f.fees && st.parentShowFees !== false && fee > 0 ? `<div class="card"><h3>💰 الرسوم</h3>${kpis([[num(fee), 'الرسوم المقررة'], [num(paid), 'المسدد'], [num(Math.max(0, fee - paid)), 'المتبقي']])}${pays.length ? `<table class="tbl"><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th></tr>${pays.map(p => `<tr><td>${fmtDate(p.date, false)}</td><td>${num(p.amount)} ${st.currency}</td><td>${esc(p.method || '')}</td></tr>`).join('')}</table>` : ''}</div>` : ''}
      <div class="row no-print" style="justify-content:center;margin-top:10px"><button class="btn" id="pprint">🖨️ طباعة تقرير ${lbl}</button>${t && t.phone ? `<a class="btn wa" target="_blank" href="${waLink(t.phone, 'السلام عليكم أستاذ ' + t.name + '، معك ولي أمر الطالب ' + s.name)}">💬 تواصل مع المعلم</a>` : st.phone ? `<a class="btn wa" target="_blank" href="${waLink(st.phone, 'السلام عليكم، معكم ولي أمر الطالب ' + s.name)}">💬 تواصل مع المجمع</a>` : ''}</div>
      <div id="pprint-area" style="display:none"></div>
      <div class="small muted" style="text-align:center;margin-top:20px">${esc(st.orgName)} — ${esc(st.branchName)} · ${esc(st.complexName)}</div>
    </div></div>`;
  $$('[data-k]', root).forEach(b => b.onclick = () => { PV.k = b.dataset.k; drawParent(root, s); });
  const pf = $('#pf', root); if (pf) { pf.onchange = e => { PV.f = e.target.value; PV.t = $('#pt').value; drawParent(root, s); }; $('#pt').onchange = e => { PV.t = e.target.value; PV.f = $('#pf').value; drawParent(root, s); }; }
  $('#pprint').onclick = () => { const a = $('#pprint-area'); a.innerHTML = `<div class="report">${studentReport(s, from, to, lbl + (from ? ' — من ' + fmtDate(from, false) + ' إلى ' + fmtDate(to, false) : ''), { quran: subj.includes('quran'), noor: subj.includes('noor'), zad: subj.includes('zad'), att: 1, notes: 1, fees: 0 })}</div>`; a.id = 'pp'; printEl('#pp'); a.id = 'pprint-area'; };
}
function parentDay(r, subj) {
  if (r.att === 'a') return '<div class="ln"><span class="chip red">غائب</span></div>' + (r.note ? `<div class="ln">📝 ${esc(r.note)}</div>` : '');
  if (r.att === 'e') return '<div class="ln"><span class="chip blue">مستأذن</span></div>';
  const L = [];
  if (r.att === 'l') L.push('<span class="chip gold">متأخر</span>');
  if (r.hifz && r.hifz.s1) L.push(`📖 <b>الحفظ:</b> ${Q.rangeText(r.hifz)} <span class="muted">(${num(r.hifz.pages)} وجه)</span> ${gradeChip(r.hifz.grade)}`);
  if (r.review && r.review.s1) L.push(`🔁 <b>المراجعة:</b> ${Q.rangeText(r.review)} <span class="muted">(${num(r.review.pages)} وجه)</span> ${gradeChip(r.review.grade)}`);
  if (r.noor && r.noor.lesson) { const N = NOORANIA[r.noor.lesson - 1]; L.push(`🔤 <b>النورانية:</b> ${esc(N.title)}${r.noor.from ? ` <span class="muted">(من «${esc(N.items[r.noor.from - 1] || '')}» إلى «${esc(N.items[r.noor.to - 1] || '')}»)</span>` : ''} ${gradeChip(r.noor.grade)}`); }
  (r.zad || []).forEach(z => { const c = zadCurriculum().find(c => c.id === z.cat) || {}; L.push(`${c.icon || '🌸'} <b>${esc(c.name || '')}:</b> ${esc(z.item)} ${gradeChip(z.grade)}`); });
  if (r.behavior) L.push('السلوك: ' + stars(r.behavior));
  if (r.errors && r.errors.length) {
    L.push(`<div style="margin-top:4px"><b>✏️ الأخطاء والتصويب:</b>${r.errors.map(e => `<div class="small" style="padding:3px 0">${errText(e)}</div>`).join('')}</div>`);
    ['hifz', 'review'].forEach(k => { const errs = r.errors.filter(e => e.sub === k && e.word); if (errs.length && r[k]) { const box = ayahBoxHTML(r[k], errs); if (box) L.push(box.replace('class="ayah-box"', 'class="ayah-box" style="font-size:20px;max-height:200px"')); } });
  }
  if (r.note) L.push(`<div style="background:#fffbea;border-radius:10px;padding:6px 10px;margin-top:4px">📝 <b>ملاحظة المعلم:</b> ${esc(r.note)}</div>`);
  return L.map(x => `<div class="ln">${x}</div>`).join('') || '<div class="ln"><span class="chip green">حاضر</span></div>';
}

/* ——— نموذج التسجيل لأولياء الأمور ——— */
async function viewRegForm(root) {
  root.innerHTML = '<div class="splash"><img src="assets/logo-ibntaymiyah.jpg"><div>جاري التحميل…</div></div>';
  let st = S.settings;
  if (S.server) { try { const r = await api('regInfo'); if (r.ok) { S.data.settings = [Object.assign({ id: 'main' }, r.settings)]; st = S.settings; } } catch (e) {} }
  document.title = 'تسجيل طالب — ' + st.complexName;
  if (st.regClosed) { root.innerHTML = `<div class="splash"><img src="${logoL()}"><h2>التسجيل مغلق حالياً</h2><div>${esc(st.complexName)}</div></div>`; return; }
  root.innerHTML = `<div class="reg-wrap"><div class="p-hero" style="padding-bottom:60px"><div class="logos"><img src="${logoR()}"><img src="${logoL()}"></div><h1>📝 تسجيل طالب جديد</h1><div class="sub">${esc(st.programName)} — ${esc(st.complexName)}</div></div>
    <div class="reg-card"><p style="margin-top:0;color:var(--teal)">${esc(st.regNote || '')}</p><form id="rf">${STU_FIELDS.map(f => fieldHTML(f, '')).join('')}
      <div class="field" id="agebox" style="display:none"><label>العمر بالتاريخ الميلادي</label><div class="chip gold" id="age"></div></div>
      <button class="btn block gold" style="font-size:17px;padding:14px" type="submit">✔️ إرسال التسجيل</button></form></div></div>`;
  $('#f_birthDate').onchange = e => { const a = ageFrom(e.target.value); $('#agebox').style.display = a !== '' ? '' : 'none'; $('#age').textContent = a + ' سنوات'; };
  $('#rf').onsubmit = async e => {
    e.preventDefault(); const o = readForm($('#rf'));
    if (!o.name || o.name.split(/\s+/).length < 3) return toast('اكتب اسم الطالب رباعياً');
    if (normPhone(o.guardianPhone).length < 11) return toast('اكتب رقم جوال ولي الأمر بشكل صحيح');
    o.guardianPhone = normPhone(o.guardianPhone); if (o.phone2) o.phone2 = normPhone(o.phone2);
    o.age = ageFrom(o.birthDate);
    const b = $('#rf button[type=submit]'); b.disabled = true; b.textContent = '⏳ جاري الإرسال…';
    try {
      if (S.server) { const r = await api('register', { student: o }); if (!r.ok) throw new Error(r.error); }
      else save('students', Object.assign(o, { id: uid('s'), status: 'pending', source: 'form', parentToken: token20(), createdAt: Date.now(), direction: st.directionDefault }));
      root.innerHTML = `<div class="reg-wrap"><div class="p-hero" style="padding-bottom:60px"><div class="logos"><img src="${logoR()}"><img src="${logoL()}"></div></div><div class="reg-card" style="text-align:center"><div style="font-size:70px">✅</div><h2 style="color:var(--teal)">تم التسجيل بنجاح</h2><p>جزاكم الله خيراً، تم استلام بيانات الطالب <b>${esc(o.name)}</b>.<br>سيتم التواصل معكم وإرسال رابط متابعة ابنكم بعد تفعيل التسجيل.</p><button class="btn light" onclick="location.reload()">تسجيل طالب آخر</button></div></div>`;
    } catch (er) { toast('⚠️ ' + er.message); b.disabled = false; b.textContent = '✔️ إرسال التسجيل'; }
  };
}
