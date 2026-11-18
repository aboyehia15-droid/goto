/* ===== الشاشات: الهيكل، الرئيسية، الطلاب، التسجيل، الفصول والمعلمون، الرسوم، الأوائل، الإعدادات ===== */
function NAV() {
  const f = features(); const pend = T('students').filter(s => s.status === 'pending').length;
  return [
    { k: 'home', t: 'الرئيسية', ic: '🏠' },
    { k: 'daily', t: 'المتابعة اليومية', ic: '📖' },
    { k: 'students', t: 'الطلاب', ic: '👦', badge: canAdmin() && pend ? pend : '' },
    canAdmin() && { k: 'register', t: 'رابط التسجيل', ic: '📨' },
    canAdmin() && { k: 'classes', t: 'الفصول والمعلمون', ic: '🏫' },
    { k: 'reports', t: 'التقارير', ic: '📊' },
    f.leaders && { k: 'leaders', t: 'الأوائل والترتيب', ic: '🏆' },
    canAdmin() && f.fees && { k: 'fees', t: 'الرسوم', ic: '💰' },
    isAdmin() && { k: 'settings', t: 'الإعدادات', ic: '⚙️' }
  ].filter(Boolean);
}
function shell(active) {
  const st = S.settings; const nav = NAV();
  const bottom = ['home', 'daily', 'reports', 'leaders', 'students'].map(k => nav.find(n => n.k === k)).filter(Boolean);
  return `<div class="layout">
    <aside class="side"><div class="brand"><img src="${logoL()}" alt=""><div><b>${esc(st.complexName)}</b><small>منصة متابعة الحلقات</small></div></div>
      <nav class="nav">${nav.map(n => `<a href="#/${n.k}" class="${active === n.k ? 'on' : ''}"><span class="ic">${n.ic}</span>${n.t}${n.badge ? `<span class="badge">${n.badge}</span>` : ''}</a>`).join('')}
      <a href="#" id="logout-lnk" style="margin-top:20px;opacity:.8"><span class="ic">🚪</span>${isLocal() ? 'وضع محلي' : 'تسجيل الخروج'}</a></nav></aside>
    <div class="main">
      ${isLocal() ? `<div class="mode-banner no-print">💾 يعمل التطبيق الآن على هذا الجهاز فقط. ليصل المعلمون وأولياء الأمور من أجهزتهم <a href="#/settings/server">اربطه بالخادم من هنا</a></div>` : ''}
      <div class="topbar"><div><h1>${esc(st.programName)}</h1><div class="who">${S.me ? '👤 ' + esc(S.me.name) + ' · ' : ''}<span id="sync-st"></span></div></div>
        <div class="logos"><img src="${logoR()}" alt="جمعية تعلم"><img src="${logoL()}" alt="مجمع ابن تيمية"></div></div>
      <div class="content" id="view"></div>
    </div>
    <nav class="bottom-nav">${bottom.map(n => `<a href="#/${n.k}" class="${active === n.k ? 'on' : ''}"><span class="ic">${n.ic}</span>${n.t.split(' ')[0]}</a>`).join('')}<a href="#" id="more-lnk"><span class="ic">☰</span>المزيد</a></nav>
  </div>`;
}
function bindShell() {
  updateSyncBadge();
  const lo = $('#logout-lnk'); if (lo) lo.onclick = async e => { e.preventDefault(); if (isLocal()) { location.hash = '#/settings/server'; return; } if (await confirmBox('تسجيل الخروج من التطبيق؟', 'خروج')) { S.me = null; S.token = null; saveSession(); render(); } };
  const mo = $('#more-lnk'); if (mo) mo.onclick = e => { e.preventDefault(); const m = modal({ title: 'القائمة', body: `<div class="grid g3">${NAV().map(n => `<a class="btn light" style="flex-direction:column;padding:14px" href="#/${n.k}"><span style="font-size:24px">${n.ic}</span>${n.t}</a>`).join('')}</div>`, foot: false }); $$('a', m.body).forEach(a => a.addEventListener('click', () => m.close())); };
}

/* ——— إحصاءات الطالب ——— */
function statsOf(sid, from, to) {
  const rs = recsOf(sid, from, to);
  const o = { hifz: 0, review: 0, total: 0, p: 0, a: 0, l: 0, e: 0, days: 0, gsum: 0, gcnt: 0, noor: 0, noorItems: 0, zad: 0, beh: 0, behN: 0, errors: 0, fixed: 0, points: 0, recs: rs };
  rs.forEach(r => {
    if (r.att) { o[r.att]++; o.days++; }
    if (r.att === 'a' || r.att === 'e') return;
    if (r.hifz && r.hifz.s1) { o.hifz += +r.hifz.pages || 0; if (r.hifz.grade) { o.gsum += r.hifz.grade; o.gcnt++; } }
    if (r.review && r.review.s1) { o.review += +r.review.pages || 0; if (r.review.grade) { o.gsum += r.review.grade; o.gcnt++; } }
    if (r.noor && r.noor.lesson) { o.noor++; o.noorItems += Math.abs((r.noor.to || 0) - (r.noor.from || 0)) + 1; if (r.noor.grade) { o.gsum += r.noor.grade; o.gcnt++; } }
    (r.zad || []).forEach(z => { if (z.item) { o.zad++; if (z.grade) { o.gsum += z.grade; o.gcnt++; } } });
    if (r.behavior) { o.beh += r.behavior; o.behN++; }
    (r.errors || []).forEach(e => { o.errors++; if (e.fixed) o.fixed++; });
  });
  o.total = o.hifz + o.review;
  o.gavg = o.gcnt ? o.gsum / o.gcnt : 0;
  o.attPct = o.days ? Math.round((o.p + o.l) / o.days * 100) : 0;
  o.points = Math.round(o.hifz * 10 + o.review * 3 + o.gsum * 2 + (o.p + o.l * .5) * 2 + o.noorItems * .2 + o.zad * 3 + o.beh);
  return o;
}
function levelOf(o) { const g = o.gavg; if (!o.gcnt) return '—'; return g >= 4.5 ? '🏅 متميز' : g >= 3.8 ? '🌟 ممتاز' : g >= 3 ? '👍 جيد جداً' : g >= 2.3 ? '🙂 جيد' : '📌 يحتاج متابعة'; }
function rankClass(cid, from, to, by = 'total') {
  return studentsOfClass(cid).map(s => ({ s, o: statsOf(s.id, from, to) })).sort((a, b) => (b.o[by] - a.o[by]) || (b.o.points - a.o.points)).map((x, i) => (x.rank = i + 1, x));
}
function periodRange(kind, ref, f, t) {
  ref = ref || todayISO();
  if (kind === 'day') return [ref, ref];
  if (kind === 'week') { const w = weekStart(ref); return [w, addDays(w, 6)]; }
  if (kind === 'month') return monthRange(ref);
  if (kind === 'all') return ['', ''];
  return [f || ref, t || ref];
}

/* ===================== الرئيسية ===================== */
function viewHome(v) {
  const st = S.settings; const today = todayISO();
  const act = activeStudents(); const pend = T('students').filter(s => s.status === 'pending');
  const classes = myClasses(); const teachers = T('users').filter(u => u.role === 'teacher');
  const myStu = S.me && S.me.role === 'teacher' ? act.filter(s => classes.some(c => c.id === s.classId)) : act;
  const todayRecs = T('records').filter(r => r.date === today && myStu.some(s => s.id === r.studentId));
  const present = todayRecs.filter(r => r.att === 'p' || r.att === 'l').length;
  const pagesToday = todayRecs.reduce((a, r) => a + (+(r.hifz || {}).pages || 0) + (+(r.review || {}).pages || 0), 0);
  const steps = [
    { done: !!st.programName && (S.data.settings || []).length, t: 'ضبط بيانات البرنامج والشعارات', l: '#/settings' },
    { done: !!S.server, t: 'ربط التطبيق بالخادم (ليصل المعلمون وأولياء الأمور)', l: '#/settings/server' },
    { done: T('invites').some(i => i.sentAt), t: 'إرسال رابط التسجيل لأولياء الأمور بالواتساب', l: '#/register' },
    { done: act.length > 0, t: 'تفعيل الطلاب المسجلين (أو إضافتهم يدوياً / من Excel)', l: '#/students' },
    { done: teachers.length > 0, t: 'إضافة المعلمين', l: '#/classes/teachers' },
    { done: T('classes').length > 0 && act.some(s => s.classId), t: 'إنشاء الفصول وتوزيع الطلاب عليها', l: '#/classes' },
    { done: T('records').length > 0, t: 'بدء المتابعة اليومية', l: '#/daily' }
  ];
  const doneN = steps.filter(s => s.done).length;
  const [ws, we] = periodRange('week');
  v.innerHTML = `
    <div class="page-head"><h2>السلام عليكم${S.me ? ' ' + esc(S.me.name.split(' ')[0]) : ''} 👋</h2><span class="sp"></span><span class="muted">${fmtDate(today)} · ${hijri(today)}</span></div>
    <div class="grid g4">
      <div class="stat"><span class="i">👦</span><div class="n">${myStu.length}</div><div class="l">طالب نشط</div></div>
      ${canAdmin() ? `<a class="stat" href="#/students/pending" style="text-decoration:none"><span class="i">📝</span><div class="n" style="color:${pend.length ? 'var(--gold)' : ''}">${pend.length}</div><div class="l">بانتظار التفعيل</div></a>` : ''}
      <div class="stat"><span class="i">🏫</span><div class="n">${classes.length}</div><div class="l">فصل</div></div>
      <div class="stat"><span class="i">✅</span><div class="n">${todayRecs.length ? present + '/' + myStu.length : '—'}</div><div class="l">حضور اليوم</div></div>
      <div class="stat"><span class="i">📖</span><div class="n">${num(pagesToday, 1)}</div><div class="l">وجه اليوم (حفظ+مراجعة)</div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      ${canAdmin() && doneN < steps.length ? `<div class="card"><h3>🚀 خطوات البدء <span class="chip gold">${doneN}/${steps.length}</span></h3><div class="steps">${steps.map((s, i) => `<div class="st ${s.done ? 'done' : ''}"><div class="num">${s.done ? '✓' : i + 1}</div><div class="tx">${s.t}</div>${s.done ? '' : `<a class="btn sm light" href="${s.l}">ابدأ</a>`}</div>`).join('')}</div></div>` : ''}
      <div class="card"><h3>⚡ وصول سريع</h3><div class="grid g2">
        <a class="btn" href="#/daily">📖 تسجيل اليوم</a><a class="btn light" href="#/reports">📊 التقارير</a>
        ${features().leaders ? '<a class="btn gold" href="#/leaders">🏆 الأوائل</a><a class="btn light" href="#/tv">📺 شاشة الأوائل</a>' : ''}
        ${canAdmin() ? '<a class="btn light" href="#/register">📨 رابط التسجيل</a><a class="btn light" href="#/students/new">➕ طالب جديد</a>' : ''}
      </div></div>
      ${classes.map(c => { const rk = rankClass(c.id, ws, we).slice(0, 3); return `<div class="card"><h3>🏆 أوائل الأسبوع — ${esc(c.name)}</h3>${rk.length && rk[0].o.total + rk[0].o.points > 0 ? rk.map((x, i) => `<div class="rank-row"><div class="r">${['🥇', '🥈', '🥉'][i]}</div><div style="flex:1"><b>${esc(x.s.name)}</b><div class="small muted">${num(x.o.total)} وجه · ${x.o.points} نقطة</div></div></div>`).join('') : '<div class="empty small">لا توجد تسجيلات هذا الأسبوع بعد</div>'}</div>`; }).join('')}
    </div>`;
}

