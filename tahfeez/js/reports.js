/* ===================== التقارير ===================== */
const REPORTS = [
  ['student', '👦 تقرير طالب شامل'], ['week', '🗓️ جدول الأسبوع (كشف المتابعة)'], ['class', '🏫 التقرير الإجمالي للفصل والترتيب'],
  ['all', '🧭 لوحة المشرف (كل الفصول والمعلمين)'], ['att', '📅 تقرير الحضور والغياب'], ['noor', '🔤 تقرير النورانية'], ['zad', '🌸 تقرير زاد الطفل'],
  ['errors', '✏️ تقرير الأخطاء والتصويب'], ['fees', '💰 تقرير الرسوم']
];
let REP = { type: 'student', period: 'month', ref: '', from: '', to: '', cls: '', stu: '', blank: false, allStu: false, subs: { quran: 1, noor: 1, zad: 1, att: 1, notes: 1, fees: 1 } };

function viewReports(v, sub, arg) {
  if (sub && REPORTS.some(r => r[0] === sub)) { REP.type = sub; if (arg) { if (sub === 'student') { REP.stu = arg; const s = byId('students', arg); if (s) REP.cls = s.classId; } else REP.cls = arg; } history.replaceState(null, '', '#/reports'); }
  const classes = myClasses();
  if (!REP.cls || !classes.some(c => c.id === REP.cls)) REP.cls = (classes[0] || {}).id || '';
  if (!REP.ref) REP.ref = todayISO();
  if (REP.type === 'week') REP.period = 'week';
  const types = REPORTS.filter(r => (r[0] !== 'fees' || (canAdmin() && features().fees)) && (r[0] !== 'all' || canAdmin()) && (r[0] !== 'noor' || features().noor) && (r[0] !== 'zad' || features().zad));
  const studs = studentsOfClass(REP.cls);
  if (REP.type === 'student' && !studs.some(s => s.id === REP.stu)) REP.stu = (studs[0] || {}).id || '';
  const needCls = !['all', 'fees'].includes(REP.type) || REP.type === 'fees';
  v.innerHTML = `<div class="page-head"><h2>📊 التقارير</h2><span class="sp"></span><button class="btn" id="rprint">🖨️ طباعة / PDF</button><button class="btn light" id="rxls">📤 Excel</button>${REP.type === 'student' && REP.stu && features().parentPage ? '<button class="btn wa" id="rwa">💬 إرسال لولي الأمر</button>' : ''}</div>
    <div class="card rep-controls no-print" style="padding:12px">
      <div class="grid g3">
        <div class="field"><label>نوع التقرير</label><select class="inp" id="rt">${types.map(([k, t]) => `<option value="${k}" ${REP.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        ${needCls ? `<div class="field"><label>الفصل</label><select class="inp" id="rc">${REP.type === 'fees' ? '<option value="">كل الفصول</option>' : ''}${classes.map(c => `<option value="${c.id}" ${REP.cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
        ${REP.type === 'student' ? `<div class="field"><label>الطالب</label><select class="inp" id="rs" ${REP.allStu ? 'disabled' : ''}>${studs.map(s => `<option value="${s.id}" ${REP.stu === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>` : ''}
      </div>
      ${REP.type !== 'fees' ? `<div class="row" style="margin-top:4px"><div class="tabs" style="margin:0">${(REP.type === 'week' ? [['week', 'أسبوع']] : [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري'], ['custom', 'من تاريخ إلى تاريخ'], ['all', 'منذ البداية']]).map(([k, t]) => `<button data-p="${k}" class="${REP.period === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${REP.period === 'custom' ? `<input type="date" class="inp" id="rf" value="${REP.from || REP.ref}" style="width:auto"> <span>إلى</span> <input type="date" class="inp" id="rto" value="${REP.to || REP.ref}" style="width:auto">` : REP.period !== 'all' ? `<input type="date" class="inp" id="rref" value="${REP.ref}" style="width:auto"><span class="small muted">${REP.period === 'week' ? 'اختر أي يوم من الأسبوع' : REP.period === 'month' ? 'اختر أي يوم من الشهر' : ''}</span>` : ''}</div>` : ''}
      ${REP.type === 'student' ? `<div class="row small" style="margin-top:8px">${[['quran', 'القرآن'], ['noor', 'النورانية'], ['zad', 'زاد الطفل'], ['att', 'الحضور'], ['notes', 'الملاحظات والأخطاء'], ['fees', 'الرسوم']].filter(([k]) => k === 'att' || k === 'notes' || features()[k]).map(([k, t]) => `<label class="chip"><input type="checkbox" class="rsub" value="${k}" ${REP.subs[k] ? 'checked' : ''}> ${t}</label>`).join('')}<label class="chip gold"><input type="checkbox" id="rall" ${REP.allStu ? 'checked' : ''}> تقارير جميع طلاب الفصل</label></div>` : ''}
      ${REP.type === 'week' ? `<label class="row small" style="margin-top:8px"><input type="checkbox" id="rblank" ${REP.blank ? 'checked' : ''}> نموذج فارغ للتعبئة الورقية</label>` : ''}
    </div>
    <div id="rout"></div>`;
  const re = () => render();
  $('#rt').onchange = e => { REP.type = e.target.value; if (REP.type !== 'week' && REP.period === 'week' && REP.type !== 'student') REP.period = 'month'; re(); };
  const rc = $('#rc'); if (rc) rc.onchange = e => { REP.cls = e.target.value; REP.stu = ''; re(); };
  const rs = $('#rs'); if (rs) rs.onchange = e => { REP.stu = e.target.value; re(); };
  $$('[data-p]', v).forEach(b => b.onclick = () => { REP.period = b.dataset.p; re(); });
  const rr = $('#rref'); if (rr) rr.onchange = e => { REP.ref = e.target.value || todayISO(); re(); };
  const rf = $('#rf'); if (rf) { rf.onchange = e => { REP.from = e.target.value; re(); }; $('#rto').onchange = e => { REP.to = e.target.value; re(); }; }
  $$('.rsub', v).forEach(c => c.onchange = () => { REP.subs[c.value] = c.checked ? 1 : 0; re(); });
  const ra = $('#rall'); if (ra) ra.onchange = e => { REP.allStu = e.target.checked; re(); };
  const rb = $('#rblank'); if (rb) rb.onchange = e => { REP.blank = e.target.checked; re(); };
  const [from, to] = periodRange(REP.period, REP.ref, REP.from, REP.to);
  const out = $('#rout');
  const periodLbl = REP.period === 'all' ? 'منذ البداية' : from === to ? fmtDate(from) + ' — ' + hijri(from) : 'من ' + fmtDate(from, false) + ' إلى ' + fmtDate(to, false) + (REP.period === 'month' ? ' (' + MONTHS[parseISO(from).getMonth()] + ')' : '');
  const R = {
    student: () => REP.allStu ? studs.map((s, i) => `<div class="report ${i < studs.length - 1 ? 'page-break' : ''}" style="margin-bottom:14px">${studentReport(s, from, to, periodLbl, REP.subs)}</div>`).join('') : REP.stu ? `<div class="report">${studentReport(byId('students', REP.stu), from, to, periodLbl, REP.subs)}</div>` : '<div class="card empty">لا يوجد طلاب</div>',
    week: () => `<div class="report">${weekReport(REP.cls, from, REP.blank)}</div>`,
    class: () => `<div class="report">${classReport(REP.cls, from, to, periodLbl)}</div>`,
    all: () => `<div class="report">${allReport(from, to, periodLbl)}</div>`,
    att: () => `<div class="report">${attReport(REP.cls, from, to, periodLbl)}</div>`,
    noor: () => `<div class="report">${noorReport(REP.cls, from, to, periodLbl)}</div>`,
    zad: () => `<div class="report">${zadReport(REP.cls, from, to, periodLbl)}</div>`,
    errors: () => `<div class="report">${errorsReport(REP.cls, from, to, periodLbl)}</div>`,
    fees: () => `<div class="report">${feesReport(REP.cls)}</div>`
  };
  out.innerHTML = classes.length || REP.type === 'fees' || REP.type === 'all' ? R[REP.type]() : '<div class="card empty">لا توجد فصول بعد</div>';
  $('#rprint').onclick = () => { if (REP.type === 'week') { const st = document.createElement('style'); st.id = 'landscape'; st.textContent = '@page{size:A4 landscape;margin:8mm}'; document.head.appendChild(st); setTimeout(() => st.remove(), 3000); } window.print(); };
  $('#rxls').onclick = () => exportTables(out, REPORTS.find(r => r[0] === REP.type)[1].replace(/^\S+\s/, ''));
  const rw = $('#rwa'); if (rw) rw.onclick = () => { const s = byId('students', REP.stu); if (!s.parentToken) { s.parentToken = token20(); save('students', s); } const o = statsOf(s.id, from, to); window.open(waLink(s.guardianPhone, `السلام عليكم ورحمة الله\nتقرير الطالب: ${s.name}\n${periodLbl}\n📖 الحفظ: ${num(o.hifz)} وجه\n🔁 المراجعة: ${num(o.review)} وجه\n📅 الحضور: ${o.p + o.l} من ${o.days}\n🎖️ المستوى: ${levelOf(o)}\nالتفاصيل الكاملة:\n${parentLink(s)}\n${S.settings.complexName}`), '_blank'); };
}
async function exportTables(root, name) {
  await loadXLSX(); const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
  $$('table', root).forEach((t, i) => { const ws = XLSX.utils.table_to_sheet(t, { raw: true }); ws['!views'] = [{ RTL: true }]; XLSX.utils.book_append_sheet(wb, ws, (name.slice(0, 24) + ' ' + (i + 1)).slice(0, 31)); });
  if (!wb.SheetNames.length) return toast('لا توجد جداول');
  XLSX.writeFile(wb, name + '.xlsx');
}

function kpis(list) { return `<div class="kpis">${list.map(([v, t]) => `<div class="kpi"><div class="v">${v}</div><div class="t">${t}</div></div>`).join('')}</div>`; }
function studentReport(s, from, to, periodLbl, subs) {
  const c = classOf(s); const t = teacherOf(c); const o = statsOf(s.id, from, to); const f = features();
  const rank = c ? (rankClass(c.id, from, to).find(x => x.s.id === s.id) || {}).rank : '';
  const rs = o.recs;
  let h = repHeader('تقرير متابعة الطالب', periodLbl);
  h += `<div class="rep-meta"><span>الطالب: <b>${esc(s.name)}</b></span><span>الفصل: <b>${esc(c ? c.name : '—')}</b></span><span>المعلم: <b>${esc(t ? t.name : '—')}</b></span>${s.birthDate ? `<span>العمر: <b>${ageFrom(s.birthDate)}</b></span>` : ''}${S.settings.supervisor ? `<span>المشرف: <b>${esc(S.settings.supervisor)}</b></span>` : ''}</div>`;
  h += kpis([[num(o.hifz), '📖 أوجه الحفظ'], [num(o.review), '🔁 أوجه المراجعة'], [num(o.total), '✳️ الإجمالي'], [rank ? rank + ' / ' + studentsOfClass(s.classId).length : '—', '🏆 الترتيب في الفصل'], [(o.p + o.l) + ' / ' + o.days, '📅 الحضور'], [levelOf(o), '🎖️ المستوى']]);
  if (subs.quran && f.quran) {
    const qr = rs.filter(r => (r.hifz && r.hifz.s1) || (r.review && r.review.s1) || r.att === 'a');
    h += `<div class="rep-sec">📖 القرآن الكريم — الحفظ والمراجعة</div>`;
    h += qr.length ? `<table class="tbl"><tr><th>اليوم</th><th>التاريخ</th><th>الحضور</th><th>الحفظ (السورة والآيات)</th><th>أوجه</th><th>التقدير</th><th>المراجعة (السورة والآيات)</th><th>أوجه</th><th>التقدير</th></tr>${qr.map(r => `<tr><td>${dayName(r.date)}</td><td>${fmtDate(r.date, false)}</td>${r.att === 'a' ? '<td colspan="7" style="color:var(--red);font-weight:700">غائب</td>' : `<td>${ATT[r.att] ? ATT[r.att][0] : ''}</td><td class="r">${r.hifz ? Q.rangeText(r.hifz) : '—'}</td><td>${r.hifz ? num(r.hifz.pages) : ''}</td><td>${r.hifz ? gradeLabel(r.hifz.grade) : ''}</td><td class="r">${r.review ? Q.rangeText(r.review) : '—'}</td><td>${r.review ? num(r.review.pages) : ''}</td><td>${r.review ? gradeLabel(r.review.grade) : ''}</td>`}</tr>`).join('')}<tr style="font-weight:800"><td colspan="4">الإجمالي</td><td>${num(o.hifz)}</td><td></td><td></td><td>${num(o.review)}</td><td></td></tr></table>` : '<div class="muted small">لا توجد تسجيلات في هذه الفترة</div>';
    const memo = memorizedSet(recsOf(s.id)); const prog = surahProgress(memo); const done = prog.map((p, i) => [p, i]).filter(x => x[0] > 0);
    if (done.length) h += `<div class="small" style="margin-top:6px"><b>السور المحفوظة حتى الآن (${num(pagesOfSet(memo))} وجه):</b> ${done.map(([p, i]) => Q.names[i] + (p < 1 ? ' (' + Math.round(p * 100) + '%)' : ' ✓')).join('، ')}</div>`;
  }
  if (subs.noor && f.noor) {
    const nr = rs.filter(r => r.noor && r.noor.lesson);
    h += `<div class="rep-sec">🔤 القاعدة النورانية</div>` + (nr.length ? `<table class="tbl"><tr><th>التاريخ</th><th>الدرس</th><th>من بند</th><th>إلى بند</th><th>التقدير</th><th>أخطاء</th></tr>${nr.map(r => `<tr><td>${fmtDate(r.date)}</td><td class="r">${esc(NOORANIA[r.noor.lesson - 1].title)}</td><td>${r.noor.from || ''}${r.noor.from ? ' «' + esc(NOORANIA[r.noor.lesson - 1].items[r.noor.from - 1] || '') + '»' : ''}</td><td>${r.noor.to || ''}${r.noor.to ? ' «' + esc(NOORANIA[r.noor.lesson - 1].items[r.noor.to - 1] || '') + '»' : ''}</td><td>${gradeLabel(r.noor.grade)}</td><td>${(r.errors || []).filter(e => e.sub === 'noor').map(e => esc(e.word || '')).join('، ')}</td></tr>`).join('')}</table>` : '<div class="muted small">لا توجد تسجيلات</div>');
  }
  if (subs.zad && f.zad) {
    const zr = []; rs.forEach(r => (r.zad || []).forEach(z => zr.push(Object.assign({ date: r.date }, z))));
    h += `<div class="rep-sec">🌸 زاد الطفل المسلم</div>` + (zr.length ? `<table class="tbl"><tr><th>التاريخ</th><th>المجال</th><th>البند</th><th>التقدير</th></tr>${zr.map(z => { const cat = zadCurriculum().find(c => c.id === z.cat) || {}; return `<tr><td>${fmtDate(z.date)}</td><td>${cat.icon || ''} ${esc(cat.name || '')}</td><td class="r">${esc(z.item)}</td><td>${gradeLabel(z.grade)}</td></tr>`; }).join('')}</table>` : '<div class="muted small">لا توجد تسجيلات</div>');
  }
  if (subs.att) { const ab = rs.filter(r => r.att === 'a' || r.att === 'e' || r.att === 'l'); h += `<div class="rep-sec">📅 الحضور والغياب</div><div class="small">حاضر: <b>${o.p}</b> — متأخر: <b>${o.l}</b> — مستأذن: <b>${o.e}</b> — غائب: <b style="color:var(--red)">${o.a}</b> — نسبة الحضور: <b>${o.attPct}%</b></div>${ab.length ? `<div class="small" style="margin-top:4px">${ab.map(r => `<span class="chip ${r.att === 'a' ? 'red' : r.att === 'l' ? 'gold' : 'blue'}">${ATT[r.att][0]}: ${fmtDate(r.date)}</span>`).join(' ')}</div>` : ''}`; }
  if (subs.notes) {
    const nn = rs.filter(r => r.note || (r.errors && r.errors.length) || r.behavior);
    if (nn.length) h += `<div class="rep-sec">📝 ملاحظات المعلم والأخطاء والتصويب</div><table class="tbl"><tr><th>التاريخ</th><th>السلوك</th><th>الملاحظة</th><th>الأخطاء والتصويب</th></tr>${nn.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${stars(r.behavior)}</td><td class="r">${esc(r.note || '')}</td><td class="r">${(r.errors || []).map(e => errText(e)).join('<br>')}</td></tr>`).join('')}</table>`;
  }
  if (subs.fees && f.fees && canAdmin()) { const fe = feeOf(s), pa = paidOf(s); h += `<div class="rep-sec">💰 الرسوم</div><div class="small">المقررة: <b>${num(fe)}</b> — المسدد: <b style="color:var(--green)">${num(pa)}</b> — المتبقي: <b style="color:var(--red)">${num(Math.max(0, fe - pa))}</b> ${S.settings.currency}</div>`; }
  h += `<div class="rep-foot"><span>معلم الفصل: ${esc(t ? t.name : '')}</span><span>المشرف: ${esc(S.settings.supervisor || '')}</span><span>تاريخ الطباعة: ${fmtDate(todayISO(), false)}</span></div>`;
  return h;
}
function errText(e) {
  const where = e.sub === 'noor' ? 'نورانية د' + e.lesson + (e.word ? ' «' + esc(e.word) + '»' : '') : e.sub === 'zad' ? 'زاد الطفل' : (e.sub === 'review' ? 'مراجعة: ' : 'حفظ: ') + (Q.names[e.s - 1] || '') + ' ' + (e.a || '') + (e.word ? ' «' + esc(e.word) + '»' : '');
  return `${e.fixed ? '✅' : '❌'} ${where} — ${esc(e.type || '')}${e.note ? ': ' + esc(e.note) : ''}`;
}
function weekReport(cid, ws, blank) {
  const c = byId('classes', cid); if (!c) return '<div class="empty">اختر فصلاً</div>';
  const t = teacherOf(c); const subj = classSubjects(c);
  const days = []; for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if ((S.settings.workDays || [0, 1, 2, 3, 4]).includes(parseISO(d).getDay())) days.push(d); }
  const studs = studentsOfClass(cid);
  const cell = r => {
    if (blank) return '<div style="height:44px"></div>';
    if (!r) return '';
    if (r.att === 'a') return 'غائب'; if (r.att === 'e') return 'مستأذن';
    const L = [];
    if (r.hifz && r.hifz.s1) L.push(`<b>ح:</b> ${Q.rangeText(r.hifz)} <small>(${gradeLabel(r.hifz.grade)})</small>`);
    if (r.review && r.review.s1) L.push(`<b>م:</b> ${Q.rangeText(r.review)} <small>(${gradeLabel(r.review.grade)})</small>`);
    if (r.noor && r.noor.lesson) L.push(`<b>ن:</b> د${r.noor.lesson} ${r.noor.from ? r.noor.from + '–' + r.noor.to : ''} <small>(${gradeLabel(r.noor.grade)})</small>`);
    if (r.zad && r.zad.length) L.push(`<b>ز:</b> ${r.zad.map(z => esc(z.item)).join('، ')}`);
    if (r.att === 'l') L.push('<small>متأخر</small>');
    return L.join('<br>');
  };
  let h = repHeader('كشف متابعة الحلقة — جدول الأسبوع', 'الأسبوع من ' + fmtDate(days[0] || ws) + ' إلى ' + fmtDate(days[days.length - 1] || ws) + ' — ' + hijri(days[0] || ws));
  h += `<div class="rep-meta"><span>الفصل: <b>${esc(c.name)}</b></span><span>المعلم: <b>${esc(t ? t.name : '')}</b></span>${S.settings.supervisor ? `<span>المشرف: <b>${esc(S.settings.supervisor)}</b></span>` : ''}<span>عدد الطلاب: <b>${studs.length}</b></span><span class="small muted">ح: حفظ — م: مراجعة${subj.includes('noor') ? ' — ن: نورانية' : ''}${subj.includes('zad') ? ' — ز: زاد الطفل' : ''}</span></div>`;
  h += `<div class="tbl-wrap"><table class="tbl week-tbl"><tr><th>م</th><th>اسم الطالب</th>${days.map(d => `<th>${dayName(d)}<br><small>${fmtDate(d, false)}</small></th>`).join('')}${blank ? '' : '<th>أوجه الحفظ</th><th>أوجه المراجعة</th><th>الغياب</th>'}</tr>`;
  studs.forEach((s, i) => { const o = statsOf(s.id, days[0], days[days.length - 1]); h += `<tr><td>${i + 1}</td><td class="r" style="white-space:nowrap"><b>${esc(s.name)}</b></td>${days.map(d => { const r = getRec(s.id, d); return `<td class="r ${r && r.att === 'a' && !blank ? 'abs' : ''}">${cell(r)}</td>`; }).join('')}${blank ? '' : `<td><b>${num(o.hifz)}</b></td><td><b>${num(o.review)}</b></td><td>${o.a || ''}</td>`}</tr>`; });
  h += `</table></div><div class="rep-foot"><span>توقيع المعلم: ..................</span><span>توقيع المشرف: ..................</span></div>`;
  return h;
}
function classReport(cid, from, to, lbl) {
  const c = byId('classes', cid); if (!c) return ''; const t = teacherOf(c);
  const rk = rankClass(cid, from, to);
  const tot = rk.reduce((a, x) => (a.h += x.o.hifz, a.r += x.o.review, a.a += x.o.a, a), { h: 0, r: 0, a: 0 });
  let h = repHeader('التقرير الإجمالي للفصل مع الترتيب', lbl);
  h += `<div class="rep-meta"><span>الفصل: <b>${esc(c.name)}</b></span><span>المعلم: <b>${esc(t ? t.name : '')}</b></span><span>عدد الطلاب: <b>${rk.length}</b></span></div>`;
  h += kpis([[num(tot.h), 'إجمالي أوجه الحفظ'], [num(tot.r), 'إجمالي أوجه المراجعة'], [num(tot.h + tot.r), 'الإجمالي العام'], [tot.a, 'إجمالي الغياب'], [rk.length ? num((tot.h + tot.r) / rk.length) : 0, 'متوسط الأوجه للطالب']]);
  h += `<table class="tbl"><tr><th>الترتيب</th><th>اسم الطالب</th><th>أوجه الحفظ</th><th>أوجه المراجعة</th><th>الإجمالي</th><th>الحضور</th><th>الغياب</th><th>متوسط التقدير</th><th>النقاط</th><th>المستوى</th></tr>${rk.map(x => `<tr><td>${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</td><td class="r"><b>${esc(x.s.name)}</b></td><td>${num(x.o.hifz)}</td><td>${num(x.o.review)}</td><td><b>${num(x.o.total)}</b></td><td>${x.o.p + x.o.l}</td><td>${x.o.a}</td><td>${x.o.gcnt ? gradeLabel(Math.round(x.o.gavg)) : ''}</td><td>${x.o.points}</td><td>${levelOf(x.o)}</td></tr>`).join('')}</table>`;
  return h + `<div class="rep-foot"><span>المعلم: ${esc(t ? t.name : '')}</span><span>المشرف: ${esc(S.settings.supervisor || '')}</span></div>`;
}
function allReport(from, to, lbl) {
  const rows = T('classes').map(c => { const st = studentsOfClass(c.id); const os = st.map(s => statsOf(s.id, from, to)); const sum = k => os.reduce((a, o) => a + o[k], 0); return { c, t: teacherOf(c), n: st.length, h: sum('hifz'), r: sum('review'), a: sum('a'), d: sum('days'), top: rankClass(c.id, from, to)[0] }; });
  const T2 = rows.reduce((a, x) => (a.n += x.n, a.h += x.h, a.r += x.r, a.a += x.a, a), { n: 0, h: 0, r: 0, a: 0 });
  let h = repHeader('لوحة المشرف — التقرير الإجمالي', lbl);
  h += kpis([[rows.length, 'عدد الفصول'], [new Set(rows.map(x => x.t && x.t.id).filter(Boolean)).size, 'عدد المعلمين'], [T2.n, 'عدد الطلاب'], [num(T2.h), 'إجمالي أوجه الحفظ'], [num(T2.r), 'إجمالي أوجه المراجعة'], [num(T2.h + T2.r), 'الإجمالي العام'], [T2.a, 'إجمالي الغياب']]);
  h += `<table class="tbl"><tr><th>م</th><th>الفصل</th><th>المعلم</th><th>الطلاب</th><th>أوجه الحفظ</th><th>أوجه المراجعة</th><th>الإجمالي</th><th>الغياب</th><th>نسبة الغياب</th><th>متوسط الأوجه للطالب</th><th>الأول في الفصل</th></tr>${rows.map((x, i) => `<tr><td>${i + 1}</td><td class="r"><b>${esc(x.c.name)}</b></td><td>${esc(x.t ? x.t.name : '')}</td><td>${x.n}</td><td>${num(x.h)}</td><td>${num(x.r)}</td><td><b>${num(x.h + x.r)}</b></td><td>${x.a}</td><td>${x.d ? Math.round(x.a / x.d * 100) : 0}%</td><td>${x.n ? num((x.h + x.r) / x.n) : 0}</td><td>${x.top && x.top.o.total ? '🥇 ' + esc(x.top.s.name) : ''}</td></tr>`).join('')}<tr style="font-weight:800"><td colspan="3">الإجمالي العام</td><td>${T2.n}</td><td>${num(T2.h)}</td><td>${num(T2.r)}</td><td>${num(T2.h + T2.r)}</td><td>${T2.a}</td><td colspan="3"></td></tr></table>`;
  return h;
}
function attReport(cid, from, to, lbl) {
  const c = byId('classes', cid); if (!c) return ''; const st = studentsOfClass(cid);
  let h = repHeader('تقرير الحضور والغياب', lbl) + `<div class="rep-meta"><span>الفصل: <b>${esc(c.name)}</b></span><span>المعلم: <b>${esc((teacherOf(c) || {}).name || '')}</b></span></div>`;
  h += `<table class="tbl"><tr><th>م</th><th>الطالب</th><th>أيام مسجلة</th><th>حاضر</th><th>متأخر</th><th>مستأذن</th><th>غائب</th><th>نسبة الحضور</th><th>أيام الغياب</th></tr>${st.map((s, i) => { const o = statsOf(s.id, from, to); return `<tr><td>${i + 1}</td><td class="r"><b>${esc(s.name)}</b></td><td>${o.days}</td><td>${o.p}</td><td>${o.l}</td><td>${o.e}</td><td style="color:${o.a ? 'var(--red)' : ''};font-weight:700">${o.a}</td><td>${o.attPct}%</td><td class="r small">${o.recs.filter(r => r.att === 'a').map(r => fmtDate(r.date, false)).join('، ')}</td></tr>`; }).join('')}</table>`;
  return h;
}
function noorReport(cid, from, to, lbl) {
  const c = byId('classes', cid); if (!c) return ''; const st = studentsOfClass(cid);
  let h = repHeader('تقرير القاعدة النورانية', lbl) + `<div class="rep-meta"><span>الفصل: <b>${esc(c.name)}</b></span><span>المعلم: <b>${esc((teacherOf(c) || {}).name || '')}</b></span></div>`;
  h += `<table class="tbl"><tr><th>م</th><th>الطالب</th><th>الدرس الحالي</th><th>آخر بند</th><th>دروس الفترة</th><th>بنود الفترة</th><th>متوسط التقدير</th><th>بنود يخطئ فيها</th><th>التقدم في القاعدة</th></tr>${st.map((s, i) => {
    const all = recsOf(s.id).filter(r => r.noor && r.noor.lesson); const last = all[all.length - 1]; const per = all.filter(r => (!from || r.date >= from) && (!to || r.date <= to));
    const g = per.filter(r => r.noor.grade); const avg = g.length ? g.reduce((a, r) => a + r.noor.grade, 0) / g.length : 0;
    const errs = per.flatMap(r => (r.errors || []).filter(e => e.sub === 'noor' && !e.fixed).map(e => e.word)).filter(Boolean);
    const pct = last ? Math.round(((last.noor.lesson - 1) + (Math.max(last.noor.from || 0, last.noor.to || 0) / NOORANIA[last.noor.lesson - 1].items.length)) / NOORANIA.length * 100) : 0;
    return `<tr><td>${i + 1}</td><td class="r"><b>${esc(s.name)}</b></td><td class="r">${last ? esc(NOORANIA[last.noor.lesson - 1].title) : '—'}</td><td>${last && last.noor.to ? esc(NOORANIA[last.noor.lesson - 1].items[Math.max(last.noor.from, last.noor.to) - 1] || '') : ''}</td><td>${new Set(per.map(r => r.noor.lesson)).size}</td><td>${per.reduce((a, r) => a + Math.abs((r.noor.to || 0) - (r.noor.from || 0)) + (r.noor.from ? 1 : 0), 0)}</td><td>${avg ? gradeLabel(Math.round(avg)) : ''}</td><td class="small">${[...new Set(errs)].slice(0, 8).join('، ')}</td><td><div class="prog" style="min-width:80px"><i style="width:${pct}%"></i></div><small>${pct}%</small></td></tr>`; }).join('')}</table>`;
  return h;
}
function zadReport(cid, from, to, lbl) {
  const c = byId('classes', cid); if (!c) return ''; const st = studentsOfClass(cid); const Z = zadCurriculum();
  let h = repHeader('تقرير زاد الطفل المسلم', lbl) + `<div class="rep-meta"><span>الفصل: <b>${esc(c.name)}</b></span><span>المعلم: <b>${esc((teacherOf(c) || {}).name || '')}</b></span></div>`;
  h += `<table class="tbl"><tr><th>م</th><th>الطالب</th>${Z.map(z => `<th>${z.icon} ${esc(z.name)}</th>`).join('')}<th>المجموع</th></tr>${st.map((s, i) => { const items = recsOf(s.id, from, to).flatMap(r => r.zad || []); return `<tr><td>${i + 1}</td><td class="r"><b>${esc(s.name)}</b></td>${Z.map(z => { const it = items.filter(x => x.cat === z.id); const u = [...new Set(it.map(x => x.item))]; return `<td class="small" title="${esc(u.join('، '))}"><b>${u.length}</b>/${z.items.length}</td>`; }).join('')}<td><b>${new Set(items.map(x => x.cat + x.item)).size}</b></td></tr>`; }).join('')}</table>`;
  Z.forEach(z => { h += `<div class="rep-sec">${z.icon} ${esc(z.name)}</div><table class="tbl"><tr><th>البند</th>${st.map(s => `<th style="font-size:10px;writing-mode:vertical-rl;max-height:110px">${esc(s.name.split(' ').slice(0, 2).join(' '))}</th>`).join('')}</tr>${z.items.map(it => `<tr><td class="r">${esc(it)}</td>${st.map(s => { const got = recsOf(s.id, from, to).flatMap(r => r.zad || []).filter(x => x.cat === z.id && x.item === it); const g = Math.max(0, ...got.map(x => x.grade || 3)); return `<td>${got.length ? (g >= 4 ? '✅' : g >= 3 ? '☑️' : '🔄') : ''}</td>`; }).join('')}</tr>`).join('')}</table>`; });
  return h + '<div class="small muted">✅ متقن — ☑️ جيد — 🔄 يحتاج إعادة</div>';
}
function errorsReport(cid, from, to, lbl) {
  const c = byId('classes', cid); if (!c) return ''; const st = studentsOfClass(cid);
  let h = repHeader('تقرير الأخطاء والتصويب', lbl) + `<div class="rep-meta"><span>الفصل: <b>${esc(c.name)}</b></span></div>`;
  const rows = []; st.forEach(s => recsOf(s.id, from, to).forEach(r => (r.errors || []).forEach(e => rows.push({ s, r, e }))));
  const fixed = rows.filter(x => x.e.fixed).length;
  h += kpis([[rows.length, 'إجمالي الأخطاء'], [fixed, '✅ تم تصويبها'], [rows.length - fixed, '❌ تحتاج متابعة'], [rows.length ? Math.round(fixed / rows.length * 100) + '%' : '—', 'نسبة التصويب']]);
  const types = {}; rows.forEach(x => types[x.e.type] = (types[x.e.type] || 0) + 1);
  if (rows.length) h += `<div class="small" style="margin-bottom:8px">أكثر الأخطاء: ${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="chip red">${esc(t)}: ${n}</span>`).join(' ')}</div>`;
  h += rows.length ? `<table class="tbl"><tr><th>التاريخ</th><th>الطالب</th><th>الخطأ والتصويب</th></tr>${rows.map(x => `<tr><td>${fmtDate(x.r.date, false)}</td><td class="r">${esc(x.s.name)}</td><td class="r">${errText(x.e)}</td></tr>`).join('')}</table>` : '<div class="empty small">لا توجد أخطاء مسجلة ✨</div>';
  return h;
}
function feesReport(cid) {
  const st = activeStudents().filter(s => !cid || s.classId === cid).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const rows = st.map(s => ({ s, f: feeOf(s), p: paidOf(s) }));
  const tf = rows.reduce((a, x) => a + x.f, 0), tp = rows.reduce((a, x) => a + x.p, 0);
  let h = repHeader('تقرير الرسوم والسداد', cid ? esc(byId('classes', cid).name) : 'جميع الفصول');
  h += kpis([[num(tf), 'إجمالي الرسوم'], [num(tp), 'المسدد'], [num(Math.max(0, tf - tp)), 'المتبقي'], [tf ? Math.round(tp / tf * 100) + '%' : '—', 'نسبة التحصيل']]);
  h += `<table class="tbl"><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>الرسوم</th><th>المسدد</th><th>المتبقي</th><th>الدفعات</th></tr>${rows.map((x, i) => `<tr><td>${i + 1}</td><td class="r">${esc(x.s.name)}</td><td>${esc((classOf(x.s) || {}).name || '')}</td><td>${num(x.f)}</td><td>${num(x.p)}</td><td style="font-weight:700;color:${x.f - x.p > 0 ? 'var(--red)' : ''}">${num(Math.max(0, x.f - x.p))}</td><td class="small">${T('payments').filter(p => p.studentId === x.s.id).map(p => num(p.amount) + ' (' + fmtDate(p.date, false) + ')').join('، ')}</td></tr>`).join('')}</table>`;
  return h;
}
