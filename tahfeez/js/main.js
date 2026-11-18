/* ===================== التشغيل والتنقل ===================== */
const ROUTES = { home: viewHome, daily: viewDaily, students: viewStudents, register: viewRegister, classes: viewClasses, reports: viewReports, leaders: viewLeaders, fees: viewFees, settings: viewSettings };
const URLQ = new URLSearchParams(location.search);

function render() {
  const app = $('#app');
  if (URLQ.get('p')) return viewParent(app, URLQ.get('p'));
  if (URLQ.get('reg')) return viewRegForm(app);
  if (S.server && !S.token) return viewLogin(app);
  const [, page = 'home', sub, arg] = (location.hash || '#/home').split('/');
  if (page === 'tv') return viewTV(app);
  const fn = ROUTES[page] || viewHome;
  const scrollY = window.scrollY;
  const keep = app._page === page + '/' + (sub || '');
  app.innerHTML = shell(page in ROUTES ? page : 'home');
  bindShell();
  fn($('#view'), sub, arg);
  app._page = page + '/' + (sub || '');
  if (keep) window.scrollTo(0, scrollY);
}
window.addEventListener('hashchange', () => { $('#modal-root').innerHTML = ''; render(); window.scrollTo(0, 0); });

/* ——— بيانات تجريبية من كشوفك ——— */
function loadDemo() {
  const names1 = ['البراء أحمد محمد بامشموس', 'خالد رايد حميد المالكي', 'صالح بن مبارك صالح المعيوف', 'عمر عصام عبدالقادر الشهاري', 'فارس عبدالرحمن حمد القرينيس', 'فيصل خالد حسن القحطاني', 'مالك عبدالله صالح العمودي', 'محمد عبدالله بطي القحطاني'];
  const names2 = ['إبراهيم محمد الدوسري', 'اسامة محمد مأمون النابلسي', 'أنس عبدالمجيد خميس الغامدي', 'تركي معاذ خالد العتيبي', 'تميم شريف فتحي', 'ناصر عبدالعزيز ناصر', 'يوسف رامي عفانه'];
  const t1 = save('users', { id: 'u_demo1', name: 'صلاح سالم', role: 'teacher', username: 'salah', active: true, phone: '0500000001' });
  const t2 = save('users', { id: 'u_demo2', name: 'السيد معوض', role: 'teacher', username: 'sayed', active: true, phone: '0500000002' });
  const c1 = save('classes', { id: 'c_demo1', name: 'فصل البراعم (١)', teacherId: t1.id, track: 'mixed', subjects: ['quran', 'noor', 'zad'] });
  const c2 = save('classes', { id: 'c_demo2', name: 'حلقة الصديق', teacherId: t2.id, track: 'quran', subjects: ['quran', 'zad'] });
  const mk = (n, cid, i) => save('students', { id: 's_demo_' + cid + i, name: n, status: 'active', classId: cid, guardianPhone: '05' + String(50000000 + i * 7919).slice(0, 8), guardianName: 'ولي أمر ' + n.split(' ')[1], birthDate: (2019 + i % 3) + '-0' + (1 + i % 9) + '-15', parentToken: token20(), direction: 'desc', fee: 600, source: 'manual', relation: 'أب' });
  const S1 = names1.map((n, i) => mk(n, c1.id, i)), S2 = names2.map((n, i) => mk(n, c2.id, i));
  ['محمد علي الزهراني', 'عبدالله فهد الشمري'].forEach((n, i) => save('students', { id: 's_pend' + i, name: n, status: 'pending', source: 'form', guardianPhone: '055123456' + i, guardianName: 'فهد', birthDate: '2020-03-0' + (i + 1), nationality: 'سعودي', parentToken: token20(), health: i ? 'حساسية من الفول السوداني' : 'لا' }));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const days = []; for (let d = addDays(todayISO(), -16); d <= todayISO(); d = addDays(d, 1)) if ([0, 1, 2, 3, 4].includes(parseISO(d).getDay())) days.push(d);
  const zcur = zadCurriculum();
  [[S1, true], [S2, false]].forEach(([list, noor]) => list.forEach((s, si) => {
    let pos = { s: 114, a: 1 }; let nl = 1 + si % 4, ni = 1; let rev = null;
    days.forEach((d, di) => {
      const r = { id: recId(s.id, d), studentId: s.id, classId: s.classId, date: d, att: Math.random() < .08 ? 'a' : Math.random() < .06 ? 'l' : 'p', errors: [], zad: [] };
      if (r.att !== 'a') {
        const c = Q.count(pos.s); const len = rnd(2, 5); const a2 = Math.min(c, pos.a + len - 1);
        r.hifz = { s1: pos.s, a1: pos.a, s2: pos.s, a2, grade: rnd(2, 5) }; r.hifz.pages = Q.pagesBetween(pos.s, pos.a, pos.s, a2);
        if (Math.random() < .3 && ayahTextAvailable(pos.s)) { const w = wordOf(pos.s, pos.a, 1); r.errors.push({ id: uid('e'), sub: 'hifz', s: pos.s, a: pos.a, w: 1, word: w, type: 'خطأ في الحركة', note: 'تم التصويب مع المعلم', fixed: Math.random() < .6 }); }
        if (rev) { r.review = Object.assign({}, rev, { grade: rnd(3, 5) }); r.review.pages = Q.pagesBetween(rev.s1, rev.a1, rev.s2, rev.a2); }
        rev = { s1: r.hifz.s1, a1: 1, s2: r.hifz.s2, a2: a2 };
        pos = a2 >= c ? { s: pos.s - 1, a: 1 } : { s: pos.s, a: a2 + 1 };
        if (noor) { const L = NOORANIA[nl - 1]; const to = Math.min(L.items.length, ni + rnd(6, 15)); r.noor = { lesson: nl, from: ni, to, grade: rnd(2, 5) }; if (Math.random() < .3) r.errors.push({ id: uid('e'), sub: 'noor', lesson: nl, item: ni + 1, word: L.items[ni], type: 'خطأ في الحرف', note: '', fixed: false }); ni = to + 1; if (ni > L.items.length) { nl = Math.min(NOORANIA.length, nl + 1); ni = 1; } }
        if (di % 2 === 0) { const z = zcur[di % zcur.length]; r.zad.push({ cat: z.id, item: z.items[(di / 2 + si) % z.items.length | 0], grade: rnd(3, 5) }); }
        r.behavior = rnd(3, 5);
        if (Math.random() < .25) r.note = ['أحسنت، ممتاز 👏', 'يحتاج مراجعة في البيت', 'تحسن ملحوظ'][rnd(0, 2)];
      }
      save('records', r);
    });
    if (si % 3 !== 2) save('payments', { id: uid('p'), studentId: s.id, amount: si % 3 === 0 ? 600 : 300, date: days[0], method: 'نقداً', receipt: si + 1 });
  }));
  saveSettings({ supervisor: 'محمود يحيى', feeDefault: 600 });
}

/* ——— بدء التشغيل ——— */
(function boot() {
  loadLocal();
  const sp = URLQ.get('s');
  if (sp && /^https:\/\/script\.google/.test(sp) && sp !== S.server) {
    S.server = sp;
    if (!URLQ.get('p') && !URLQ.get('reg')) { localStorage.setItem(LS.server, sp); history.replaceState(null, '', location.pathname + location.hash); }
  }
  render();
  if (!URLQ.get('p') && !URLQ.get('reg') && S.token) pull(true).then(ok => { if (ok) render(); });
  setInterval(() => { if (S.token && !document.hidden && !$('.modal-bg')) pull(true).then(ok => ok && !$('.modal-bg') && !location.hash.startsWith('#/tv') && render()); }, 120000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