/* ===================== الطلاب ===================== */
const STU_FIELDS = [
  ['name', 'اسم الطالب رباعياً', 'text', 1], ['idNumber', 'السجل المدني / الإقامة', 'text'], ['nationality', 'الجنسية', 'text'], ['birthDate', 'تاريخ الميلاد', 'date'],
  ['guardianName', 'اسم ولي الأمر', 'text'], ['guardianId', 'رقم هوية ولي الأمر', 'text'], ['guardianPhone', 'جوال ولي الأمر (واتساب)', 'tel', 1], ['phone2', 'جوال آخر عند الضرورة', 'tel'],
  ['relation', 'صلة القرابة', 'select:أب|أم|أخ|جد|عم|خال|أخرى'], ['work', 'جهة العمل', 'text'],
  ['background', 'هل لدى الطالب خلفية سابقة عن الحروف والأرقام وبعض السور؟', 'textarea'],
  ['health', 'هل يعاني الطالب من أمراض أو حساسية من أنواع الطعام أو الحلويات؟', 'textarea']
];
function fieldHTML(f, val) {
  const [k, l, type, req] = f; const id = 'f_' + k;
  let inp;
  if (type.startsWith('select:')) inp = `<select class="inp" id="${id}" name="${k}"><option value="">—</option>${type.slice(7).split('|').map(o => `<option ${val === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  else if (type === 'textarea') inp = `<textarea class="inp" id="${id}" name="${k}" rows="2">${esc(val || '')}</textarea>`;
  else inp = `<input class="inp" id="${id}" name="${k}" type="${type}" value="${esc(val || '')}" ${type === 'tel' ? 'inputmode="tel" dir="ltr" placeholder="05xxxxxxxx"' : ''} ${req ? 'required' : ''}>`;
  return `<div class="field"><label for="${id}" class="${req ? 'req' : ''}">${l}</label>${inp}</div>`;
}
function readForm(root) { const o = {}; $$('[name]', root).forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; }
function classOptions(sel, empty = '— بدون فصل —') { return `<option value="">${empty}</option>` + T('classes').map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}${teacherOf(c) ? ' — ' + esc(teacherOf(c).name) : ''}</option>`).join(''); }
function studentForm(st) {
  st = st || { status: 'active', direction: S.settings.directionDefault };
  const body = document.createElement('div');
  body.innerHTML = `<div class="grid g2">${STU_FIELDS.map(f => fieldHTML(f, st[f[0]])).join('')}</div>
    <div class="grid g3">
      <div class="field"><label>الفصل / الحلقة</label><select class="inp" name="classId">${classOptions(st.classId)}</select></div>
      <div class="field"><label>الحالة</label><select class="inp" name="status"><option value="active" ${st.status === 'active' ? 'selected' : ''}>نشط</option><option value="pending" ${st.status === 'pending' ? 'selected' : ''}>بانتظار التفعيل</option><option value="archived" ${st.status === 'archived' ? 'selected' : ''}>مؤرشف</option></select></div>
      <div class="field"><label>اتجاه الحفظ</label><select class="inp" name="direction"><option value="desc" ${st.direction !== 'asc' ? 'selected' : ''}>من الناس صعوداً (جزء عم أولاً)</option><option value="asc" ${st.direction === 'asc' ? 'selected' : ''}>من الفاتحة والبقرة نزولاً</option></select></div>
      ${features().fees ? `<div class="field"><label>الرسوم المقررة (${S.settings.currency})</label><input class="inp" type="number" name="fee" value="${st.fee != null && st.fee !== '' ? st.fee : (S.settings.feeDefault || '')}"></div>` : ''}
      <div class="field"><label>ملاحظات إدارية</label><input class="inp" name="adminNote" value="${esc(st.adminNote || '')}"></div>
    </div>`;
  const m = modal({ title: st.id ? 'تعديل بيانات الطالب' : 'إضافة طالب', body, wide: true, foot: `<button class="btn" data-save>💾 حفظ</button><button class="btn ghost" data-close2>إلغاء</button>` });
  $('[data-close2]', m.el).onclick = () => m.close();
  $('[data-save]', m.el).onclick = () => {
    const o = readForm(body);
    if (!o.name) return toast('اكتب اسم الطالب');
    const dup = T('students').find(x => x.id !== st.id && x.idNumber && o.idNumber && x.idNumber === o.idNumber);
    if (dup) return toast('⚠️ رقم السجل مكرر مع: ' + dup.name);
    const obj = Object.assign({}, st, o);
    if (!obj.id) { obj.id = uid('s'); obj.createdAt = Date.now(); obj.source = 'manual'; }
    if (!obj.parentToken) obj.parentToken = token20();
    obj.fee = o.fee === '' || o.fee == null ? '' : +o.fee;
    save('students', obj); m.close(); toast('✔️ تم الحفظ'); render();
  };
}
function studentCard(st) {
  const c = classOf(st); const age = ageFrom(st.birthDate);
  return `<div class="list-item" data-id="${st.id}">
    <input type="checkbox" class="sel" data-id="${st.id}" style="width:18px;height:18px">
    <div class="avatar" style="background:${colorOf(st.name)}">${initials(st.name)}</div>
    <div style="flex:1;min-width:0"><b>${esc(st.name)}</b>
      <div class="row small" style="margin-top:3px">${c ? `<span class="chip">🏫 ${esc(c.name)}</span>` : '<span class="chip gray">بدون فصل</span>'}${age !== '' ? `<span class="chip gray">${age} سنوات</span>` : ''}${st.guardianPhone ? `<span class="muted" dir="ltr">${esc(st.guardianPhone)}</span>` : ''}${st.health && !/^(لا|لايوجد|لا يوجد|-)$/.test(st.health.trim()) ? '<span class="chip red" title="' + esc(st.health) + '">⚕️ تنبيه صحي</span>' : ''}${st.source === 'form' ? '<span class="chip blue">سجّل بالرابط</span>' : ''}</div></div>
    <div class="row">
      ${st.status === 'pending' ? `<button class="btn sm gold" data-act="activate">✔️ تفعيل</button>` : ''}
      <button class="btn sm light" data-act="menu">⋯</button>
    </div></div>`;
}
function studentMenu(st) {
  const f = features();
  const m = modal({ title: esc(st.name), body: `<div class="grid g2">
    <button class="btn light" data-a="edit">✏️ تعديل البيانات</button>
    ${f.parentPage ? `<button class="btn light" data-a="page">👁️ صفحة الطالب</button><button class="btn wa" data-a="wa">💬 إرسال الرابط لولي الأمر</button><button class="btn light" data-a="copy">📋 نسخ رابط ولي الأمر</button>` : ''}
    <button class="btn light" data-a="report">📊 تقرير الطالب</button>
    ${st.status !== 'active' ? '<button class="btn gold" data-a="activate">✔️ تفعيل</button>' : '<button class="btn ghost" data-a="archive">🗄️ أرشفة</button>'}
    ${f.fees && canAdmin() ? '<button class="btn light" data-a="fees">💰 الرسوم</button>' : ''}
    ${isAdmin() ? '<button class="btn red" data-a="del">🗑️ حذف نهائي</button>' : ''}
  </div>
  <div class="card" style="margin-top:12px;font-size:13px">${STU_FIELDS.filter(x => st[x[0]]).map(x => `<div><span class="muted">${x[1]}:</span> ${esc(st[x[0]])}</div>`).join('')}</div>`, foot: false });
  m.body.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (!st.parentToken) { st.parentToken = token20(); save('students', st); }
    if (a === 'edit') { m.close(); studentForm(st); }
    if (a === 'page') window.open(parentLink(st), '_blank');
    if (a === 'copy') copyText(parentLink(st));
    if (a === 'wa') { window.open(waLink(st.guardianPhone, fillTpl(S.settings.waParent, { student: st.name, link: parentLink(st) })), '_blank'); st.linkSentAt = Date.now(); save('students', st); }
    if (a === 'report') { m.close(); location.hash = '#/reports/student/' + st.id; }
    if (a === 'activate') { m.close(); activateDialog([st]); }
    if (a === 'archive') { st.status = 'archived'; save('students', st); m.close(); render(); }
    if (a === 'fees') { m.close(); paymentDialog(st); }
    if (a === 'del') { if (await confirmBox('حذف الطالب «' + st.name + '» وكل سجلاته نهائياً؟')) { T('records').filter(r => r.studentId === st.id).forEach(r => remove('records', r.id)); remove('students', st.id); m.close(); render(); } }
  };
}
function activateDialog(list) {
  const m = modal({ title: 'تفعيل ' + (list.length > 1 ? list.length + ' طلاب' : 'الطالب: ' + esc(list[0].name)), body: `<div class="field"><label>اختر الفصل</label><select class="inp" id="act-cls">${classOptions(list[0].classId, '— اختر لاحقاً —')}</select></div>
    ${!T('classes').length ? '<p class="muted small">لم تُنشأ فصول بعد — يمكنك التفعيل الآن وتوزيعهم لاحقاً من «الفصول والمعلمون».</p>' : ''}
    <label class="row small"><input type="checkbox" id="act-wa"> إرسال رابط متابعة الطالب لولي الأمر بعد التفعيل</label>`,
    foot: `<button class="btn" data-ok>✔️ تفعيل</button>` });
  $('[data-ok]', m.el).onclick = () => {
    const cid = $('#act-cls').value; const sendWa = $('#act-wa').checked;
    list.forEach(st => { st.status = 'active'; if (cid) st.classId = cid; if (!st.parentToken) st.parentToken = token20(); st.activatedAt = Date.now(); save('students', st); });
    m.close(); toast('✔️ تم تفعيل ' + list.length);
    if (sendWa) waQueueDialog(list.map(st => ({ name: st.name, phone: st.guardianPhone, text: fillTpl(S.settings.waParent, { student: st.name, link: parentLink(st) }), onSent: () => { st.linkSentAt = Date.now(); save('students', st); } })), 'إرسال روابط المتابعة');
    render();
  };
}
/* قائمة إرسال واتساب متتابعة (رسالة لكل رقم) */
function waQueueDialog(items, title) {
  items = items.filter(x => x.phone);
  if (!items.length) return toast('لا توجد أرقام جوال');
  let i = 0;
  const m = modal({ title: title || 'إرسال واتساب', body: '<div class="wa-q"></div>', foot: `<button class="btn wa" data-next>▶️ إرسال التالي</button>${S.server && S.settings.waAuto ? '<button class="btn gold" data-auto>⚡ إرسال تلقائي للجميع</button>' : ''}<span class="muted small" style="align-self:center" data-c></span>` });
  const draw = () => { $('.wa-q', m.body).innerHTML = items.map((x, j) => `<div class="it ${x.sent ? 'sent' : ''}"><b style="flex:1">${esc(x.name || '')}</b><span dir="ltr" class="muted small">${esc(x.phone)}</span>${x.sent ? '<span class="chip green">✓ أُرسل</span>' : `<a class="btn sm wa" target="_blank" data-j="${j}" href="${waLink(x.phone, x.text)}">إرسال</a>`}</div>`).join(''); $('[data-c]', m.el).textContent = items.filter(x => x.sent).length + ' / ' + items.length; };
  draw();
  m.body.addEventListener('click', e => { const a = e.target.closest('a[data-j]'); if (!a) return; const x = items[+a.dataset.j]; x.sent = true; x.onSent && x.onSent(); setTimeout(draw, 300); });
  $('[data-next]', m.el).onclick = () => { const x = items.find(y => !y.sent); if (!x) return toast('✔️ تم الإرسال للجميع'); window.open(waLink(x.phone, x.text), '_blank'); x.sent = true; x.onSent && x.onSent(); draw(); };
  const au = $('[data-auto]', m.el); if (au) au.onclick = async () => { au.disabled = true; au.textContent = '⏳ جاري الإرسال…'; try { const r = await api('sendWA', { messages: items.filter(x => !x.sent).map(x => ({ to: '+' + normPhone(x.phone), body: x.text })) }); if (!r.ok) throw new Error(r.error); r.results.forEach(res => { const x = items.find(y => '+' + normPhone(y.phone) === res.to); if (x && res.ok) { x.sent = true; x.onSent && x.onSent(); } }); draw(); toast('✔️ تم الإرسال التلقائي'); } catch (e) { toast('⚠️ ' + e.message); } au.disabled = false; au.textContent = '⚡ إرسال تلقائي للجميع'; };
}
function viewStudents(v, sub) {
  if (sub === 'new') { setTimeout(() => studentForm(), 50); history.replaceState(null, '', '#/students'); }
  const tab = ['pending', 'archived'].includes(sub) ? sub : 'active';
  const counts = { active: 0, pending: 0, archived: 0 }; T('students').forEach(s => counts[s.status] = (counts[s.status] || 0) + 1);
  const my = myClasses().map(c => c.id);
  v.innerHTML = `
    <div class="page-head"><h2>👦 الطلاب</h2><span class="sp"></span>
      ${canAdmin() ? `<button class="btn" id="add-stu">➕ طالب</button><button class="btn light" id="imp-stu">📥 استيراد Excel</button><button class="btn light" id="exp-stu">📤 تصدير</button>` : ''}</div>
    <div class="tabs"><button data-t="active" class="${tab === 'active' ? 'on' : ''}">نشط (${counts.active})</button>${canAdmin() ? `<button data-t="pending" class="${tab === 'pending' ? 'on' : ''}">بانتظار التفعيل (${counts.pending})</button><button data-t="archived" class="${tab === 'archived' ? 'on' : ''}">مؤرشف (${counts.archived})</button>` : ''}</div>
    <div class="card" style="padding:10px"><div class="row"><div class="search grow"><input class="inp" id="q" placeholder="بحث بالاسم أو الجوال أو السجل"></div>
      <select class="inp" id="fcls" style="width:auto">${classOptions('', 'كل الفصول')}<option value="none">بدون فصل</option></select></div>
      <div class="row" style="margin-top:8px"><label class="row small"><input type="checkbox" id="selall"> تحديد الكل</label><span class="sp" style="flex:1"></span>
      ${canAdmin() ? `${tab === 'pending' ? '<button class="btn sm gold" id="bulk-act">✔️ تفعيل المحدد</button>' : ''}<button class="btn sm light" id="bulk-cls">🏫 نقل لفصل</button>` : ''}<button class="btn sm wa" id="bulk-wa">💬 إرسال روابط المتابعة</button></div></div>
    <div class="card" style="padding:4px 6px" id="stu-list"></div>`;
  const draw = () => {
    const q = Q.norm($('#q').value); const fc = $('#fcls').value;
    let list = T('students').filter(s => (s.status || 'active') === tab);
    if (S.me && S.me.role === 'teacher') list = list.filter(s => my.includes(s.classId));
    if (fc) list = list.filter(s => fc === 'none' ? !s.classId : s.classId === fc);
    if (q) list = list.filter(s => Q.norm(s.name).includes(q) || String(s.guardianPhone || '').includes(q) || String(s.idNumber || '').includes(q));
    list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    $('#stu-list').innerHTML = list.length ? list.map(studentCard).join('') : `<div class="empty"><span class="e">${tab === 'pending' ? '📭' : '👦'}</span>${tab === 'pending' ? 'لا توجد طلبات تسجيل جديدة. أرسل رابط التسجيل لأولياء الأمور من «رابط التسجيل».' : 'لا يوجد طلاب'}</div>`;
  };
  draw();
  $('#q').oninput = draw; $('#fcls').onchange = draw;
  $$('.tabs button', v).forEach(b => b.onclick = () => location.hash = '#/students/' + b.dataset.t);
  const selected = () => $$('.sel:checked', v).map(c => byId('students', c.dataset.id)).filter(Boolean);
  $('#selall').onchange = e => $$('.sel', v).forEach(c => c.checked = e.target.checked);
  $('#stu-list').onclick = e => { const b = e.target.closest('[data-act]'); const it = e.target.closest('.list-item'); if (!it) return; const st = byId('students', it.dataset.id); if (b && b.dataset.act === 'activate') activateDialog([st]); else if (b || !e.target.classList.contains('sel')) studentMenu(st); };
  const ba = $('#bulk-act'); if (ba) ba.onclick = () => { const s = selected(); if (!s.length) return toast('حدد طلاباً أولاً'); activateDialog(s); };
  const bc = $('#bulk-cls'); if (bc) bc.onclick = () => { const s = selected(); if (!s.length) return toast('حدد طلاباً أولاً'); const m = modal({ title: 'نقل ' + s.length + ' طالب إلى فصل', body: `<select class="inp" id="mv">${classOptions('')}</select>`, foot: '<button class="btn" data-ok>نقل</button>' }); $('[data-ok]', m.el).onclick = () => { s.forEach(x => { x.classId = $('#mv').value; save('students', x); }); m.close(); render(); }; };
  $('#bulk-wa').onclick = () => { let s = selected(); if (!s.length) s = T('students').filter(x => x.status === tab); waQueueDialog(s.map(st => { if (!st.parentToken) { st.parentToken = token20(); save('students', st); } return { name: st.name, phone: st.guardianPhone, text: fillTpl(S.settings.waParent, { student: st.name, link: parentLink(st) }), onSent: () => { st.linkSentAt = Date.now(); save('students', st); } }; }), 'إرسال روابط متابعة الطلاب لأولياء الأمور'); };
  const ad = $('#add-stu'); if (ad) ad.onclick = () => studentForm();
  const im = $('#imp-stu'); if (im) im.onclick = importStudentsDialog;
  const ex = $('#exp-stu'); if (ex) ex.onclick = async () => { await loadXLSX(); const rows = T('students').map(s => { const o = {}; STU_FIELDS.forEach(f => o[f[1]] = s[f[0]] || ''); o['العمر'] = ageFrom(s.birthDate); o['الفصل'] = (classOf(s) || {}).name || ''; o['الحالة'] = { active: 'نشط', pending: 'بانتظار التفعيل', archived: 'مؤرشف' }[s.status] || ''; o['رابط ولي الأمر'] = s.parentToken ? parentLink(s) : ''; return o; }); const ws = XLSX.utils.json_to_sheet(rows); ws['!views'] = [{ RTL: true }]; const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, 'بيانات الطلاب'); XLSX.writeFile(wb, 'بيانات الطلاب.xlsx'); };
}
function importStudentsDialog() {
  const m = modal({ title: '📥 استيراد الطلاب من Excel', body: `
    <p class="small muted">يقبل ملف «كشف بيانات الطلاب» (ردود نموذج التسجيل) كما هو، أو أي ملف فيه عمود «الإسم». يتعرف التطبيق على الأعمدة تلقائياً.</p>
    <input type="file" class="inp" id="xf" accept=".xlsx,.xls,.csv">
    <div class="grid g2" style="margin-top:10px"><div class="field"><label>حالة الطلاب المستوردين</label><select class="inp" id="xst"><option value="active">نشط مباشرة</option><option value="pending">بانتظار التفعيل</option></select></div>
    <div class="field"><label>إلحاقهم بفصل</label><select class="inp" id="xcls">${classOptions('')}</select></div></div>
    <div id="xprev"></div>`, foot: '<button class="btn" data-ok disabled>استيراد</button>' });
  let rows = [];
  $('#xf', m.el).onchange = async e => {
    await loadXLSX(); const f = e.target.files[0]; if (!f) return;
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    rows = [];
    wb.SheetNames.forEach(sn => {
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
      let hi = aoa.findIndex(r => r.some(c => /اسم الطالب|الإسم|الاسم/.test(String(c))));
      if (hi < 0) return;
      const H = aoa[hi].map(h => String(h).trim());
      const col = re => H.findIndex(h => re.test(h));
      const map = { name: col(/اسم الطالب|^الإسم|^الاسم/), idNumber: col(/السجل|الاقامة|الإقامة/), nationality: col(/الجنسية/), birthDate: col(/تاريخ الميلاد/), guardianName: col(/اسم ولي/), guardianId: col(/هوية ولي/), guardianPhone: col(/جوال ولي|جوال الأب|الجوال/), phone2: col(/جوال آخر|جوال اخر/), relation: col(/صلة/), work: col(/جهة العمل/), background: col(/خلفية/), health: col(/أمراض|امراض|حساسية/), className: col(/الفصل|الحلقة/) };
      for (let i = hi + 1; i < aoa.length; i++) {
        const r = aoa[i]; const o = {};
        for (const k in map) if (map[k] >= 0) { let val = r[map[k]]; if (val instanceof Date) val = toISO(val); o[k] = String(val == null ? '' : val).trim(); }
        if (!o.name || /^\d+$/.test(o.name)) continue;
        if (rows.some(x => Q.norm(x.name) === Q.norm(o.name))) continue;
        rows.push(o);
      }
    });
    const exist = rows.filter(o => T('students').some(s => Q.norm(s.name) === Q.norm(o.name) || (o.idNumber && s.idNumber === o.idNumber)));
    $('#xprev', m.el).innerHTML = `<div class="card"><b>${rows.length}</b> طالب في الملف${exist.length ? ` — <span class="chip gold">${exist.length} موجود مسبقاً سيتم تحديثه</span>` : ''}<div class="small muted" style="margin-top:6px;max-height:160px;overflow:auto">${rows.slice(0, 80).map(r => esc(r.name)).join('، ')}</div></div>`;
    $('[data-ok]', m.el).disabled = !rows.length;
  };
  $('[data-ok]', m.el).onclick = () => {
    const stt = $('#xst', m.el).value; const cid = $('#xcls', m.el).value; let n = 0;
    rows.forEach(o => {
      let cls = cid; if (!cls && o.className) { const c = T('classes').find(c => Q.norm(c.name) === Q.norm(o.className)); if (c) cls = c.id; }
      delete o.className;
      const ex = T('students').find(s => Q.norm(s.name) === Q.norm(o.name) || (o.idNumber && s.idNumber === o.idNumber));
      const obj = Object.assign(ex || { id: uid('s'), createdAt: Date.now(), source: 'excel', status: stt, parentToken: token20(), direction: S.settings.directionDefault }, Object.fromEntries(Object.entries(o).filter(([k, v]) => v)));
      if (cls) obj.classId = cls; save('students', obj); n++;
    });
    m.close(); toast('✔️ تم استيراد ' + n + ' طالب'); render();
  };
}

/* ===================== رابط التسجيل والدعوات ===================== */
function viewRegister(v) {
  const st = S.settings; const link = regLink();
  const inv = T('invites').slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const regPhones = new Set(T('students').map(s => normPhone(s.guardianPhone)));
  v.innerHTML = `
    <div class="page-head"><h2>📨 رابط التسجيل لأولياء الأمور</h2></div>
    ${isLocal() ? '<div class="card" style="background:#fff8e1"><b>⚠️ تنبيه:</b> التطبيق في الوضع المحلي، ولن تصل بيانات من يسجل بالرابط إلى جهازك. <a href="#/settings/server">اربطه بالخادم أولاً</a> ثم أرسل الرابط.</div>' : ''}
    <div class="grid g2">
      <div class="card"><h3>🔗 رابط نموذج التسجيل</h3>
        <p class="small muted">نموذج التسجيل مبني على أعمدة «كشف بيانات الطلاب»: الاسم رباعياً، السجل المدني، الجنسية، تاريخ الميلاد (والعمر يُحسب تلقائياً)، بيانات ولي الأمر وجوالاته، صلة القرابة، جهة العمل، الخلفية السابقة، الحالة الصحية.</p>
        <div class="row"><input class="inp grow" value="${esc(link)}" readonly dir="ltr" style="font-size:12px"><button class="btn sm" id="cp">📋 نسخ</button><a class="btn sm light" target="_blank" href="${esc(link)}">👁️ معاينة</a></div>
        <div class="toggle-row"><span>استقبال التسجيلات <span class="small muted">(إغلاقه يوقف النموذج)</span></span><label class="switch"><input type="checkbox" id="regopen" ${st.regClosed ? '' : 'checked'}><span></span></label></div>
        <div class="row" style="margin-top:10px"><button class="btn gold" id="poster">🖨️ طباعة ملصق بالباركود QR</button></div>
      </div>
      <div class="card"><h3>✉️ نص رسالة الدعوة</h3><textarea class="inp" id="tpl" rows="6">${esc(st.waInvite)}</textarea><div class="small muted">المتغيرات: {link} الرابط، {complex} اسم المجمع، {program} اسم البرنامج، {name} اسم المستلم</div><button class="btn sm light" id="savetpl" style="margin-top:6px">💾 حفظ النص</button></div>
    </div>
    <div class="card"><h3>📱 أرقام أولياء الأمور</h3>
      <div class="grid g2">
        <div><textarea class="inp" id="nums" rows="5" placeholder="الصق الأرقام هنا — رقم في كل سطر، ويمكن كتابة الاسم قبله:&#10;0551234567&#10;أبو خالد 0559876543"></textarea>
        <div class="row" style="margin-top:6px"><button class="btn" id="addnums">➕ إضافة للقائمة</button><button class="btn light" id="impnums">📥 من ملف Excel</button></div></div>
        <div class="card" style="background:#f3faf8;margin:0"><b>كيف يعمل الإرسال؟</b><ol class="small" style="margin:6px 0;padding-inline-start:18px;line-height:1.9">
          <li>أضف الأرقام (لصقاً أو من Excel).</li><li>اضغط «▶️ إرسال التالي» — يفتح الواتساب برسالة جاهزة، اضغط إرسال ثم عد للتطبيق للرقم التالي.</li>
          <li>للإرسال الآلي الكامل دون تدخل: فعّل «مزود الواتساب» من الإعدادات.</li><li>من يسجل يظهر في «الطلاب ← بانتظار التفعيل»، وتظهر علامة ✓ سجّل بجانب رقمه هنا.</li></ol></div>
      </div>
      <div class="row" style="margin:12px 0 6px"><b>القائمة (${inv.length})</b><span class="chip green">أُرسل ${inv.filter(i => i.sentAt).length}</span><span class="chip blue">سجّل ${inv.filter(i => regPhones.has(normPhone(i.phone))).length}</span><span style="flex:1"></span>
        <button class="btn wa sm" id="sendall">▶️ إرسال للجميع</button><button class="btn ghost sm" id="clearinv">🗑️ مسح القائمة</button></div>
      <div class="wa-q">${inv.length ? inv.map(i => `<div class="it ${i.sentAt ? 'sent' : ''}"><span style="flex:1">${esc(i.name || '—')}</span><span dir="ltr" class="small">${esc(i.phone)}</span>${regPhones.has(normPhone(i.phone)) ? '<span class="chip blue">✓ سجّل</span>' : ''}${i.sentAt ? '<span class="chip green">أُرسل</span>' : ''}<a class="btn sm wa" target="_blank" data-inv="${i.id}" href="${waLink(i.phone, fillTpl(st.waInvite, { link, name: i.name || '' }))}">${i.sentAt ? 'إعادة' : 'إرسال'}</a><button class="btn sm ghost" data-delinv="${i.id}">✕</button></div>`).join('') : '<div class="empty small">لم تُضف أرقام بعد</div>'}</div>
    </div>`;
  $('#cp').onclick = () => copyText(link);
  $('#regopen').onchange = e => { saveSettings({ regClosed: !e.target.checked }); toast(e.target.checked ? 'التسجيل مفتوح' : 'التسجيل مغلق'); };
  $('#savetpl').onclick = () => { saveSettings({ waInvite: $('#tpl').value }); toast('✔️ حُفظ النص'); };
  const addLines = lines => { let n = 0; lines.forEach(l => { const m = String(l).match(/(\+?\d[\d\s-]{7,})/); if (!m) return; const phone = normPhone(m[1]); if (phone.length < 9 || T('invites').some(i => normPhone(i.phone) === phone)) return; const name = String(l).replace(m[1], '').replace(/[,،:-]/g, ' ').trim(); save('invites', { id: uid('i'), phone, name, createdAt: Date.now() }); n++; }); toast('✔️ أُضيف ' + n + ' رقم'); render(); };
  $('#addnums').onclick = () => addLines($('#nums').value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).split(/\n/));
  $('#impnums').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv'; i.onchange = async () => { await loadXLSX(); const wb = XLSX.read(await i.files[0].arrayBuffer()); const lines = []; wb.SheetNames.forEach(sn => XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }).forEach(r => { const ph = r.find(c => /^\+?\d[\d\s-]{7,}$/.test(String(c).trim()) && /^(\+?966|05|5|00966)/.test(String(c).trim())); if (ph) { const nm = r.find(c => /[؀-ۿ]{3,}/.test(String(c))); lines.push((nm || '') + ' ' + ph); } })); addLines(lines); }; i.click(); };
  v.querySelector('.wa-q').onclick = async e => { const a = e.target.closest('[data-inv]'); if (a) { const i = byId('invites', a.dataset.inv); i.sentAt = Date.now(); save('invites', i); setTimeout(render, 400); } const d = e.target.closest('[data-delinv]'); if (d) { remove('invites', d.dataset.delinv); render(); } };
  $('#sendall').onclick = () => waQueueDialog(T('invites').filter(i => !i.sentAt).map(i => ({ name: i.name, phone: i.phone, text: fillTpl(S.settings.waInvite, { link, name: i.name || '' }), onSent: () => { i.sentAt = Date.now(); save('invites', i); } })), 'إرسال رابط التسجيل');
  $('#clearinv').onclick = async () => { if (await confirmBox('مسح كل الأرقام من القائمة؟')) { T('invites').slice().forEach(i => remove('invites', i.id)); render(); } };
  $('#poster').onclick = async () => {
    await loadQR();
    const w = window.open('', '_blank');
    w.document.write(`<html dir="rtl"><head><title>ملصق التسجيل</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;800&display=swap" rel="stylesheet"><style>body{font-family:Tajawal;text-align:center;padding:30px;color:#0f5c55}.lg{display:flex;justify-content:space-between}.lg img{height:110px}h1{font-size:40px;margin:20px 0 6px}h2{color:#c9a227;margin:0 0 20px}#qr{display:inline-block;padding:16px;border:6px solid #c9a227;border-radius:20px}p{font-size:20px;color:#333}</style></head><body><div class="lg"><img src="${new URL(logoR(), location.href)}"><img src="${new URL(logoL(), location.href)}"></div><h1>سجّل ابنك الآن</h1><h2>${esc(st.programName)} — ${esc(st.complexName)}</h2><div id="qr"></div><p>امسح الرمز بكاميرا الجوال لفتح نموذج التسجيل</p><p style="font-size:13px;direction:ltr">${esc(link)}</p></body></html>`);
    w.document.close();
    const s = w.document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'; s.onload = () => { new w.QRCode(w.document.getElementById('qr'), { text: link, width: 280, height: 280, colorDark: '#0f5c55' }); setTimeout(() => w.print(), 700); }; w.document.body.appendChild(s);
  };
}

/* ===================== الفصول والمعلمون ===================== */
const TRACKS = { quran: 'قرآن', noor: 'نورانية', mixed: 'قرآن ونورانية' };
function viewClasses(v, sub) {
  const tab = sub === 'teachers' ? 'teachers' : 'classes';
  v.innerHTML = `<div class="page-head"><h2>🏫 الفصول والمعلمون</h2><span class="sp"></span><button class="btn" id="addbtn">${tab === 'teachers' ? '➕ معلم / مستخدم' : '➕ فصل'}</button></div>
    <div class="tabs"><button class="${tab === 'classes' ? 'on' : ''}" data-t="classes">الفصول (${T('classes').length})</button><button class="${tab === 'teachers' ? 'on' : ''}" data-t="teachers">المعلمون والمستخدمون (${T('users').length})</button></div><div id="cl"></div>`;
  $$('.tabs button', v).forEach(b => b.onclick = () => location.hash = '#/classes/' + b.dataset.t);
  const box = $('#cl');
  if (tab === 'classes') {
    $('#addbtn').onclick = () => classForm();
    const cls = T('classes').slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const noCls = activeStudents().filter(s => !s.classId).length;
    box.innerHTML = (noCls ? `<div class="card" style="background:#fff8e1">⚠️ يوجد <b>${noCls}</b> طالب نشط بدون فصل. افتح الفصل واضغط «👦 الطلاب» لإضافتهم.</div>` : '') + (cls.length ? `<div class="grid g3">${cls.map(c => { const t = teacherOf(c); const n = studentsOfClass(c.id).length; return `<div class="card"><h3><span class="avatar" style="width:36px;height:36px;font-size:14px;background:${colorOf(c.name)}">${initials(c.name)}</span>${esc(c.name)}</h3>
      <div class="small">👨‍🏫 ${t ? esc(t.name) : '<span class="muted">لم يُحدد معلم</span>'}</div><div class="row small" style="margin:8px 0"><span class="chip">${TRACKS[c.track] || 'قرآن'}</span><span class="chip gold">${n} طالب</span>${(c.subjects || ['quran', 'noor', 'zad']).map(x => `<span class="chip gray">${{ quran: 'القرآن', noor: 'النورانية', zad: 'زاد الطفل' }[x]}</span>`).join('')}</div>
      <div class="row"><button class="btn sm light" data-stu="${c.id}">👦 الطلاب</button><button class="btn sm light" data-edit="${c.id}">✏️ تعديل</button><a class="btn sm" href="#/daily/${c.id}">📖 المتابعة</a></div></div>`; }).join('')}</div>` : '<div class="card empty"><span class="e">🏫</span>أنشئ أول فصل واكتب اسمه واختر معلمه</div>');
    box.onclick = e => { const s = e.target.closest('[data-stu]'); if (s) classStudentsDialog(byId('classes', s.dataset.stu)); const ed = e.target.closest('[data-edit]'); if (ed) classForm(byId('classes', ed.dataset.edit)); };
  } else {
    $('#addbtn').onclick = () => userForm();
    const us = T('users').slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const loginLink = appBase() + (S.server ? '?s=' + encodeURIComponent(S.server) : '');
    box.innerHTML = `${S.server ? `<div class="card"><b>🔑 رابط دخول المعلمين:</b> أرسله للمعلم مع اسم المستخدم وكلمة المرور ليثبّت التطبيق على جواله.<div class="row" style="margin-top:6px"><input class="inp grow" readonly dir="ltr" value="${esc(loginLink)}" style="font-size:12px"><button class="btn sm" id="cpl">📋 نسخ</button></div></div>` : '<div class="card" style="background:#fff8e1">في الوضع المحلي تُستخدم أسماء المعلمين للفصول والتقارير فقط. بعد الربط بالخادم يدخل كل معلم بحسابه ويرى فصوله فقط.</div>'}
      <div class="card" style="padding:4px 8px">${us.length ? us.map(u => `<div class="list-item"><div class="avatar" style="background:${colorOf(u.name)}">${initials(u.name)}</div><div style="flex:1"><b>${esc(u.name)}</b><div class="small muted">${{ admin: '👑 مدير', supervisor: '🧭 مشرف', teacher: '👨‍🏫 معلم' }[u.role] || ''} · ${esc(u.username || '')} ${u.phone ? '· <span dir="ltr">' + esc(u.phone) + '</span>' : ''} ${u.active === false ? '<span class="chip red">موقوف</span>' : ''}</div>
      <div class="row small">${T('classes').filter(c => c.teacherId === u.id).map(c => `<span class="chip">${esc(c.name)}</span>`).join('')}</div></div>
      ${u.phone && S.server ? `<a class="btn sm wa" target="_blank" href="${waLink(u.phone, 'السلام عليكم أستاذ ' + u.name + '\nرابط دخول منصة متابعة الحلقات:\n' + loginLink + '\nاسم المستخدم: ' + (u.username || ''))}">💬</a>` : ''}<button class="btn sm light" data-u="${u.id}">✏️</button></div>`).join('') : '<div class="empty"><span class="e">👨‍🏫</span>أضف المعلمين ليتم ربطهم بالفصول</div>'}</div>`;
    const cpl = $('#cpl'); if (cpl) cpl.onclick = () => copyText(loginLink);
    box.onclick = e => { const b = e.target.closest('[data-u]'); if (b) userForm(byId('users', b.dataset.u)); };
  }
}
function classForm(c) {
  c = c || { subjects: ['quran', 'noor', 'zad'], track: 'mixed' };
  const teachers = T('users').filter(u => u.role !== 'admin' || true);
  const m = modal({ title: c.id ? 'تعديل الفصل' : 'فصل جديد', body: `
    <div class="field"><label class="req">اسم الفصل / الحلقة</label><input class="inp" id="cn" value="${esc(c.name || '')}" placeholder="مثال: فصل الصديق — براعم ١"></div>
    <div class="field"><label>المعلم</label><div class="row"><select class="inp grow" id="ct"><option value="">— اختر —</option>${teachers.map(u => `<option value="${u.id}" ${c.teacherId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select><button class="btn sm light" id="newt">➕ معلم جديد</button></div></div>
    <div class="field"><label>المسار</label><select class="inp" id="ctr">${Object.entries(TRACKS).map(([k, t]) => `<option value="${k}" ${c.track === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label>المواد التي تُتابَع في هذا الفصل</label><div class="row">${[['quran', '📖 القرآن (حفظ ومراجعة)'], ['noor', '🔤 القاعدة النورانية'], ['zad', '🌸 زاد الطفل المسلم']].map(([k, t]) => `<label class="chip" style="padding:7px 12px"><input type="checkbox" class="csub" value="${k}" ${(c.subjects || []).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
    <div class="field"><label>وقت الحلقة (اختياري)</label><input class="inp" id="ctime" value="${esc(c.time || '')}" placeholder="مثال: ٤:٠٠ – ٦:٠٠ عصراً"></div>`,
    foot: `<button class="btn" data-ok>💾 حفظ</button>${c.id ? '<button class="btn red" data-del>🗑️ حذف</button>' : ''}` });
  $('#newt', m.el).onclick = () => { const n = prompt('اسم المعلم'); if (!n) return; const u = save('users', { id: uid('u'), name: n.trim(), role: 'teacher', active: true, username: '' }); $('#ct', m.el).insertAdjacentHTML('beforeend', `<option value="${u.id}" selected>${esc(u.name)}</option>`); toast('أُضيف المعلم — أكمل بياناته من تبويب المعلمين'); };
  $('[data-ok]', m.el).onclick = () => {
    const name = $('#cn', m.el).value.trim(); if (!name) return toast('اكتب اسم الفصل');
    Object.assign(c, { name, teacherId: $('#ct', m.el).value, track: $('#ctr', m.el).value, time: $('#ctime', m.el).value, subjects: $$('.csub:checked', m.el).map(x => x.value) });
    if (!c.id) c.id = uid('c'); save('classes', c); m.close(); render(); if (!studentsOfClass(c.id).length && activeStudents().some(s => !s.classId)) classStudentsDialog(c);
  };
  const d = $('[data-del]', m.el); if (d) d.onclick = async () => { if (await confirmBox('حذف الفصل؟ (لن يُحذف الطلاب ولا سجلاتهم)')) { activeStudents().filter(s => s.classId === c.id).forEach(s => { s.classId = ''; save('students', s); }); remove('classes', c.id); m.close(); render(); } };
}
function classStudentsDialog(c) {
  const list = activeStudents().slice().sort((a, b) => (a.classId === c.id ? -1 : 0) - (b.classId === c.id ? -1 : 0) || a.name.localeCompare(b.name, 'ar'));
  const m = modal({ title: '👦 طلاب ' + esc(c.name), body: `<div class="search" style="margin-bottom:8px"><input class="inp" id="cq" placeholder="بحث"></div><div id="cs">${list.map(s => `<label class="list-item" data-n="${esc(Q.norm(s.name))}"><input type="checkbox" value="${s.id}" ${s.classId === c.id ? 'checked' : ''} style="width:20px;height:20px"><b style="flex:1">${esc(s.name)}</b>${s.classId && s.classId !== c.id ? `<span class="chip gray">${esc((classOf(s) || {}).name || '')}</span>` : ''}</label>`).join('') || '<div class="empty">لا يوجد طلاب نشطون — فعّل الطلاب أولاً</div>'}</div>`, foot: '<button class="btn" data-ok>💾 حفظ</button><span class="muted small" style="align-self:center" id="ccount"></span>' });
  const cnt = () => $('#ccount', m.el).textContent = $$('#cs input:checked', m.el).length + ' طالب';
  cnt(); $('#cs', m.el).onchange = cnt;
  $('#cq', m.el).oninput = e => { const q = Q.norm(e.target.value); $$('#cs .list-item', m.el).forEach(l => l.style.display = l.dataset.n.includes(q) ? '' : 'none'); };
  $('[data-ok]', m.el).onclick = () => { $$('#cs input', m.el).forEach(i => { const s = byId('students', i.value); if (i.checked && s.classId !== c.id) { s.classId = c.id; save('students', s); } else if (!i.checked && s.classId === c.id) { s.classId = ''; save('students', s); } }); m.close(); render(); };
}
function userForm(u) {
  u = u || { role: 'teacher', active: true };
  const m = modal({ title: u.id ? 'تعديل المستخدم' : 'معلم / مستخدم جديد', body: `<div class="grid g2">
    <div class="field"><label class="req">الاسم</label><input class="inp" id="un" value="${esc(u.name || '')}"></div>
    <div class="field"><label>الجوال (واتساب)</label><input class="inp" id="up" dir="ltr" value="${esc(u.phone || '')}"></div>
    <div class="field"><label>الصلاحية</label><select class="inp" id="ur"><option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>معلم (يرى فصوله فقط)</option><option value="supervisor" ${u.role === 'supervisor' ? 'selected' : ''}>مشرف (يرى الجميع والتقارير)</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>مدير (كل الصلاحيات)</option></select></div>
    <div class="field"><label>اسم المستخدم للدخول</label><input class="inp" id="uu" dir="ltr" value="${esc(u.username || '')}"></div>
    <div class="field"><label>${u.id ? 'كلمة مرور جديدة (اتركها فارغة لعدم التغيير)' : 'كلمة المرور'}</label><input class="inp" id="upw" dir="ltr" type="text"></div>
    <div class="toggle-row"><span>الحساب مفعّل</span><label class="switch"><input type="checkbox" id="ua" ${u.active !== false ? 'checked' : ''}><span></span></label></div></div>`,
    foot: `<button class="btn" data-ok>💾 حفظ</button>${u.id && isAdmin() ? '<button class="btn red" data-del>🗑️ حذف</button>' : ''}` });
  $('[data-ok]', m.el).onclick = () => {
    const name = $('#un', m.el).value.trim(); if (!name) return toast('اكتب الاسم');
    const username = $('#uu', m.el).value.trim(); const pw = $('#upw', m.el).value;
    if (username && T('users').some(x => x.id !== u.id && x.username === username)) return toast('اسم المستخدم مستخدم');
    if (!isLocal() && !u.id && username && !pw) return toast('اكتب كلمة المرور');
    Object.assign(u, { name, phone: $('#up', m.el).value.trim(), role: $('#ur', m.el).value, username, active: $('#ua', m.el).checked });
    if (!u.id) u.id = uid('u');
    const row = Object.assign({}, u); if (pw) row.password = pw;
    save('users', row); delete row.password; const i = T('users').findIndex(x => x.id === u.id); T('users')[i] = u; persist();
    m.close(); render();
  };
  const d = $('[data-del]', m.el); if (d) d.onclick = async () => { if (S.me && S.me.id === u.id) return toast('لا يمكنك حذف حسابك'); if (await confirmBox('حذف المستخدم؟')) { remove('users', u.id); m.close(); render(); } };
}

/* ===================== الرسوم ===================== */
function feeOf(st) { return st.fee !== '' && st.fee != null ? +st.fee : (+S.settings.feeDefault || 0); }
function paidOf(st) { return T('payments').filter(p => p.studentId === st.id).reduce((a, p) => a + (+p.amount || 0), 0); }
function viewFees(v) {
  const cur = S.settings.currency;
  v.innerHTML = `<div class="page-head"><h2>💰 الرسوم والسداد</h2><span class="sp"></span><button class="btn light" id="setfee">⚙️ الرسوم الافتراضية: ${num(S.settings.feeDefault || 0)} ${cur}</button></div>
    <div class="grid g4" id="fk"></div>
    <div class="card" style="padding:10px;margin-top:12px"><div class="row"><div class="search grow"><input class="inp" id="fq" placeholder="بحث"></div><select class="inp" id="fc" style="width:auto">${classOptions('', 'كل الفصول')}</select>
      <select class="inp" id="fs" style="width:auto"><option value="">كل الحالات</option><option value="paid">مسدد</option><option value="part">مسدد جزئياً</option><option value="none">غير مسدد</option></select>
      <button class="btn sm wa" id="remind">💬 تذكير غير المسددين</button><button class="btn sm light" id="fexp">📤 Excel</button></div></div>
    <div class="tbl-wrap"><table class="tbl" id="ft"></table></div>`;
  const rows = () => { const q = Q.norm($('#fq').value), c = $('#fc').value, s = $('#fs').value; return activeStudents().filter(st => (!c || st.classId === c) && (!q || Q.norm(st.name).includes(q))).map(st => { const f = feeOf(st), p = paidOf(st); return { st, f, p, r: Math.max(0, f - p), state: p >= f && f > 0 ? 'paid' : p > 0 ? 'part' : f > 0 ? 'none' : 'free' }; }).filter(x => !s || x.state === s).sort((a, b) => a.st.name.localeCompare(b.st.name, 'ar')); };
  const draw = () => {
    const all = activeStudents().map(st => ({ f: feeOf(st), p: paidOf(st) }));
    const tf = all.reduce((a, x) => a + x.f, 0), tp = all.reduce((a, x) => a + x.p, 0);
    $('#fk').innerHTML = `<div class="stat"><span class="i">🧾</span><div class="n">${num(tf, 0)}</div><div class="l">إجمالي المستحق (${cur})</div></div><div class="stat"><span class="i">✅</span><div class="n" style="color:var(--green)">${num(tp, 0)}</div><div class="l">المسدد</div></div><div class="stat"><span class="i">⏳</span><div class="n" style="color:var(--red)">${num(Math.max(0, tf - tp), 0)}</div><div class="l">المتبقي</div></div><div class="stat"><span class="i">📈</span><div class="n">${tf ? Math.round(tp / tf * 100) : 0}%</div><div class="l">نسبة التحصيل</div></div>`;
    const R = rows();
    $('#ft').innerHTML = `<tr><th>م</th><th>الطالب</th><th>الفصل</th><th>الرسوم</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th></th></tr>` + R.map((x, i) => `<tr><td>${i + 1}</td><td class="r"><b>${esc(x.st.name)}</b></td><td>${esc((classOf(x.st) || {}).name || '')}</td><td>${num(x.f)}</td><td style="color:var(--green);font-weight:700">${num(x.p)}</td><td style="color:${x.r ? 'var(--red)' : ''};font-weight:700">${num(x.r)}</td><td>${{ paid: '<span class="chip green">مسدد</span>', part: '<span class="chip gold">جزئي</span>', none: '<span class="chip red">غير مسدد</span>', free: '<span class="chip gray">معفى</span>' }[x.state]}</td><td><button class="btn sm" data-pay="${x.st.id}">➕ سداد</button></td></tr>`).join('');
  };
  draw();
  ['#fq', '#fc', '#fs'].forEach(s => $(s).addEventListener('input', draw));
  $('#ft').onclick = e => { const b = e.target.closest('[data-pay]'); if (b) paymentDialog(byId('students', b.dataset.pay), draw); };
  $('#setfee').onclick = () => { const val = prompt('الرسوم الافتراضية لكل طالب (' + cur + ')', S.settings.feeDefault || 0); if (val != null) { saveSettings({ feeDefault: +val || 0 }); render(); } };
  $('#remind').onclick = () => waQueueDialog(rows().filter(x => x.r > 0).map(x => ({ name: x.st.name, phone: x.st.guardianPhone, text: fillTpl(S.settings.waFee, { student: x.st.name, remaining: num(x.r), link: parentLink(x.st) }) })), 'تذكير بالرسوم');
  $('#fexp').onclick = async () => { await loadXLSX(); const ws = XLSX.utils.json_to_sheet(rows().map((x, i) => ({ 'م': i + 1, 'الطالب': x.st.name, 'الفصل': (classOf(x.st) || {}).name || '', 'الرسوم': x.f, 'المسدد': x.p, 'المتبقي': x.r }))); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'الرسوم'); XLSX.writeFile(wb, 'الرسوم.xlsx'); };
}
function paymentDialog(st, after) {
  const cur = S.settings.currency;
  const drawBody = () => { const pays = T('payments').filter(p => p.studentId === st.id).sort((a, b) => a.date < b.date ? 1 : -1); const f = feeOf(st), p = paidOf(st); return `
    <div class="kpis"><div class="kpi"><div class="v">${num(f)}</div><div class="t">الرسوم</div></div><div class="kpi"><div class="v" style="color:var(--green)">${num(p)}</div><div class="t">المسدد</div></div><div class="kpi"><div class="v" style="color:var(--red)">${num(Math.max(0, f - p))}</div><div class="t">المتبقي</div></div></div>
    <div class="row"><span class="small muted">الرسوم المقررة لهذا الطالب:</span><input class="inp" id="pfee" type="number" style="width:110px" value="${f}"><button class="btn sm light" id="savefee">حفظ</button></div>
    <div class="card" style="margin-top:10px"><h3>➕ تسجيل دفعة</h3><div class="grid g2">
      <div class="field"><label>المبلغ (${cur})</label><input class="inp" id="pa" type="number" value="${Math.max(0, f - p) || ''}"></div>
      <div class="field"><label>التاريخ</label><input class="inp" id="pd" type="date" value="${todayISO()}"></div>
      <div class="field"><label>طريقة السداد</label><select class="inp" id="pm"><option>نقداً</option><option>تحويل بنكي</option><option>شبكة (مدى)</option><option>أخرى</option></select></div>
      <div class="field"><label>ملاحظة / رقم السند</label><input class="inp" id="pn"></div></div><button class="btn" id="addpay">💾 تسجيل الدفعة</button></div>
    <div class="rep-sec">سجل الدفعات</div>${pays.length ? `<table class="tbl"><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>ملاحظة</th><th></th></tr>${pays.map(x => `<tr><td>${fmtDate(x.date, false)}</td><td><b>${num(x.amount)}</b></td><td>${esc(x.method || '')}</td><td>${esc(x.note || '')}</td><td><button class="btn sm light" data-rc="${x.id}">🧾 سند</button> <button class="btn sm ghost" data-dp="${x.id}">✕</button></td></tr>`).join('')}</table>` : '<div class="empty small">لا توجد دفعات</div>'}`; };
  const m = modal({ title: '💰 رسوم: ' + esc(st.name), body: drawBody(), foot: false, onClose: () => { after ? after() : (location.hash.startsWith('#/fees') && render()); } });
  const bind = () => {
    $('#savefee', m.el).onclick = () => { st.fee = +$('#pfee', m.el).value; save('students', st); m.body.innerHTML = drawBody(); bind(); };
    $('#addpay', m.el).onclick = () => { const a = +$('#pa', m.el).value; if (!a) return toast('اكتب المبلغ'); const p = save('payments', { id: uid('p'), studentId: st.id, amount: a, date: $('#pd', m.el).value, method: $('#pm', m.el).value, note: $('#pn', m.el).value, receipt: T('payments').length + 1 }); toast('✔️ سُجلت الدفعة'); m.body.innerHTML = drawBody(); bind(); receipt(p); };
    m.body.onclick = async e => { const r = e.target.closest('[data-rc]'); if (r) receipt(byId('payments', r.dataset.rc)); const d = e.target.closest('[data-dp]'); if (d && await confirmBox('حذف الدفعة؟')) { remove('payments', d.dataset.dp); m.body.innerHTML = drawBody(); bind(); } };
  };
  bind();
}
function receipt(p) {
  const st = byId('students', p.studentId); const s = S.settings; const f = feeOf(st), paid = paidOf(st);
  const m = modal({ title: '🧾 سند قبض', body: `<div class="report" id="rcp">${repHeader('سند قبض رسوم', 'رقم السند: ' + (p.receipt || '') + ' — ' + fmtDate(p.date) + ' — ' + hijri(p.date))}
    <div style="font-size:16px;line-height:2.2">استلمنا من ولي أمر الطالب: <b>${esc(st.name)}</b><br>مبلغاً وقدره: <b style="font-size:20px;color:var(--teal)">${num(p.amount)} ${s.currency}</b> — ${esc(p.method || '')}<br>وذلك عن: رسوم ${esc(s.programName)} ${p.note ? '— ' + esc(p.note) : ''}<br>
    <span class="muted">إجمالي الرسوم: ${num(f)} — إجمالي المسدد: ${num(paid)} — المتبقي: ${num(Math.max(0, f - paid))}</span></div>
    <div class="rep-foot"><span>المستلم: ${esc(S.me ? S.me.name : '')}</span><span>الختم</span></div></div>`,
    foot: `<button class="btn" onclick="printEl('#rcp')">🖨️ طباعة</button><a class="btn wa" target="_blank" href="${waLink(st.guardianPhone, 'السلام عليكم ورحمة الله\nتم استلام مبلغ ' + num(p.amount) + ' ' + s.currency + ' رسوم الطالب ' + st.name + ' بتاريخ ' + fmtDate(p.date, false) + '.\nالمتبقي: ' + num(Math.max(0, f - paid)) + ' ' + s.currency + '\nجزاكم الله خيراً — ' + s.complexName)}">💬 إرسال لولي الأمر</a>` });
}
function printEl(sel) { const el = $(sel); const w = window.open('', '_blank'); w.document.write(`<html dir="rtl"><head><title>طباعة</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&family=Amiri+Quran&display=swap" rel="stylesheet"><link rel="stylesheet" href="${new URL('css/style.css', location.href)}"><style>body{background:#fff;padding:10px}</style></head><body><div class="report">${el.innerHTML.replace(/src="(?!data:|http)/g, 'src="' + appBase())}</div></body></html>`); w.document.close(); setTimeout(() => w.print(), 900); }

/* ===================== الأوائل والترتيب ===================== */
function viewLeaders(v) {
  const p = JSON.parse(sessionStorage.getItem('ld') || '{"k":"week","by":"total"}');
  const [from, to] = periodRange(p.k, todayISO(), p.f, p.t);
  const classes = myClasses();
  v.innerHTML = `<div class="page-head"><h2>🏆 الأوائل والترتيب</h2><span class="sp"></span><a class="btn gold" href="#/tv">📺 عرض على الشاشة</a></div>
    <div class="card" style="padding:10px"><div class="row">
      <div class="tabs" style="margin:0">${[['day', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['all', 'منذ البداية'], ['custom', 'من–إلى']].map(([k, t]) => `<button data-k="${k}" class="${p.k === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${p.k === 'custom' ? `<input type="date" class="inp" id="lf" value="${from}" style="width:auto"><input type="date" class="inp" id="lt" value="${to}" style="width:auto">` : ''}
      <select class="inp" id="lby" style="width:auto"><option value="total" ${p.by === 'total' ? 'selected' : ''}>حسب الأوجه (حفظ+مراجعة)</option><option value="points" ${p.by === 'points' ? 'selected' : ''}>حسب النقاط الشاملة</option><option value="hifz" ${p.by === 'hifz' ? 'selected' : ''}>حسب الحفظ فقط</option><option value="noorItems" ${p.by === 'noorItems' ? 'selected' : ''}>حسب النورانية</option></select></div>
      <div class="small muted" style="margin-top:6px">النقاط الشاملة = الحفظ×10 + المراجعة×3 + التقديرات + الحضور + النورانية + زاد الطفل + السلوك</div></div>
    ${classes.map(c => { const rk = rankClass(c.id, from, to, p.by); const max = Math.max(1, ...rk.map(x => x.o[p.by])); const u = p.by === 'points' ? 'نقطة' : p.by === 'noorItems' ? 'بند' : 'وجه'; return `<div class="card"><h3>${esc(c.name)} <span class="muted small">— ${esc((teacherOf(c) || {}).name || '')}</span></h3>
      ${rk.length >= 1 ? `<div class="podium">${[1, 0, 2].map(i => rk[i] ? `<div class="p p${i + 1}"><div class="nm">${esc(rk[i].s.name.split(' ').slice(0, 2).join(' '))}</div><div class="sc">${num(rk[i].o[p.by])} ${u}</div><div class="blk">${['🥇', '🥈', '🥉'][i]}</div></div>` : '<div class="p"></div>').join('')}</div>` : ''}
      ${rk.map(x => `<div class="rank-row"><div class="r">${x.rank}</div><div style="flex:1"><b>${esc(x.s.name)}</b><div class="small muted">حفظ ${num(x.o.hifz)} · مراجعة ${num(x.o.review)} · حضور ${x.o.p + x.o.l}/${x.o.days} · ${x.o.points} نقطة · ${levelOf(x.o)}</div><div class="bar"><i style="width:${x.o[p.by] / max * 100}%"></i></div></div></div>`).join('') || '<div class="empty small">لا يوجد طلاب</div>'}</div>`; }).join('') || '<div class="card empty">لا توجد فصول</div>'}`;
  const setP = o => { sessionStorage.setItem('ld', JSON.stringify(Object.assign(p, o))); render(); };
  $$('.tabs button', v).forEach(b => b.onclick = () => setP({ k: b.dataset.k }));
  $('#lby').onchange = e => setP({ by: e.target.value });
  if ($('#lf')) { $('#lf').onchange = e => setP({ f: e.target.value, t: $('#lt').value }); $('#lt').onchange = e => setP({ f: $('#lf').value, t: e.target.value }); }
}
function viewTV(root) {
  const p = JSON.parse(sessionStorage.getItem('ld') || '{"k":"week","by":"total"}');
  const [from, to] = periodRange(p.k, todayISO(), p.f, p.t);
  const classes = myClasses().filter(c => studentsOfClass(c.id).length);
  const st = S.settings; let i = 0;
  const slides = classes.map(c => ({ c, rk: rankClass(c.id, from, to, p.by).slice(0, 3) }));
  const lbl = { day: 'أوائل اليوم', week: 'أوائل الأسبوع', month: 'أوائل الشهر', all: 'الأوائل', custom: 'الأوائل' }[p.k];
  const u = p.by === 'points' ? 'نقطة' : 'وجه';
  root.innerHTML = `<div class="tv"><button class="btn sm light close" onclick="history.back()">✕</button><div class="hd"><img src="${logoR()}"><h1>🏆 ${lbl}<small>${esc(st.programName)} — ${esc(st.complexName)}</small></h1><img src="${logoL()}"></div><div class="body" id="tvb"></div><div class="dots">${slides.map((_, j) => `<i data-j="${j}"></i>`).join('')}</div></div>`;
  const show = () => {
    if (!slides.length) { $('#tvb').innerHTML = '<div class="cls">لا توجد بيانات بعد</div>'; return; }
    const s = slides[i % slides.length];
    $('#tvb').innerHTML = `<div class="cls">${esc(s.c.name)} — ${esc((teacherOf(s.c) || {}).name || '')}</div><div class="podium">${[1, 0, 2].map(k => s.rk[k] ? `<div class="p p${k + 1}"><div class="nm">${esc(s.rk[k].s.name.split(' ').slice(0, 3).join(' '))}</div><div class="sc">${num(s.rk[k].o[p.by])} ${u}</div><div class="blk">${['🥇', '🥈', '🥉'][k]}</div></div>` : '<div class="p"></div>').join('')}</div>`;
    $$('.tv .dots i').forEach((d, j) => d.classList.toggle('on', j === i % slides.length));
    i++;
  };
  show(); clearInterval(window._tvT); window._tvT = setInterval(() => { if (!$('.tv')) return clearInterval(window._tvT); show(); }, 8000);
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
}

/* ===================== الإعدادات ===================== */
function viewSettings(v, sub) {
  const st = S.settings; const f = features();
  const FEATS = [['quran', '📖 متابعة القرآن (حفظ ومراجعة)'], ['noor', '🔤 القاعدة النورانية'], ['zad', '🌸 زاد الطفل المسلم'], ['voice', '🎤 الإدخال الصوتي'], ['behavior', '⭐ تقييم السلوك'], ['fees', '💰 الرسوم'], ['leaders', '🏆 الأوائل والترتيب'], ['parentPage', '👨‍👩‍👦 صفحة الطالب لولي الأمر']];
  v.innerHTML = `<div class="page-head"><h2>⚙️ الإعدادات</h2></div>
  <div class="tabs">${[['general', 'عام'], ['server', '☁️ الربط بالخادم'], ['features', 'الخصائص'], ['zad', 'منهج زاد الطفل'], ['wa', 'رسائل الواتساب'], ['backup', 'النسخ الاحتياطي']].map(([k, t]) => `<button data-t="${k}" class="${(sub || 'general') === k ? 'on' : ''}">${t}</button>`).join('')}</div><div id="sv"></div>`;
  $$('.tabs button', v).forEach(b => b.onclick = () => location.hash = '#/settings/' + b.dataset.t);
  const box = $('#sv'); sub = sub || 'general';
  if (sub === 'general') {
    box.innerHTML = `<div class="card"><h3>🏷️ بيانات البرنامج</h3><div class="grid g2">
      ${[['orgName', 'اسم الجمعية'], ['branchName', 'الفرع'], ['complexName', 'اسم المجمع'], ['programName', 'اسم البرنامج'], ['supervisor', 'اسم المشرف'], ['phone', 'جوال التواصل'], ['currency', 'العملة']].map(([k, l]) => `<div class="field"><label>${l}</label><input class="inp" data-k="${k}" value="${esc(st[k] || '')}"></div>`).join('')}
      <div class="field"><label>اتجاه الحفظ الافتراضي للطلاب الجدد</label><select class="inp" data-k="directionDefault"><option value="desc" ${st.directionDefault !== 'asc' ? 'selected' : ''}>من الناس صعوداً</option><option value="asc" ${st.directionDefault === 'asc' ? 'selected' : ''}>من الفاتحة نزولاً</option></select></div></div>
      <div class="field"><label>رسالة ترحيب في نموذج التسجيل</label><textarea class="inp" data-k="regNote">${esc(st.regNote || '')}</textarea></div></div>
    <div class="card"><h3>🖼️ الشعارات</h3><div class="grid g2">${[['logoRight', 'الشعار الأيمن (جمعية تعلم)'], ['logoLeft', 'الشعار الأيسر (مجمع ابن تيمية)']].map(([k, l]) => `<div style="text-align:center"><div class="muted small">${l}</div><img src="${st[k] || DEFAULT_SETTINGS[k]}" style="height:90px;max-width:100%;object-fit:contain;margin:8px"><div class="row" style="justify-content:center"><label class="btn sm light">📁 تغيير<input type="file" accept="image/*" data-logo="${k}" hidden></label><button class="btn sm ghost" data-rl="${k}">↩️ الافتراضي</button></div></div>`).join('')}</div></div>
    <div class="card"><h3>📅 أيام الدراسة</h3><div class="row">${DAY_NAMES.map((d, i) => `<label class="chip" style="padding:7px 12px"><input type="checkbox" class="wd" value="${i}" ${(st.workDays || []).includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <div class="card"><h3>⭐ مسميات التقديرات</h3><div class="grid g4">${[5, 4, 3, 2, 1].map(g => `<div class="field"><label>التقدير ${g}</label><input class="inp gl" data-g="${g}" value="${esc(st.gradeLabels[g])}"></div>`).join('')}</div></div>
    <button class="btn" id="saveg">💾 حفظ الإعدادات</button>`;
    $$('[data-logo]', box).forEach(i => i.onchange = async () => { const d = await resizeImage(i.files[0], 300); saveSettings({ [i.dataset.logo]: d }); render(); });
    $$('[data-rl]', box).forEach(b => b.onclick = () => { saveSettings({ [b.dataset.rl]: DEFAULT_SETTINGS[b.dataset.rl] }); render(); });
    $('#saveg').onclick = () => { const o = {}; $$('[data-k]', box).forEach(i => o[i.dataset.k] = i.value); o.workDays = $$('.wd:checked', box).map(x => +x.value); o.gradeLabels = {}; $$('.gl', box).forEach(i => o.gradeLabels[i.dataset.g] = i.value); saveSettings(o); toast('✔️ تم الحفظ'); render(); };
  }
  if (sub === 'features') {
    box.innerHTML = `<div class="card"><h3>🎛️ تشغيل وإيقاف الخصائص</h3>${FEATS.map(([k, t]) => `<div class="toggle-row"><span>${t}</span><label class="switch"><input type="checkbox" data-f="${k}" ${f[k] ? 'checked' : ''}><span></span></label></div>`).join('')}
      <div class="toggle-row"><span>إظهار الرسوم لولي الأمر في صفحة الطالب</span><label class="switch"><input type="checkbox" id="psf" ${st.parentShowFees !== false ? 'checked' : ''}><span></span></label></div>
      <div class="toggle-row"><span>عرض ترتيب الطالب في فصله لولي الأمر</span><label class="switch"><input type="checkbox" id="psr" ${st.parentShowRank !== false ? 'checked' : ''}><span></span></label></div></div>
      <div class="card"><h3>📲 مزود الواتساب للإرسال الآلي (اختياري)</h3><p class="small muted">بدونه يعمل الإرسال بفتح الواتساب برسالة جاهزة لكل رقم. للإرسال الآلي الكامل اشترك في خدمة UltraMsg ثم ضع البيانات هنا (تعمل بعد الربط بالخادم).</p>
      <div class="grid g2"><div class="field"><label>Instance ID</label><input class="inp" id="wai" dir="ltr" value="${esc(st.waInstance || '')}"></div><div class="field"><label>Token</label><input class="inp" id="wat" dir="ltr" value="${esc(st.waToken || '')}"></div></div>
      <div class="toggle-row"><span>تفعيل الإرسال الآلي</span><label class="switch"><input type="checkbox" id="waa" ${st.waAuto ? 'checked' : ''}><span></span></label></div></div>`;
    box.onchange = () => { const fe = {}; $$('[data-f]', box).forEach(i => fe[i.dataset.f] = i.checked); saveSettings({ features: fe, parentShowFees: $('#psf').checked, parentShowRank: $('#psr').checked, waInstance: $('#wai').value.trim(), waToken: $('#wat').value.trim(), waAuto: $('#waa').checked }); toast('✔️ حُفظ'); };
  }
  if (sub === 'zad') {
    const z = zadCurriculum();
    box.innerHTML = `<div class="card"><h3>🌸 منهج زاد الطفل المسلم</h3><p class="small muted">بند في كل سطر. ما تكتبه هنا يظهر للمعلم عند التسجيل اليومي ولولي الأمر في صفحة الطالب.</p><div class="grid g2">${z.map((c, i) => `<div class="field"><label>${c.icon} ${esc(c.name)}</label><textarea class="inp zt" data-i="${i}" rows="8">${esc(c.items.join('\n'))}</textarea></div>`).join('')}</div>
      <div class="row"><button class="btn" id="savez">💾 حفظ المنهج</button><button class="btn ghost" id="resetz">↩️ استعادة الافتراضي</button></div></div>`;
    $('#savez').onclick = () => { const nz = z.map((c, i) => Object.assign({}, c, { items: $(`.zt[data-i="${i}"]`, box).value.split('\n').map(x => x.trim()).filter(Boolean) })); saveSettings({ zad: nz }); toast('✔️ حُفظ المنهج'); };
    $('#resetz').onclick = () => { saveSettings({ zad: null }); render(); };
  }
  if (sub === 'wa') {
    box.innerHTML = `<div class="card"><h3>💬 قوالب الرسائل</h3><p class="small muted">المتغيرات: {student} الطالب، {link} الرابط، {date} التاريخ، {summary} ملخص اليوم، {remaining} المتبقي، {complex} المجمع، {program} البرنامج</p>
      ${[['waInvite', 'دعوة التسجيل'], ['waParent', 'إرسال رابط صفحة الطالب'], ['waDaily', 'تقرير اليوم'], ['waAbsent', 'إشعار الغياب'], ['waFee', 'تذكير الرسوم']].map(([k, l]) => `<div class="field"><label>${l}</label><textarea class="inp" data-k="${k}" rows="4">${esc(st[k])}</textarea></div>`).join('')}<button class="btn" id="savew">💾 حفظ</button></div>`;
    $('#savew').onclick = () => { const o = {}; $$('[data-k]', box).forEach(i => o[i.dataset.k] = i.value); saveSettings(o); toast('✔️ حُفظ'); };
  }
  if (sub === 'server') serverSettings(box);
  if (sub === 'backup') {
    box.innerHTML = `<div class="card"><h3>💾 النسخ الاحتياطي</h3><div class="row"><button class="btn" id="bk">⬇️ تنزيل نسخة احتياطية</button><label class="btn light">⬆️ استعادة نسخة<input type="file" id="rs" accept=".json" hidden></label></div></div>
      <div class="card"><h3>🧪 بيانات تجريبية</h3><p class="small muted">لتجربة التطبيق قبل البدء الفعلي: يضيف فصلين ومعلمين وطلاباً من كشوفك مع سجلات لأسبوعين.</p><button class="btn gold" id="demo">✨ تحميل بيانات تجريبية</button> <button class="btn red" id="wipe">🗑️ مسح كل البيانات المحلية</button></div>`;
    $('#bk').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.data)], { type: 'application/json' })); a.download = 'نسخة-متابعة-الحلقات-' + todayISO() + '.json'; a.click(); };
    $('#rs').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!await confirmBox('استبدال البيانات الحالية بالنسخة؟')) return; TABLE_NAMES.forEach(t => { if (Array.isArray(d[t])) { S.data[t] = []; d[t].forEach(r => save(t, r)); } }); toast('✔️ تمت الاستعادة'); render(); } catch (er) { toast('ملف غير صالح'); } };
    $('#demo').onclick = () => { loadDemo(); toast('✔️ أُضيفت البيانات التجريبية'); location.hash = '#/home'; };
    $('#wipe').onclick = async () => { if (await confirmBox('مسح كل البيانات المحلية على هذا الجهاز؟')) { localStorage.removeItem(LS.data); localStorage.removeItem(LS.queue); loadLocal(); render(); } };
  }
}
function serverSettings(box) {
  box.innerHTML = `<div class="card"><h3>☁️ الربط بالخادم (Google Sheets)</h3>
    ${S.server ? `<div class="row"><span class="chip green">✔️ مرتبط</span><span class="small muted" dir="ltr" style="word-break:break-all">${esc(S.server)}</span></div><div class="row" style="margin-top:10px"><button class="btn" id="syncnow">🔄 مزامنة الآن</button><button class="btn ghost" id="unlink">فصل الربط</button></div>` : `
    <p>الربط يجعل البيانات محفوظة في Google Sheet خاص بالمجمع، ويتيح: دخول المعلمين من جوالاتهم، ووصول طلبات التسجيل، وفتح صفحة الطالب لولي الأمر.</p>
    <ol style="line-height:2" class="small"><li>افتح <a href="https://sheets.new" target="_blank">Google Sheet جديد</a> (يفضل من حساب المجمع ibntymyah@gmail.com).</li>
    <li>من القائمة: الإضافات ← Apps Script، واحذف المحتوى والصق <a href="https://github.com/aboyehia15-droid/goto/blob/main/tahfeez/server/Code.gs" target="_blank">كود الخادم</a> (زر Copy raw file).</li>
    <li>احفظ ثم شغّل الدالة <b>setup</b> مرة واحدة ووافق على الصلاحيات.</li>
    <li>نشر ← نشر جديد ← تطبيق ويب ← التنفيذ: <b>أنا</b>، الوصول: <b>أي شخص</b> ← نشر.</li><li>انسخ رابط تطبيق الويب والصقه هنا:</li></ol>
    <div class="row"><input class="inp grow" id="surl" dir="ltr" placeholder="https://script.google.com/macros/s/…/exec"><button class="btn" id="conn">🔗 ربط</button></div><div id="sres"></div>`}</div>`;
  const sn = $('#syncnow'); if (sn) sn.onclick = () => pull().then(render);
  const ul = $('#unlink'); if (ul) ul.onclick = async () => { if (await confirmBox('فصل التطبيق عن الخادم على هذا الجهاز؟ (تبقى نسخة محلية)')) { localStorage.removeItem(LS.server); S.server = ''; S.token = null; S.me = null; saveSession(); render(); } };
  const cb = $('#conn'); if (cb) cb.onclick = async () => {
    const url = $('#surl').value.trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return toast('الرابط غير صحيح');
    cb.disabled = true; cb.textContent = '⏳';
    try {
      const r = await api('ping', {}, url); if (!r.ok) throw new Error(r.error || 'خطأ');
      if (!r.hasUsers) {
        $('#sres').innerHTML = `<div class="card" style="margin-top:10px"><h3>👑 إنشاء حساب المدير</h3><p class="small muted">سيتم رفع كل البيانات الموجودة على هذا الجهاز إلى الخادم.</p><div class="grid g3"><input class="inp" id="an" placeholder="الاسم" value="${esc(S.settings.supervisor || '')}"><input class="inp" id="au" dir="ltr" placeholder="اسم المستخدم"><input class="inp" id="ap" dir="ltr" placeholder="كلمة المرور"></div><button class="btn" id="boot" style="margin-top:8px">✔️ إنشاء ورفع البيانات</button></div>`;
        $('#boot').onclick = async () => {
          const admin = { id: uid('u'), name: $('#an').value.trim() || 'المدير', username: $('#au').value.trim(), password: $('#ap').value };
          if (!admin.username || !admin.password) return toast('اكتب اسم المستخدم وكلمة المرور');
          const data = {}; TABLE_NAMES.forEach(t => data[t] = S.data[t]);
          if (!data.settings.length) data.settings = [Object.assign({}, DEFAULT_SETTINGS, { updatedAt: Date.now() })];
          const b = await api('bootstrap', { admin, data }, url); if (!b.ok) return toast(b.error);
          S.server = url; localStorage.setItem(LS.server, url); S.token = b.token; S.me = b.user; saveSession(); await pull(true); toast('✔️ تم الربط'); location.hash = '#/home';
        };
      } else { S.server = url; localStorage.setItem(LS.server, url); toast('سجّل الدخول'); render(); }
    } catch (e) { toast('⚠️ تعذر الاتصال: ' + e.message); }
    cb.disabled = false; cb.textContent = '🔗 ربط';
  };
}
function viewLogin(root) {
  root.innerHTML = `<div class="login"><div class="box"><div class="lg"><img src="${logoR()}"><img src="${logoL()}"></div><h2 style="color:var(--teal);margin:6px 0">منصة متابعة الحلقات</h2><p class="muted small">${esc(S.settings.complexName)}</p>
    <input class="inp" id="lu" placeholder="اسم المستخدم" dir="ltr" style="margin-bottom:8px"><input class="inp" id="lp" type="password" placeholder="كلمة المرور" dir="ltr" style="margin-bottom:12px"><button class="btn block" id="lb">دخول</button>
    <button class="btn ghost block" id="lx" style="margin-top:8px;font-size:12px">العمل محلياً بدون خادم</button></div></div>`;
  const go = async () => { const b = $('#lb'); b.disabled = true; b.textContent = '⏳'; try { const r = await api('login', { username: $('#lu').value.trim(), password: $('#lp').value }); if (!r.ok) throw new Error(r.error); S.token = r.token; S.me = r.user; saveSession(); await pull(true); location.hash = '#/home'; render(); } catch (e) { toast('⚠️ ' + e.message); } b.disabled = false; b.textContent = 'دخول'; };
  $('#lb').onclick = go; $('#lp').onkeydown = e => e.key === 'Enter' && go();
  $('#lx').onclick = async () => { if (await confirmBox('فصل الربط بالخادم والعمل محلياً على هذا الجهاز؟', 'نعم', false)) { localStorage.removeItem(LS.server); S.server = ''; render(); } };
}
