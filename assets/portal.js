/* The Shadrach Fellowship Portal
 * A small single-page app. All data comes from the Apps Script backend in backend/tsf-portal/Code.gs,
 * which checks who is signed in on every request. Nothing private is stored in this file.
 */
(function () {
  'use strict';

  // DEVELOPER: paste the TSF Portal web app URL (it ends in /exec) between the quotes.
  // Steps are in backend/tsf-portal/README.md.
  var CONFIG = { endpoint: 'https://script.google.com/macros/s/AKfycbyEFcjuFfmx-qP1W0MCLE4tCUvfZzW8aA1HQx5B3sCICHsRweCYMnvaF2n9xyxNUjHw/exec' };
  var API = window.TSF_PORTAL_API || CONFIG.endpoint;

  var app = document.getElementById('app');
  var S = { token: '', data: null, fd: null, viewAs: '', version: 0, modal: null, loginStep: 'email', loginEmail: '', bibleTimer: null, cache: {} };

  /* ================================================================ storage */
  var store = {
    get: function (k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: function (k, v, remember) {
      try { (remember ? localStorage : sessionStorage).setItem(k, v); (remember ? sessionStorage : localStorage).removeItem(k); } catch (e) { /* private mode */ }
    },
    del: function (k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
    sget: function (k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
    sset: function (k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ================================================================ helpers */
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  function by(field) { return function (a, b) { return a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0; }; }
  function mapBy(list, field) { var o = {}; (list || []).forEach(function (x) { o[x[field]] = x; }); return o; }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || 'friend'; }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s || '').slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2] || 1); }
  function todayISO() { return window.TSF_FAKE_TODAY || iso(new Date()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmt(s, long) { if (!s) return ''; var d = parse(s); return (long ? DAYS[d.getDay()] + ', ' : '') + d.getDate() + ' ' + (long ? MONTHS_LONG : MONTHS)[d.getMonth()] + (long ? ' ' + d.getFullYear() : ''); }
  function fmtStamp(s) { if (!s) return ''; var d = new Date(s); if (isNaN(d)) return ''; return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function quarterOf(s) { var m = parse(s).getMonth() + 1; return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4'; }
  function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }
  function upsert(list, rec, key) { key = key || 'id'; for (var i = 0; i < list.length; i++) if (list[i][key] === rec[key]) { list[i] = rec; return list; } list.push(rec); return list; }
  function bump() { S.version++; S.cache = {}; }
  function F() { return S.viewAs ? S.fd : S.data; }
  function canEdit() { return !S.viewAs; }
  function isAdmin() { return S.data && S.data.me && S.data.me.role === 'admin'; }
  function count1(s) { return (String(s || '').match(/1/g) || []).length; }

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2.5zM20 19v3H6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M9 11h6M9 15h4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    library: '<path d="M4 3h4v18H4zM10 3h4v18h-4zM16 4l4 1-3 16-4-1z"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="m15 6-6 6 6 6"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z"/>',
    heart: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M12 8S10.5 3 7.5 3.5 7 8 12 8zM12 8s1.5-5 4.5-4.5S17 8 12 8z"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }

  function ring(value, size, color, label) {
    size = size || 64;
    var r = size / 2 - 6, c = 2 * Math.PI * r, v = clamp(value || 0, 0, 100);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(label || v + '%') + '">' +
      '<circle class="bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"/>' +
      '<circle class="fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="' + (color || 'var(--purple-mid)') + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - v / 100)).toFixed(1) + '"/>' +
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">' + Math.round(v) + '%</text></svg>';
  }

  function chip(text, tone) { return '<span class="chip ' + (tone || '') + '">' + esc(text) + '</span>'; }
  function empty(ic, text) { return '<div class="empty">' + icon(ic) + '<div>' + text + '</div></div>'; }

  var ATT = { present: ['Present', 'green'], late: ['Late', 'green'], excused: ['Excused', 'amber'], absent: ['Absent', 'red'], dropped: ['Dropped off', ''] };
  var STATUS = { 'not-started': ['Not started', ''], 'in-progress': ['In progress', 'amber'], submitted: ['Submitted', 'blue'], done: ['Done', 'green'], approved: ['Approved', 'green'], returned: ['Needs work', 'red'], draft: ['Draft', 'amber'], evaluated: ['Evaluated', 'green'], 'not-submitted': ['Not submitted', ''] };
  var KIND = { bible: 'Bible plan', activity: 'Activity', mentees: 'Disciple making', hi5: 'Hi 5 prayer', submission: 'Submission', assessment: 'Assessment', reading: 'Reading', course: 'Course', report: 'Quarterly report' };

  /* ================================================================ toast and modal */
  function toast(msg, bad) {
    var box = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.innerHTML = (bad ? '' : icon('check')) + '<span>' + esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, bad ? 5200 : 2800);
  }

  function openModal(title, body, wide) {
    closeModal();
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">' + esc(title) + '</h2><button class="icon-btn" type="button" data-act="close-modal" aria-label="Close">' + icon('x') + '</button></div>' + body + '</div>';
    back.addEventListener('mousedown', function (e) { if (e.target === back) closeModal(); });
    document.body.appendChild(back);
    S.modal = back;
    S.modalReturn = document.activeElement;
    var f = back.querySelector('input:not([type=hidden]):not([disabled]), textarea, select');
    if (f && window.innerWidth > 900) f.focus(); else back.querySelector('.modal').focus && back.querySelector('.icon-btn').focus();
    return back;
  }
  function closeModal() {
    if (S.modal) { S.modal.remove(); S.modal = null; if (S.modalReturn && S.modalReturn.focus) S.modalReturn.focus(); }
  }
  function confirmBox(message, okLabel, danger) {
    return new Promise(function (resolve) {
      var m = openModal('Please confirm', '<p>' + esc(message) + '</p><div class="form-actions"><button class="btn ' + (danger ? 'btn-danger' : '') + '" data-yes>' + esc(okLabel || 'Yes') + '</button><button class="btn btn-ghost" data-no>Cancel</button></div>');
      m.querySelector('[data-yes]').onclick = function () { closeModal(); resolve(true); };
      m.querySelector('[data-no]').onclick = function () { closeModal(); resolve(false); };
    });
  }

  function busy(btn, on) { if (!btn) return; btn.disabled = !!on; btn.classList.toggle('loading', !!on); }

  /* ================================================================ API */
  function api(action, payload) {
    if (!API) return Promise.reject(new Error('The portal is not connected yet. Please ask the TSF team to finish the setup.'));
    var body = Object.assign({ action: action, token: S.token }, payload || {});
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('The server did not respond (' + r.status + '). Please try again.'); return r.json(); })
      .catch(function (e) { if (e instanceof SyntaxError) throw new Error('The server sent an unexpected reply. Please try again.'); if (/fetch|network|Load failed/i.test(e.message)) throw new Error('You seem to be offline. Please check your connection and try again.'); throw e; })
      .then(function (res) {
        if (res && res.signedOut) { signOutLocal(); throw new Error(res.error); }
        if (!res || !res.ok) throw new Error((res && res.error) || 'Something went wrong. Please try again.');
        return res;
      });
  }

  function run(btn, promise, okMsg) {
    busy(btn, true);
    return promise.then(function (r) { busy(btn, false); if (okMsg) toast(okMsg); return r; }, function (e) { busy(btn, false); toast(e.message, true); throw e; });
  }

  function signOutLocal() {
    store.del('tsf.token'); store.sset('tsf.viewAs', '');
    S.token = ''; S.data = null; S.fd = null; S.viewAs = ''; S.loginStep = 'email'; bump();
    closeModal();
    if (!/^#\/shared\//.test(location.hash)) location.hash = '#/';
    render();
  }

  function load() {
    app.innerHTML = '<div class="boot"><div><div class="spinner"></div>Loading your portal</div></div>';
    return api('bootstrap').then(function (r) {
      S.data = r.data; bump();
      if (S.viewAs && isAdmin()) return api('bootstrap', { as: S.viewAs }).then(function (r2) { S.fd = r2.data; bump(); });
      S.viewAs = '';
    }).then(render, function (e) {
      if (!S.token) return render();
      app.innerHTML = '<div class="boot"><div><p>' + esc(e.message) + '</p><button class="btn" data-act="reload">Try again</button> <button class="btn btn-ghost" data-act="sign-out">Sign out</button></div></div>';
    });
  }

  /* ================================================================ derived numbers */
  function fm(d) {
    if (S.cache.fm) return S.cache.fm;
    var today = todayISO();
    var sessions = (d.sessions || []).slice().sort(by('date'));
    var real = sessions.filter(function (s) { return s.kind !== 'break'; });
    var held = real.filter(function (s) { return s.date < today && s.kind !== 'induction'; });
    var next = real.filter(function (s) { return s.date >= today; })[0] || null;
    var last = held[held.length - 1] || null;
    var att = mapBy(d.attendance, 'sessionId'), refl = mapBy(d.reflections, 'sessionId');
    var marked = held.filter(function (s) { return att[s.id]; });
    var present = marked.filter(function (s) { return att[s.id].status === 'present' || att[s.id].status === 'late'; }).length;
    var reflCount = held.filter(function (s) { return refl[s.id]; }).length;
    var st = d.settings || {};
    var bdays = String((d.bible && d.bible.days) || '');
    var bstart = st.bibleStart || st.startDate || today;
    var expected = clamp(daysBetween(bstart, today) + 1, 0, 365);
    var bdone = count1(bdays);
    var streak = 0;
    for (var i = Math.min(expected, 365) - 1; i >= 0; i--) { if (bdays.charAt(i) === '1') streak++; else if (i === expected - 1) continue; else break; }
    var prog = mapBy(d.progress, 'taskId');
    var tasks = (d.tasks || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var mentees = (d.mentees || []).filter(function (x) { return x.status !== 'ended'; });
    var hi5 = d.hi5 || null;
    var reports = mapBy(d.reports, 'quarter');
    var model = {
      today: today, sessions: sessions, real: real, held: held, next: next, last: last, att: att, refl: refl,
      marked: marked.length, present: present, attRate: marked.length ? pct(present, marked.length) : null,
      reflCount: reflCount, bibleDays: bdays, bibleStart: bstart, bibleExpected: expected, bibleDone: bdone, bibleBehind: Math.max(0, expected - bdone), bibleStreak: streak,
      prog: prog, tasks: tasks, mentees: mentees, hi5: hi5, reports: reports,
      totalWeeks: real.reduce(function (m, s) { return Math.max(m, s.week || 0); }, 0)
    };
    model.week = next ? (next.week || 0) : (last ? last.week : 0);
    model.started = today >= (st.startDate || '0000');
    model.tState = function (t) { return taskState(t, model); };
    var tdone = tasks.filter(function (t) { var x = model.tState(t); return x.done; }).length;
    model.tasksDone = tdone;
    S.cache.fm = model;
    return model;
  }

  function taskState(t, m) {
    var p = m.prog[t.id];
    if (t.kind === 'bible') { var pc = pct(m.bibleDone, 365); return { status: pc >= 100 ? 'done' : m.bibleDone ? 'in-progress' : 'not-started', percent: pc, done: pc >= 100, auto: true }; }
    if (t.kind === 'mentees') { var n = m.mentees.length; return { status: n >= 3 ? 'done' : n ? 'in-progress' : 'not-started', percent: pct(Math.min(n, 3), 3), done: n >= 3, auto: true, note: plural(n, 'disciple') }; }
    if (t.kind === 'hi5') { var h = m.hi5, k = h && h.members ? h.members.length : 0, ok = k >= 5 && h.peopleGroup; return { status: ok ? 'done' : (h ? 'in-progress' : 'not-started'), percent: pct(Math.min(k, 5) + (h && h.peopleGroup ? 1 : 0), 6), done: !!ok, auto: true, note: k + ' of 5 members' }; }
    if (t.kind === 'report') {
      var q = String(t.title).slice(0, 2); var r = m.reports[q];
      var st = !r ? 'not-started' : r.evaluation && r.evaluation.released ? 'evaluated' : r.status === 'submitted' ? 'submitted' : 'draft';
      return { status: st === 'draft' ? 'in-progress' : st, percent: st === 'not-started' ? 0 : st === 'in-progress' || st === 'draft' ? 50 : 100, done: st === 'submitted' || st === 'evaluated', auto: true, quarter: q };
    }
    if (!p) return { status: 'not-started', percent: 0, done: false };
    var done = p.status === 'done' || p.status === 'approved' || p.status === 'submitted';
    return { status: p.status, percent: done ? 100 : (p.percent || (p.status === 'in-progress' ? 10 : 0)), done: done, p: p };
  }

  function am(d) {
    if (S.cache.am) return S.cache.am;
    var today = todayISO();
    var fellows = d.people.filter(function (p) { return p.role === 'fellow' && p.status !== 'removed'; }).sort(by('name'));
    var active = fellows.filter(function (p) { return p.status === 'active'; });
    var sessions = d.sessions.slice().sort(by('date'));
    var real = sessions.filter(function (s) { return s.kind !== 'break'; });
    var held = real.filter(function (s) { return s.date < today && s.kind !== 'induction'; });
    var att = {}; d.attendance.forEach(function (a) { att[a.personId + '|' + a.sessionId] = a; });
    var refl = {}; d.reflections.forEach(function (r) { refl[r.personId + '|' + r.sessionId] = r; });
    var bible = mapBy(d.bible, 'personId');
    var hi5 = mapBy(d.hi5, 'personId');
    var st = d.settings;
    var bstart = st.bibleStart || st.startDate || today;
    var expected = clamp(daysBetween(bstart, today) + 1, 0, 365);
    var progBy = {}; d.progress.forEach(function (p) { (progBy[p.personId] = progBy[p.personId] || {})[p.taskId] = p; });
    var stats = {};
    fellows.forEach(function (f) {
      var marked = held.filter(function (s) { return att[f.id + '|' + s.id]; });
      var present = marked.filter(function (s) { var a = att[f.id + '|' + s.id].status; return a === 'present' || a === 'late'; }).length;
      var rc = held.filter(function (s) { return refl[f.id + '|' + s.id]; }).length;
      var bd = count1(bible[f.id] && bible[f.id].days);
      var model = { bibleDone: bd, mentees: d.mentees.filter(function (x) { return x.personId === f.id && x.status !== 'ended'; }), hi5: hi5[f.id] || null, prog: progBy[f.id] || {}, reports: mapBy(d.reports.filter(function (r) { return r.personId === f.id; }), 'quarter') };
      var dueTasks = d.tasks.filter(function (t) { return t.due && t.due <= today; });
      var tdone = d.tasks.filter(function (t) { return taskState(t, model).done; }).length;
      var overdue = dueTasks.filter(function (t) { return !taskState(t, model).done; }).length;
      var flags = [];
      var last2 = held.slice(-2), last3 = held.slice(-3);
      if (f.status === 'active') {
        if (last2.length === 2 && last2.every(function (s) { var a = att[f.id + '|' + s.id]; return a && a.status === 'absent'; })) flags.push('Missed the last two sessions');
        if (last3.length === 3 && last3.every(function (s) { return !refl[f.id + '|' + s.id]; })) flags.push('No reflection in three weeks');
        if (expected - bd > 21) flags.push('Bible plan ' + (expected - bd) + ' days behind');
        if (overdue >= 2) flags.push(plural(overdue, 'overdue assignment'));
      }
      stats[f.id] = { attRate: marked.length ? pct(present, marked.length) : null, marked: marked.length, present: present, refl: rc, bibleDone: bd, bibleBehind: Math.max(0, expected - bd), tasksDone: tdone, overdue: overdue, mentees: model.mentees.length, hi5: model.hi5 && model.hi5.members ? model.hi5.members.length : 0, flags: flags };
    });
    var lastHeld = held[held.length - 1] || null;
    var next = real.filter(function (s) { return s.date >= today; })[0] || null;
    var out = { today: today, fellows: fellows, active: active, sessions: sessions, real: real, held: held, att: att, refl: refl, stats: stats, lastHeld: lastHeld, next: next, expected: expected };
    S.cache.am = out;
    return out;
  }

  function quarterInfo(q) { return ((S.data && S.data.settings.quarters) || []).filter(function (x) { return x.q === q; })[0] || { q: q, name: '', field: '' }; }
  function currentQuarter() { return quarterOf(todayISO() < (F().settings.startDate || '') ? F().settings.startDate : todayISO()); }

  /* ================================================================ files, CSV, calendar */
  function b64ToBlob(b64, type) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
  }
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // keep spreadsheets from running it as a formula
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCsv(name, rows) { saveBlob(new Blob(['﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }), name); }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Files must be 5 MB or smaller.'));
      var r = new FileReader();
      r.onload = function () { resolve({ name: file.name, type: file.type, data: String(r.result).split(',')[1] }); };
      r.onerror = function () { reject(new Error('That file could not be read.')); };
      r.readAsDataURL(file);
    });
  }
  function icsFor(sessions, cohort) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The HuD Group//TSF Portal//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + (cohort || 'The Shadrach Fellowship')];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    sessions.filter(function (s) { return s.kind !== 'break'; }).forEach(function (s) {
      var d = s.date.replace(/-/g, ''), e = addDays(s.date, 1).replace(/-/g, '');
      var desc = [s.passage ? 'Passage: ' + s.passage : '', s.link ? 'Join: ' + s.link : '', 'Portal: ' + location.origin + location.pathname + '#/session/' + s.id].filter(String).join('\\n');
      lines.push('BEGIN:VEVENT', 'UID:' + s.id + '@tsf-portal', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + e, 'SUMMARY:' + ('TSF: ' + s.title).replace(/[,;]/g, '\\$&'), 'DESCRIPTION:' + desc.replace(/[,;]/g, '\\$&'), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  }

  /* ================================================================ routing */
  function route() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/').filter(String).map(decodeURIComponent);
    return { name: parts[0] || '', a: parts[1] || '', b: parts[2] || '', c: parts[3] || '', raw: h };
  }

  function render() {
    closeModal();
    var r = route();
    if (r.name === 'shared') return vShared(r.a);
    if (!S.token) return vLogin();
    if (!S.data) return load();
    var admin = isAdmin();
    if (admin && !S.viewAs && r.name !== 'admin') { location.replace('#/admin'); return; }
    if (admin && S.viewAs && r.name === 'admin') { S.viewAs = ''; S.fd = null; store.sset('tsf.viewAs', ''); bump(); }
    if (!admin && r.name === 'admin') { location.replace('#/home'); return; }
    var view = admin && !S.viewAs ? ADMIN_VIEWS[r.a || 'overview'] : FELLOW_VIEWS[r.name || 'home'];
    if (!view) { location.replace(admin && !S.viewAs ? '#/admin' : '#/home'); return; }
    var out = view(r);
    app.innerHTML = shell(out, r);
    window.scrollTo(0, 0);
    var h1 = app.querySelector('h1');
    document.title = (h1 ? h1.textContent + ' | ' : '') + 'TSF Portal';
    if (out.after) out.after();
  }

  window.addEventListener('hashchange', render);

  /* ================================================================ shell */
  var FELLOW_NAV = [
    ['home', 'Home', 'home'], ['journey', 'Journey', 'map'], ['bible', 'Bible in One Year', 'book'], ['disciples', 'My Disciples and Hi 5', 'users'],
    ['assignments', 'Assignments', 'clipboard'], ['reports', 'Quarterly Reports', 'chart'], ['resources', 'Resources', 'library'],
    ['voice', 'Concerns and Prayer', 'message'], ['profile', 'My Profile', 'user']
  ];
  var ADMIN_NAV = [
    ['', 'Overview', 'grid'], ['fellows', 'Fellows', 'users'], ['attendance', 'Attendance', 'check'], ['reflections', 'Reflections (DBS)', 'book'],
    ['assignments', 'Assignments', 'clipboard'], ['reports', 'Quarterly Reports', 'chart'], ['voice', 'Concerns', 'message'],
    ['roadmap', 'Roadmap', 'map'], ['content', 'Content and Settings', 'settings']
  ];

  function shell(out, r) {
    var admin = isAdmin() && !S.viewAs;
    var me = S.data.me;
    var active = admin ? (r.a === 'fellow' ? 'fellows' : r.a === 'report' ? 'reports' : r.a) : (r.name === 'session' ? 'journey' : r.name || 'home');
    var counts = admin ? adminCounts() : {};
    var nav = (admin ? ADMIN_NAV : FELLOW_NAV).map(function (n) {
      var href = admin ? '#/admin' + (n[0] ? '/' + n[0] : '') : '#/' + n[0];
      return '<a href="' + href + '" class="' + (active === n[0] ? 'active' : '') + '"' + (active === n[0] ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + esc(n[1]) + '</span>' + (counts[n[0]] ? '<span class="count">' + counts[n[0]] + '</span>' : '') + '</a>';
    }).join('');
    var tabs = admin ? [['', 'Overview', 'grid'], ['attendance', 'Attendance', 'check'], ['reflections', 'DBS', 'book'], ['fellows', 'Fellows', 'users']]
      : [['home', 'Home', 'home'], ['journey', 'Journey', 'map'], ['bible', 'Bible', 'book'], ['disciples', 'Disciples', 'users']];
    var tabbar = '<nav class="tabbar" aria-label="Main">' + tabs.map(function (t) {
      var href = admin ? '#/admin' + (t[0] ? '/' + t[0] : '') : '#/' + t[0];
      return '<a href="' + href + '" class="' + (active === t[0] ? 'active' : '') + '">' + icon(t[2]) + '<span>' + t[1] + '</span></a>';
    }).join('') + '<button type="button" data-act="more-menu">' + icon('more') + '<span>More</span></button></nav>';
    var person = S.viewAs ? S.fd.me : me;
    var banner = S.viewAs ? '<div class="viewas no-print">' + icon('eye') + '<span>You are viewing ' + esc(S.fd.me.name) + '\'s portal. It is read only.</span><button class="btn btn-sm" data-act="exit-view-as">Back to admin</button></div>' : '';
    return '<div class="shell">' +
      '<aside class="side" aria-label="Sidebar"><a class="brand" href="' + (admin ? '#/admin' : '#/home') + '"><img src="images/the-hud-group-logo-dark.png" alt="The HuD Group" width="119" height="40"><span><small>' + (admin ? 'Admin' : 'Fellows') + ' portal</small><b>Shadrach Fellowship</b></span></a>' +
      '<nav class="nav" aria-label="Main">' + nav + '</nav>' +
      '<div class="side-foot"><div class="me-card"><div class="avatar">' + esc(initials(me.name)) + '</div><div class="who"><b>' + esc(me.name) + '</b><small>' + esc(me.role === 'admin' ? 'Admin' : (S.data.settings.cohortName || 'Fellow')) + '</small></div><button class="icon-btn" data-act="sign-out" title="Sign out" aria-label="Sign out">' + icon('logout') + '</button></div></div></aside>' +
      '<div class="main">' + banner +
      '<header class="topbar no-print"><a class="mobile-brand" href="' + (admin ? '#/admin' : '#/home') + '"><picture><source srcset="images/the-hud-group-logo-dark.png" media="(prefers-color-scheme: dark)"><img src="images/the-hud-group-logo.png" alt="The HuD Group" width="101" height="34"></picture></a>' +
      '<span class="crumb">' + esc(S.data.settings.cohortName || 'The Shadrach Fellowship') + (S.viewAs ? ' &middot; ' + esc(person.name) : '') + '</span><span class="spacer"></span>' +
      '<span class="small muted" style="white-space:nowrap">' + esc(fmt(todayISO(), true)) + '</span>' +
      '</header><main class="content" id="main">' + out.html + '</main></div>' + tabbar + '</div>';
  }

  function adminCounts() {
    var d = S.data;
    return {
      voice: d.concerns.filter(function (c) { return c.status !== 'resolved'; }).length || 0,
      assignments: d.progress.filter(function (p) { return p.status === 'submitted'; }).length || 0,
      reports: d.reports.filter(function (r) { return r.status === 'submitted' && !(r.evaluation && r.evaluation.released); }).length || 0
    };
  }

  function head(title, sub, actions, eyebrow) {
    return '<div class="page-head"><div>' + (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + '</div>' : '') + '<h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
  }

  /* ================================================================ sign in */
  function vLogin() {
    var email = S.loginStep === 'email';
    app.innerHTML = '<div class="login">' +
      '<aside class="login-art"><picture><source type="image/webp" srcset="images/apply/tsf-table-discipleship-1200.webp"><img src="images/apply/tsf-table-discipleship.jpg" alt=""></picture>' +
      '<div class="brand"><img src="images/the-hud-group-logo-dark.png" alt="The HuD Group" width="137" height="46"></div>' +
      '<div><blockquote>Entrust to reliable people who will also be qualified to teach others.</blockquote><cite>2 Timothy 2:2</cite></div></aside>' +
      '<main class="login-main"><div class="login-card">' +
      '<div class="login-mobile-brand"><picture><source srcset="images/the-hud-group-logo-dark.png" media="(prefers-color-scheme: dark)"><img src="images/the-hud-group-logo.png" alt="The HuD Group" width="125" height="42"></picture></div>' +
      '<div class="eyebrow">The Shadrach Fellowship</div>' +
      (email
        ? '<h1>Welcome to your portal</h1><p class="lede">Sign in with the email address the fellowship has for you. We will email you a one-time code, so there is no password to remember.</p>' +
          '<form data-form="request-code" novalidate><div id="login-err"></div><div class="field"><label for="email">Email address</label><input class="input" id="email" name="email" type="email" autocomplete="email" inputmode="email" required value="' + esc(S.loginEmail) + '" placeholder="you@example.com"></div>' +
          '<div class="field"><label class="check"><input type="checkbox" name="remember" ' + (store.get('tsf.remember') === 'no' ? '' : 'checked') + '> Keep me signed in on this device</label></div>' +
          '<button class="btn btn-block" type="submit">' + icon('mail') + 'Email me a code</button></form>'
        : '<h1>Check your email</h1><p class="lede">If <b>' + esc(S.loginEmail) + '</b> is on the fellowship roster, a 6-digit code is on its way. It expires in 10 minutes.</p>' +
          '<form data-form="verify-code" novalidate><div id="login-err"></div><div class="field"><label for="code">Your code</label><input class="input code-input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required placeholder="000000"></div>' +
          '<button class="btn btn-block" type="submit">Sign in</button>' +
          '<div class="form-actions" style="justify-content:space-between;margin-top:14px"><button type="button" class="btn btn-ghost btn-sm" data-act="login-back">Use a different email</button><button type="button" class="btn btn-ghost btn-sm" data-act="login-resend">Send a new code</button></div></form>') +
      '<p class="login-foot">Only fellows and facilitators on the roster can sign in. Your information is private: only you and the fellowship admins can see it. Trouble signing in? Email <a href="mailto:engage@thehudgroupglobal.org">engage@thehudgroupglobal.org</a>.</p>' +
      '</div></main></div>';
    document.title = 'Sign in | TSF Portal';
    var f = app.querySelector(email ? '#email' : '#code');
    if (f) f.focus();
    if (!API) app.querySelector('#login-err').innerHTML = '<div class="err">The portal is not connected yet. The TSF team is finishing the setup.</div>';
  }

  /* ================================================================ fellow: home */
  var FELLOW_VIEWS = {};

  FELLOW_VIEWS.home = function () {
    var d = F(), m = fm(d), st = d.settings, me = d.me;
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    var q = quarterInfo(currentQuarter());
    var heldN = m.held.length, total = m.real.filter(function (s) { return s.kind !== 'induction'; }).length;
    var startsIn = st.startDate && !m.started ? daysBetween(m.today, st.startDate) : 0;
    var hero = '<section class="hero rise"><div class="eyebrow">' + esc(st.cohortName || 'The Shadrach Fellowship') + ' &middot; ' + esc(q.q + ' ' + q.name) + '</div>' +
      '<h1>' + greet + ', ' + esc(firstName(me.name)) + '.</h1>' +
      '<p>' + (startsIn > 0 ? 'Your journey begins in <b>' + plural(startsIn, 'day') + '</b>. ' + esc(st.welcomeNote || '') : esc(q.field ? 'This quarter: ' + q.field + '.' : st.welcomeNote || '')) + '</p>' +
      '<div class="hero-meta">' + (m.week ? '<span class="chip-l">' + icon('map') + 'Week ' + m.week + ' of ' + m.totalWeeks + '</span>' : '') +
      (m.bibleStreak > 1 ? '<span class="chip-l">' + icon('flame') + m.bibleStreak + '-day Bible streak</span>' : '') +
      (m.next ? '<span class="chip-l">' + icon('calendar') + 'Next: ' + esc(fmt(m.next.date)) + '</span>' : '') + '</div>' +
      '<div class="qbar"><div class="track"><div class="fill" style="width:' + pct(heldN, total) + '%"></div></div><div class="labels"><span>Induction</span><span><b>' + heldN + '</b> of ' + total + ' sessions</span><span>Graduation</span></div></div></section>';

    var next = m.next;
    var nextCard = next ? '<div class="card rise"><div class="card-head"><h3>Next session</h3><span class="sub">' + esc(st.sessionTime || '') + '</span></div>' +
      '<a class="rowlink" href="#/session/' + esc(next.id) + '"><div class="date-pill now"><small>' + MONTHS[parse(next.date).getMonth()] + '</small><b>' + parse(next.date).getDate() + '</b></div><div class="grow"><div class="title">' + esc(next.title) + '</div><div class="meta">' + esc(fmt(next.date, true)) + (next.passage ? ' &middot; ' + esc(next.passage) : '') + '</div></div></a>' +
      '<div class="form-actions" style="margin-top:14px">' + ((next.link || st.meetingLink) ? '<a class="btn btn-peach btn-sm" href="' + esc(next.link || st.meetingLink) + '" target="_blank" rel="noopener">Join the session</a>' : '') +
      '<button class="btn btn-ghost btn-sm" data-act="ics-one" data-id="' + esc(next.id) + '">' + icon('calendar') + 'Add to calendar</button>' +
      (next.passage ? '<a class="btn btn-ghost btn-sm" href="https://www.biblegateway.com/passage/?search=' + encodeURIComponent(next.passage) + '" target="_blank" rel="noopener">' + icon('book') + 'Read the passage</a>' : '') + '</div></div>'
      : '<div class="card rise">' + empty('calendar', 'No upcoming sessions on the roadmap.') + '</div>';

    // this week
    var todos = [];
    var last = m.last;
    if (last) todos.push(todo(!!m.refl[last.id], 'Write your reflection', 'Week ' + (last.week || '') + ': ' + last.title, '#/session/' + last.id));
    var dayIdx = m.bibleExpected - 1;
    if (dayIdx >= 0 && dayIdx < 365) todos.push(todo(m.bibleDays.charAt(dayIdx) === '1', 'Bible in One Year: day ' + (dayIdx + 1), m.bibleBehind > 1 ? plural(m.bibleBehind, 'day') + ' to catch up' : 'Keep the rhythm going', '#/bible', canEdit() ? 'bible-today' : ''));
    if (m.hi5) todos.push(todo((m.hi5.prayerLog || []).indexOf(m.today) >= 0, 'Pray for ' + (m.hi5.peopleGroup || 'your people group'), 'With your Hi 5 group' + (m.hi5.prayerDay ? ' (' + m.hi5.prayerDay + 's)' : ''), '#/disciples', canEdit() ? 'pray-today' : ''));
    else todos.push(todo(false, 'Form your Hi 5 prayer group', 'Adopt an unreached people group', '#/disciples'));
    var weekAgo = addDays(m.today, -7);
    var met = m.mentees.some(function (x) { return (x.meetings || []).some(function (mt) { return mt.date >= weekAgo; }); });
    todos.push(todo(met, m.mentees.length ? 'Meet with one of your disciples' : 'Choose your three disciples', m.mentees.length ? plural(m.mentees.length, 'disciple') + ' on your list' : 'Start with prayer, then invite them', '#/disciples'));
    var due = m.tasks.filter(function (t) { return t.due && t.due >= m.today && t.due <= addDays(m.today, 21) && !m.tState(t).done && t.kind !== 'bible'; }).sort(by('due'))[0];
    if (due) todos.push(todo(false, due.title, 'Due ' + fmt(due.due), due.kind === 'report' ? '#/reports/' + String(due.title).slice(0, 2) : '#/assignments'));
    var todoCard = '<div class="card rise"><div class="card-head"><h3>This week</h3><span class="sub">' + todos.filter(function (t) { return t.done; }).length + ' of ' + todos.length + ' done</span></div>' + todos.map(function (t) { return t.html; }).join('') + '</div>';

    var tasksTotal = m.tasks.length;
    var stats = '<div class="grid g4 rise" style="margin-bottom:16px">' +
      statCard(m.attRate === null ? 0 : m.attRate, 'var(--green)', m.attRate === null ? 'No sessions yet' : m.present + '/' + m.marked, 'Attendance') +
      statCard(pct(m.bibleDone, 365), 'var(--purple-mid)', m.bibleDone + '/365', 'Bible in One Year') +
      statCard(pct(m.reflCount, m.held.length || 1), 'var(--orange)', m.reflCount + '/' + m.held.length, 'Reflections') +
      statCard(pct(m.tasksDone, tasksTotal), 'var(--blue)', m.tasksDone + '/' + tasksTotal, 'Assignments') + '</div>';

    var lastIwill = (d.reflections || []).filter(function (r) { return r.iWill; }).sort(by('updatedAt')).pop();
    var iwill = lastIwill ? '<div class="iwill rise"><div class="eyebrow" style="margin-bottom:8px">Your latest "I will"</div><q>' + nl(lastIwill.iWill) + '</q><div class="by">' + (lastIwill.scripture ? esc(lastIwill.scripture) + ' &middot; ' : '') + (lastIwill.shareWith ? 'Sharing with ' + esc(lastIwill.shareWith) : '') + '</div></div>' : '';
    var anns = (d.announcements || []).slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.createdAt < b.createdAt ? 1 : -1); }).slice(0, 4);
    var annCard = '<div class="card rise"><div class="card-head"><h3>Announcements</h3></div>' + (anns.length ? '<ul class="list">' + anns.map(function (a) {
      return '<li><div class="grow"><div class="title">' + (a.pinned ? icon('pin').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px;color:var(--orange);margin-right:4px"') : '') + esc(a.title) + '</div><div class="small" style="margin-top:4px">' + nl(a.body) + '</div><div class="meta" style="margin-top:4px">' + esc(fmtStamp(a.createdAt)) + (a.by ? ' &middot; ' + esc(a.by) : '') + '</div></div></li>';
    }).join('') + '</ul>' : empty('megaphone', 'No announcements yet.')) + '</div>';
    var p = d.pulse || {};
    var pulse = p.lastSessionId && p.fellows ? '<div class="card rise"><div class="card-head"><h3>Cohort pulse</h3><span class="sub">Last session</span></div><div class="stack"><div><div class="small muted">Attended</div><div class="bar"><i style="width:' + pct(p.attended, p.fellows) + '%"></i></div><div class="small" style="margin-top:4px"><b>' + p.attended + '</b> of ' + p.fellows + ' fellows</div></div><div><div class="small muted">Wrote their reflection</div><div class="bar peach"><i style="width:' + pct(p.reflected, p.fellows) + '%"></i></div><div class="small" style="margin-top:4px"><b>' + p.reflected + '</b> of ' + p.fellows + ' fellows</div></div></div></div>' : '';

    return { html: hero + stats + '<div class="grid g-main"><div class="stack">' + nextCard + todoCard + '</div><div class="stack">' + iwill + annCard + pulse + '</div></div>' };
  };

  function todo(done, title, sub, href, act) {
    var inner = '<span class="tick">' + (done ? icon('check') : '') + '</span><span><span class="t">' + esc(title) + '</span><br><span class="s">' + esc(sub) + '</span></span><span class="go">' + icon('chevron') + '</span>';
    var html = act && !done ? '<button type="button" class="todo" style="width:100%;text-align:left;cursor:pointer;font:inherit" data-act="' + act + '">' + inner.replace(icon('chevron'), '<span class="chip purple">Mark done</span>') + '</button>' : '<a class="todo' + (done ? ' done' : '') + '" href="' + href + '">' + inner + '</a>';
    return { done: done, html: html };
  }
  function statCard(value, color, big, label) {
    return '<div class="card kpi"><div class="stat">' + ring(value, 64, color, label + ' ' + value + '%') + '<div><b>' + esc(big) + '</b><span>' + esc(label) + '</span></div></div></div>';
  }

  /* ================================================================ fellow: journey and sessions */
  FELLOW_VIEWS.journey = function (r) {
    var d = F(), m = fm(d);
    var q = /^Q[1-4]$/.test(r.a) ? r.a : currentQuarter();
    var info = quarterInfo(q);
    var tabs = '<div class="tabs" role="tablist">' + ['Q1', 'Q2', 'Q3', 'Q4'].map(function (x) { return '<a href="#/journey/' + x + '" class="' + (x === q ? 'active' : '') + '">' + x + '<span class="tab-long"> ' + esc(quarterInfo(x).name.split(' ')[0]) + '</span>' + '</a>'; }).join('') + '</div>';
    var list = m.sessions.filter(function (s) { return quarterOf(s.date) === q && s.date.slice(0, 4) === (d.settings.programmeYear || s.date.slice(0, 4)); });
    if (q === 'Q1') list = m.sessions.filter(function (s) { return s.kind === 'induction'; }).concat(list);
    var rows = list.map(function (s) {
      var a = m.att[s.id], rf = m.refl[s.id], isNext = m.next && m.next.id === s.id, past = s.date < m.today;
      var chips = [];
      if (s.kind === 'break') chips.push(chip('Break'));
      else {
        if (a) chips.push(chip(ATT[a.status][0], ATT[a.status][1]));
        if (rf) chips.push(chip('Reflection written', 'purple'));
        else if (past && s.kind !== 'induction') chips.push(chip('Reflection to write', 'amber'));
        if (isNext) chips.push(chip('Next', 'blue'));
      }
      var dt = parse(s.date);
      var inner = '<div class="date-pill ' + (isNext ? 'now' : past ? 'past' : '') + '"><small>' + MONTHS[dt.getMonth()] + '</small><b>' + dt.getDate() + '</b></div><div class="grow"><div class="title">' + esc(s.title) + '</div><div class="meta">' + (s.week ? 'Week ' + s.week : esc(s.kind === 'induction' ? 'Induction' : '')) + (s.passage ? ' &middot; ' + esc(s.passage) : '') + '</div></div><div class="chips">' + chips.join('') + '</div>';
      return '<li' + (s.kind === 'break' ? ' style="opacity:.6"' : '') + '>' + (s.kind === 'break' ? '<div class="rowlink">' + inner + '</div>' : '<a class="rowlink" href="#/session/' + esc(s.id) + '">' + inner + '</a>') + '</li>';
    }).join('');
    return {
      html: head('Your journey', 'Fifty-two weeks of formation, one Friday at a time. Open any session to write your review, your "I will" statement, the Scripture and who you will share it with.', '<button class="btn btn-ghost btn-sm" data-act="ics-all">' + icon('calendar') + 'Add all to my calendar</button>') +
        tabs + '<div class="qhead"><span class="q">' + q + '</span><h2>' + esc(info.name) + '</h2><span class="muted">' + esc(info.field) + '</span></div>' +
        '<div class="card"><ul class="list">' + (rows || '<li>' + empty('calendar', 'No sessions in this quarter yet.') + '</li>') + '</ul></div>'
    };
  };

  FELLOW_VIEWS.session = function (r) {
    var d = F(), m = fm(d);
    var s = m.sessions.filter(function (x) { return x.id === r.a; })[0];
    if (!s) return { html: head('Session not found') + '<a class="btn" href="#/journey">Back to the journey</a>' };
    var idx = m.real.indexOf(s);
    var prev = m.real[idx - 1], next = m.real[idx + 1];
    var a = m.att[s.id], rf = m.refl[s.id] || {};
    var ro = !canEdit();
    var dis = ro ? ' disabled' : '';
    var heroHtml = '<div class="session-hero"><a href="#/journey/' + quarterOf(s.date) + '" class="small" style="text-decoration:none">' + icon('back').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"') + ' Journey</a>' +
      '<h1>' + esc(s.title) + '</h1><div class="chips" style="margin-bottom:12px">' + chip(fmt(s.date, true), 'purple') + (s.week ? chip('Week ' + s.week) : '') + (a ? chip(ATT[a.status][0], ATT[a.status][1]) : s.date < m.today ? chip('Attendance not marked yet') : '') + '</div>' +
      (s.passage ? '<a class="passage" href="https://www.biblegateway.com/passage/?search=' + encodeURIComponent(s.passage) + '" target="_blank" rel="noopener">' + icon('book') + esc(s.passage) + '</a>' : '') +
      (s.notes ? '<p style="margin-top:14px">' + nl(s.notes) + '</p>' : '') +
      ((s.link || d.settings.meetingLink) && s.date >= m.today ? '<div class="form-actions" style="margin-top:14px"><a class="btn btn-peach btn-sm" target="_blank" rel="noopener" href="' + esc(s.link || d.settings.meetingLink) + '">Join the session</a></div>' : '') +
      (s.resources ? '<p class="small muted" style="margin-top:12px">Resources: ' + nl(s.resources) + '</p>' : '') + '</div>';
    var future = s.date > m.today;
    var form = '<div class="card"><div class="card-head"><h2>My reflection</h2>' + (rf.updatedAt ? '<span class="sub">Saved ' + esc(fmtStamp(rf.updatedAt)) + '</span>' : '') + '</div>' +
      (future && !rf.id ? '<p class="muted">You can write your reflection once the session has happened. Read the passage ahead of time.</p>' : '') +
      '<form data-form="reflection" data-id="' + esc(s.id) + '">' +
      '<div class="eyebrow" style="margin:4px 0 12px">1. Look back</div>' +
      '<div class="field"><label for="f-rev">Brief review and short notes</label><textarea class="input" id="f-rev" name="review" rows="4" placeholder="What stood out to you? A short summary in your own words."' + dis + '>' + esc(rf.review || '') + '</textarea></div>' +
      '<div class="field"><label for="f-q">Questions</label><textarea class="input" id="f-q" name="questions" rows="2" placeholder="Anything you are still wrestling with"' + dis + '>' + esc(rf.questions || '') + '</textarea></div>' +
      '<div class="eyebrow" style="margin:22px 0 12px">2. Next steps</div>' +
      '<div class="field"><label for="f-iwill">"I will" statement</label><textarea class="input" id="f-iwill" name="iWill" rows="3" placeholder="Since this is true, I will..."' + dis + '>' + esc(rf.iWill || '') + '</textarea><div class="hint">One clear, doable step of obedience from this week\'s passage.</div></div>' +
      '<div class="row2"><div class="field"><label for="f-scr">Scripture</label><input class="input" id="f-scr" name="scripture" value="' + esc(rf.scripture || s.passage || '') + '"' + dis + '></div>' +
      '<div class="field"><label for="f-share">Who will you share this with?</label><input class="input" id="f-share" name="shareWith" value="' + esc(rf.shareWith || '') + '" placeholder="A name or a group"' + dis + '></div></div>' +
      '<div class="field"><label class="check"><input type="checkbox" name="shared"' + (rf.shared ? ' checked' : '') + dis + '> I have shared it</label></div>' +
      (ro ? '' : '<div class="eyebrow" style="margin:22px 0 12px">3. Anything on your heart?</div><div class="field"><label for="f-c">A concern or complaint <span class="muted" style="font-weight:400">(optional, goes privately to the facilitators)</span></label><textarea class="input" id="f-c" name="concern" rows="2"></textarea></div>') +
      (ro ? '' : '<div class="form-actions"><button class="btn" type="submit">' + (rf.id ? 'Update my reflection' : 'Save my reflection') + '</button></div>') + '</form>' +
      (rf.feedback ? '<div class="feedback"><b>' + esc(rf.feedbackBy || 'Facilitator') + '</b><div style="margin-top:4px">' + nl(rf.feedback) + '</div></div>' : '') + '</div>';
    var pager = '<div class="pager">' + (prev ? '<a class="btn btn-ghost btn-sm" href="#/session/' + esc(prev.id) + '">' + icon('back') + esc(prev.week ? 'Week ' + prev.week : 'Previous') + '</a>' : '<span></span>') + (next ? '<a class="btn btn-ghost btn-sm" href="#/session/' + esc(next.id) + '">' + esc(next.week ? 'Week ' + next.week : 'Next') + icon('chevron') + '</a>' : '') + '</div>';
    return { html: heroHtml + form + pager };
  };

  /* ================================================================ fellow: Bible */
  FELLOW_VIEWS.bible = function () {
    var d = F(), m = fm(d);
    var start = parse(m.bibleStart);
    var months = [], i;
    for (i = 0; i < 365; i++) {
      var dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = dt.getFullYear() + '-' + dt.getMonth();
      var mo = months[months.length - 1];
      if (!mo || mo.key !== key) { mo = { key: key, name: MONTHS_LONG[dt.getMonth()] + ' ' + dt.getFullYear(), first: dt.getDay(), days: [] }; months.push(mo); }
      mo.days.push({ i: i, date: iso(dt), n: dt.getDate() });
    }
    var dis = canEdit() ? '' : ' disabled';
    var grid = months.map(function (mo) {
      var done = mo.days.filter(function (x) { return m.bibleDays.charAt(x.i) === '1'; }).length;
      var cells = '';
      for (var b = 0; b < mo.first; b++) cells += '<span class="day blank"></span>';
      cells += mo.days.map(function (x) {
        var on = m.bibleDays.charAt(x.i) === '1';
        return '<button type="button" class="day' + (on ? ' on' : '') + (x.date === m.today ? ' today' : '') + (x.date > m.today ? ' future' : '') + '" data-act="bible-day" data-i="' + x.i + '" aria-pressed="' + on + '" aria-label="Day ' + (x.i + 1) + ', ' + fmt(x.date, true) + '"' + dis + '>' + x.n + '</button>';
      }).join('');
      return '<div class="month"><h4><span>' + esc(mo.name) + '</span><span>' + done + '/' + mo.days.length + '</span></h4><div class="days">' + cells + '</div></div>';
    }).join('');
    var behind = m.bibleBehind;
    var status = !m.started ? 'Your plan starts on ' + fmt(m.bibleStart, true) + '.' : behind === 0 ? 'You are right on track. Keep going.' : behind <= 3 ? 'Just ' + plural(behind, 'day') + ' to catch up.' : plural(behind, 'day') + ' behind. Grace, not guilt: pick up from today.';
    return {
      html: head('Bible in One Year', 'Tick each day as you finish the reading. We follow the <a href="https://www.bibleinoneyear.org/" target="_blank" rel="noopener">Bible in One Year</a> plan. Your progress saves automatically.',
        canEdit() ? '<button class="btn btn-peach" data-act="bible-today">' + icon('check') + 'I read today</button>' : '') +
        '<div class="grid g4" style="margin-bottom:18px">' +
        '<div class="card kpi"><div class="stat">' + ring(pct(m.bibleDone, 365), 64, 'var(--purple-mid)') + '<div><b>' + m.bibleDone + '</b><span>of 365 days read</span></div></div></div>' +
        '<div class="card kpi"><div class="v">' + m.bibleStreak + '</div><div class="l">' + icon('flame').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px;color:var(--orange)"') + ' day streak</div></div>' +
        '<div class="card kpi' + (behind > 7 ? ' alert' : '') + '"><div class="v">' + (m.started ? 'Day ' + m.bibleExpected : 'Soon') + '</div><div class="l">today in the plan</div></div>' +
        '<div class="card kpi"><div class="small" style="font-weight:600">' + esc(status) + '</div></div></div>' +
        '<div class="legend" style="margin-bottom:12px"><span><i class="on"></i>Read</span><span><i></i>Not yet</span><span><i class="today"></i>Today</span></div>' +
        '<div class="bible-months">' + grid + '</div>'
    };
  };

  function setBibleDay(i, on) {
    var d = F();
    var days = String((d.bible && d.bible.days) || '');
    while (days.length < 365) days += '0';
    days = days.slice(0, i) + (on ? '1' : '0') + days.slice(i + 1);
    d.bible = Object.assign({}, d.bible || {}, { days: days });
    bump();
    clearTimeout(S.bibleTimer);
    S.bibleTimer = setTimeout(function () {
      api('saveBible', { days: days }).then(function () { toast('Bible progress saved'); }, function (e) { toast(e.message, true); });
    }, 900);
  }

  /* ================================================================ fellow: disciples and Hi 5 */
  FELLOW_VIEWS.disciples = function () {
    var d = F(), m = fm(d), ed = canEdit();
    var list = (d.mentees || []).slice().sort(function (a, b) { return (a.status === 'ended') - (b.status === 'ended') || (a.startedOn < b.startedOn ? -1 : 1); });
    var cards = list.map(function (x) {
      var meetings = (x.meetings || []).slice().sort(by('date'));
      var lastMeet = meetings[meetings.length - 1];
      return '<div class="card person-card"><div class="top"><div class="avatar purple">' + esc(initials(x.name)) + '</div><div class="grow"><b>' + esc(x.name) + '</b><span class="small muted">' + esc(x.relationship || x.contact || 'Since ' + fmt(x.startedOn)) + '</span></div>' + chip(x.status === 'active' ? 'Active' : x.status === 'paused' ? 'Paused' : 'Ended', x.status === 'active' ? 'green' : 'amber') + '</div>' +
        '<div class="small"><b>' + plural(meetings.length, 'meeting') + '</b>' + (lastMeet ? ' &middot; last on ' + esc(fmt(lastMeet.date)) : ' yet') + '</div>' +
        (lastMeet && lastMeet.note ? '<div class="small muted">' + nl(lastMeet.note) + '</div>' : '') +
        (ed ? '<div class="form-actions"><button class="btn btn-soft btn-sm" data-act="log-meeting" data-id="' + esc(x.id) + '">' + icon('plus') + 'Log a meeting</button><button class="btn btn-ghost btn-sm" data-act="edit-mentee" data-id="' + esc(x.id) + '">' + icon('edit') + 'Edit</button></div>' : '<button class="btn btn-ghost btn-sm" data-act="edit-mentee" data-id="' + esc(x.id) + '">' + icon('eye') + 'Details</button>') + '</div>';
    });
    var active = list.filter(function (x) { return x.status !== 'ended'; }).length;
    for (var k = active; k < 3 && ed; k++) cards.push('<button class="slot" data-act="edit-mentee">' + icon('plus') + '<span>Add disciple ' + (k + 1) + ' of 3</span></button>');
    var h = m.hi5;
    var members = (h && h.members) || [];
    var memberHtml = '';
    for (var j = 0; j < 5; j++) {
      var mm = members[j];
      memberHtml += '<div class="member' + (mm ? '' : ' empty') + '"><div class="avatar">' + (mm ? esc(initials(mm.name)) : '+') + '</div>' + (mm ? esc(mm.name) : '<span class="muted">Open</span>') + '</div>';
    }
    var log = (h && h.prayerLog) || [];
    var dots = '';
    for (var t = 27; t >= 0; t--) { var dd = addDays(m.today, -t); dots += '<i class="' + (log.indexOf(dd) >= 0 ? 'on' : '') + '" title="' + esc(fmt(dd)) + '"></i>'; }
    var prayedToday = log.indexOf(m.today) >= 0;
    var hi5Card = '<div class="card"><div class="card-head"><div><div class="eyebrow">Hi 5 prayer group</div><h2 style="margin-top:4px">' + esc((h && h.groupName) || 'Your Hi 5 group') + '</h2></div>' + (ed ? '<button class="btn btn-ghost btn-sm" data-act="edit-hi5">' + icon('edit') + (h ? 'Edit group' : 'Set up') + '</button>' : '') + '</div>' +
      (h ? '<div class="members" style="margin-bottom:18px">' + memberHtml + '</div>' +
        '<div class="grid g2"><div><div class="label">Adopted people group</div>' + (h.peopleGroup ? '<div style="font:600 19px var(--font-h);color:var(--heading)">' + esc(h.peopleGroup) + '</div><div class="small muted">' + esc(h.peopleCountry || '') + '</div><a class="small" target="_blank" rel="noopener" href="https://joshuaproject.net/search?q=' + encodeURIComponent(h.peopleGroup) + '">Learn about them on Joshua Project</a>' : '<span class="muted">Not chosen yet. <a target="_blank" rel="noopener" href="https://joshuaproject.net/pray/unreachedoftheday">Find an unreached people group</a></span>') + '</div>' +
        '<div><div class="label">Prayer in the last four weeks</div><div class="dots" style="margin:6px 0 10px">' + dots + '</div><div class="small muted">' + plural(log.length, 'day') + ' of prayer logged' + (h.prayerDay ? ' &middot; you meet on ' + esc(h.prayerDay) + 's' : '') + '</div>' +
        (ed ? '<button class="btn ' + (prayedToday ? 'btn-ghost' : 'btn-peach') + ' btn-sm" style="margin-top:10px" data-act="pray-today">' + icon('heart') + (prayedToday ? 'Prayed today (undo)' : 'We prayed today') + '</button>' : '') + '</div></div>'
        : '<p class="muted">Gather five people to pray regularly for an unreached people group you adopt together. Set up your group to start tracking your prayer.</p>') + '</div>';
    return {
      html: head('My disciples and Hi 5', 'Pick your three, walk with them and log each time you meet. Pray with your Hi 5 group for the unreached.', '', '2 Timothy 2:2') +
        '<div class="qhead"><h2>My three</h2><span class="muted">' + plural(active, 'active disciple') + '</span></div>' +
        '<div class="grid g3">' + (cards.join('') || '<div class="card">' + empty('users', 'No disciples listed yet.') + '</div>') + '</div>' +
        '<div class="qhead" style="margin-top:30px"><h2>Hi 5</h2><span class="muted">Praying for the unreached</span></div>' + hi5Card
    };
  };

  function menteeModal(id) {
    var d = F(), x = (d.mentees || []).filter(function (y) { return y.id === id; })[0] || { status: 'active', startedOn: todayISO(), meetings: [] };
    var ro = !canEdit(), dis = ro ? ' disabled' : '';
    var meetings = (x.meetings || []).slice().sort(by('date')).reverse();
    openModal(x.id ? x.name : 'Add a disciple', '<form data-form="mentee" data-id="' + esc(x.id || '') + '">' +
      '<div class="field"><label for="m-name">Name</label><input class="input" id="m-name" name="name" required value="' + esc(x.name || '') + '"' + dis + '></div>' +
      '<div class="row2"><div class="field"><label for="m-contact">Phone or email</label><input class="input" id="m-contact" name="contact" value="' + esc(x.contact || '') + '"' + dis + '></div>' +
      '<div class="field"><label for="m-rel">How you know them</label><input class="input" id="m-rel" name="relationship" value="' + esc(x.relationship || '') + '" placeholder="e.g. church, campus, work"' + dis + '></div></div>' +
      '<div class="row2"><div class="field"><label for="m-start">Started on</label><input class="input" type="date" id="m-start" name="startedOn" value="' + esc(x.startedOn || '') + '"' + dis + '></div>' +
      '<div class="field"><label for="m-status">Status</label><select class="input" id="m-status" name="status"' + dis + '>' + ['active', 'paused', 'ended'].map(function (s) { return '<option value="' + s + '"' + (x.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="m-notes">Notes and prayer points</label><textarea class="input" id="m-notes" name="notes" rows="3"' + dis + '>' + esc(x.notes || '') + '</textarea></div>' +
      (meetings.length ? '<div class="label">Meetings</div><ul class="list" style="margin-bottom:14px">' + meetings.map(function (mt) { return '<li><div class="grow"><div class="title small">' + esc(fmt(mt.date, true)) + '</div>' + (mt.note ? '<div class="meta">' + nl(mt.note) + '</div>' : '') + '</div></li>'; }).join('') + '</ul>' : '') +
      (ro ? '' : '<div class="form-actions"><button class="btn" type="submit">Save</button>' + (x.id ? '<button class="btn btn-danger" type="button" data-act="delete-mentee" data-id="' + esc(x.id) + '">' + icon('trash') + 'Remove</button>' : '') + '</div>') + '</form>');
  }

  function hi5Modal() {
    var h = F().hi5 || { members: [] };
    var rows = '';
    for (var i = 0; i < 5; i++) {
      var mm = (h.members || [])[i] || {};
      rows += '<div class="row2" style="margin-bottom:8px"><input class="input" name="mname' + i + '" placeholder="Member ' + (i + 1) + ' name" value="' + esc(mm.name || '') + '" aria-label="Member ' + (i + 1) + ' name"><input class="input" name="mcontact' + i + '" placeholder="Phone or email" value="' + esc(mm.contact || '') + '" aria-label="Member ' + (i + 1) + ' contact"></div>';
    }
    openModal('Your Hi 5 group', '<form data-form="hi5">' +
      '<div class="field"><label for="h-name">Group name</label><input class="input" id="h-name" name="groupName" value="' + esc(h.groupName || '') + '" placeholder="Optional"></div>' +
      '<div class="label">Members</div>' + rows +
      '<div class="row2" style="margin-top:14px"><div class="field"><label for="h-pg">Unreached people group</label><input class="input" id="h-pg" name="peopleGroup" value="' + esc(h.peopleGroup || '') + '" placeholder="e.g. Fulani"></div>' +
      '<div class="field"><label for="h-pc">Country</label><input class="input" id="h-pc" name="peopleCountry" value="' + esc(h.peopleCountry || '') + '"></div></div>' +
      '<div class="hint" style="margin:-8px 0 14px">Need ideas? <a href="https://joshuaproject.net/pray/unreachedoftheday" target="_blank" rel="noopener">Joshua Project: unreached of the day</a></div>' +
      '<div class="field"><label for="h-day">Day you pray together</label><select class="input" id="h-day" name="prayerDay"><option value="">Choose a day</option>' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(function (x) { return '<option' + (h.prayerDay === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="h-notes">Prayer points</label><textarea class="input" id="h-notes" name="notes" rows="3">' + esc(h.notes || '') + '</textarea></div>' +
      '<div class="form-actions"><button class="btn" type="submit">Save group</button></div></form>');
  }

  /* ================================================================ fellow: assignments */
  FELLOW_VIEWS.assignments = function () {
    var d = F(), m = fm(d);
    var html = ['Q1', 'Q2', 'Q3', 'Q4'].map(function (q) {
      var list = m.tasks.filter(function (t) { return t.quarter === q; });
      if (!list.length) return '';
      var info = quarterInfo(q);
      return '<div class="qhead"><span class="q">' + q + '</span><h2>' + esc(info.name) + '</h2></div><div class="grid g2">' + list.map(function (t) { return taskCard(t, m); }).join('') + '</div>';
    }).join('');
    var done = m.tasksDone, total = m.tasks.length;
    return { html: head('Assignments and assessments', 'Readings, coursework, assessments and the habits that shape the year. Open one to update your progress or upload your work.', '', done + ' of ' + total + ' complete') + html };
  };

  function taskCard(t, m) {
    var s = m.tState(t);
    var overdue = t.due && t.due < m.today && !s.done;
    var href = t.kind === 'bible' ? '#/bible' : t.kind === 'mentees' || t.kind === 'hi5' ? '#/disciples' : t.kind === 'report' ? '#/reports/' + s.quarter : '';
    var res = t.resourceId ? (F().resources || []).filter(function (r) { return r.id === t.resourceId; })[0] : null;
    var st = STATUS[s.status] || [s.status, ''];
    return '<div class="card"><div class="card-head" style="margin-bottom:8px"><span class="eyebrow">' + esc(KIND[t.kind] || t.kind) + '</span><div class="chips">' + (overdue ? chip('Overdue', 'red') : '') + chip(st[0], st[1]) + '</div></div>' +
      '<h3 style="margin-bottom:6px">' + esc(t.title) + '</h3><p class="small muted">' + esc(t.description || '') + '</p>' +
      '<div class="bar' + (s.done ? '' : ' peach') + '" style="margin:10px 0 6px"><i style="width:' + s.percent + '%"></i></div>' +
      '<div class="small muted" style="display:flex;justify-content:space-between;gap:10px"><span>' + (t.due ? 'Due ' + esc(fmt(t.due)) : '') + '</span><span>' + esc(s.note || (s.p && s.p.result) || (s.percent ? s.percent + '%' : '')) + '</span></div>' +
      (s.p && s.p.feedback ? '<div class="feedback small"><b>' + esc(s.p.reviewedBy || 'Facilitator') + ':</b> ' + nl(s.p.feedback) + '</div>' : '') +
      '<div class="form-actions" style="margin-top:12px">' + (href ? '<a class="btn btn-soft btn-sm" href="' + href + '">Open</a>' : '<button class="btn btn-soft btn-sm" data-act="open-task" data-id="' + esc(t.id) + '">' + (canEdit() ? 'Update progress' : 'View') + '</button>') +
      (s.p && s.p.fileId ? '<button class="btn btn-ghost btn-sm" data-act="get-file" data-id="' + esc(s.p.fileId) + '">' + icon('file') + 'My file</button>' : '') +
      (res && res.link ? '<a class="btn btn-ghost btn-sm" href="' + esc(res.link) + '" target="_blank" rel="noopener">' + icon('link') + 'Resource</a>' : '') + '</div></div>';
  }

  function taskModal(id) {
    var d = F(), m = fm(d), t = m.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var p = m.prog[t.id] || {}, ro = !canEdit(), dis = ro ? ' disabled' : '';
    var showPercent = t.kind === 'reading' || t.kind === 'course';
    var showResult = t.kind === 'assessment';
    var statuses = [['not-started', 'Not started'], ['in-progress', 'In progress'], ['done', 'Done'], ['submitted', 'Submit for review']];
    openModal(t.title, '<p class="muted">' + esc(t.description || '') + (t.due ? ' Due ' + esc(fmt(t.due, true)) + '.' : '') + '</p>' +
      (p.status === 'approved' ? '<div class="feedback" style="margin-bottom:14px"><b>Approved</b>' + (p.feedback ? '<div>' + nl(p.feedback) + '</div>' : '') + '</div>' : p.feedback ? '<div class="feedback" style="margin-bottom:14px"><b>' + esc(p.reviewedBy || 'Facilitator') + '</b><div>' + nl(p.feedback) + '</div></div>' : '') +
      '<form data-form="task" data-id="' + esc(t.id) + '">' +
      (p.status === 'approved' ? '<input type="hidden" name="status" value="done">' : '<div class="field"><label for="t-status">Status</label><select class="input" id="t-status" name="status"' + dis + '>' + statuses.map(function (s) { return '<option value="' + s[0] + '"' + ((p.status || 'not-started') === s[0] || (p.status === 'returned' && s[0] === 'in-progress') ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>') +
      (showPercent ? '<div class="field"><label for="t-pct">How far are you? <b id="t-pct-v">' + (p.percent || 0) + '%</b></label><input type="range" id="t-pct" name="percent" min="0" max="100" step="5" value="' + (p.percent || 0) + '" style="width:100%;accent-color:var(--purple)"' + dis + '></div>' : '') +
      (showResult ? '<div class="field"><label for="t-res">Your result</label><input class="input" id="t-res" name="result" value="' + esc(p.result || '') + '" placeholder="' + (/disc/i.test(t.title) ? 'e.g. High I, then S' : 'e.g. Teaching, Leadership, Mercy') + '"' + dis + '></div>' : '') +
      '<div class="field"><label for="t-note">' + (t.kind === 'reading' ? 'Your reflection on the book' : 'Notes') + '</label><textarea class="input" id="t-note" name="note" rows="4"' + dis + '>' + esc(p.note || '') + '</textarea></div>' +
      (ro ? '' : '<div class="field"><label for="t-file">Upload your work <span class="muted" style="font-weight:400">(optional, PDF, Word, PowerPoint or image, up to 5 MB)</span></label><input class="input" type="file" id="t-file" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"></div>') +
      (p.fileId ? '<p class="small">Uploaded: <button type="button" class="btn btn-ghost btn-sm" data-act="get-file" data-id="' + esc(p.fileId) + '">' + icon('file') + esc(p.fileName || 'file') + '</button></p>' : '') +
      (ro ? '' : '<div class="form-actions"><button class="btn" type="submit">Save</button></div>') + '</form>');
    var range = document.getElementById('t-pct');
    if (range) range.oninput = function () { document.getElementById('t-pct-v').textContent = range.value + '%'; };
  }

  /* ================================================================ reports */
  FELLOW_VIEWS.reports = function (r) {
    var d = F(), m = fm(d);
    if (/^Q[1-4]$/.test(r.a)) return r.b === 'view' ? reportPage(r.a, null) : reportForm(r.a);
    var cards = ['Q1', 'Q2', 'Q3', 'Q4'].map(function (q) {
      var info = quarterInfo(q), rep = m.reports[q];
      var task = m.tasks.filter(function (t) { return t.kind === 'report' && String(t.title).slice(0, 2) === q; })[0];
      var st = !rep ? 'not-started' : rep.evaluation && rep.evaluation.released ? 'evaluated' : rep.status;
      var s = STATUS[st] || [st, ''];
      return '<div class="card"><div class="card-head"><span class="eyebrow">' + q + '</span>' + chip(s[0], s[1]) + '</div><h3>' + esc(info.name) + '</h3><p class="small muted" style="margin-top:6px">' + esc(info.field) + (task && task.due ? '. Due ' + esc(fmt(task.due)) + '.' : '') + '</p>' +
        '<div class="form-actions"><a class="btn btn-sm ' + (st === 'evaluated' || st === 'submitted' ? 'btn-ghost' : '') + '" href="#/reports/' + q + '">' + (st === 'not-started' ? 'Start my report' : st === 'draft' ? 'Continue' : 'Open') + '</a><a class="btn btn-ghost btn-sm" href="#/reports/' + q + '/view">' + icon('eye') + 'Full report</a></div></div>';
    }).join('');
    var shares = (d.shares || []);
    var shareCard = shares.length ? '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Active share links</h3><span class="sub">Each link opens one report, read only, and expires after 30 days</span></div><ul class="list">' + shares.map(function (s) {
      return '<li><div class="grow"><div class="title">' + esc(s.quarter) + ' report</div><div class="meta">Expires ' + esc(fmtStamp(s.expiresAt)) + '</div></div><button class="btn btn-ghost btn-sm" data-act="copy-share" data-token="' + esc(s.token) + '">' + icon('link') + 'Copy</button>' + (canEdit() ? '<button class="btn btn-danger btn-sm" data-act="revoke-share" data-token="' + esc(s.token) + '">Withdraw</button>' : '') + '</li>';
    }).join('') + '</ul></div>' : '';
    return { html: head('Quarterly reports', 'At the end of each quarter, look back with your facilitators. Write your self report, then read their evaluation, download it as a PDF or share it.') + '<div class="grid g2">' + cards + '</div>' + shareCard };
  };

  function reportForm(q) {
    var d = F(), m = fm(d), st = d.settings, info = quarterInfo(q);
    var rep = m.reports[q] || {}, a = rep.answers || {}, ratings = a.ratings || {};
    var locked = !canEdit() || (rep.evaluation && rep.evaluation.released);
    var dis = locked ? ' disabled' : '';
    var qs = (st.reportQuestions || []).map(function (x) {
      return '<div class="field"><label for="rq-' + x.k + '">' + esc(x.q) + '</label><textarea class="input" id="rq-' + x.k + '" name="' + x.k + '" rows="4"' + dis + '>' + esc(a[x.k] || '') + '</textarea></div>';
    }).join('');
    var rs = (st.selfRatings || []).map(function (x) { return '<div class="rating-row"><span>' + esc(x.l) + '</span>' + scale('r-' + x.k, ratings[x.k], locked) + '</div>'; }).join('');
    var ev = rep.evaluation;
    var s = !rep.status ? 'not-started' : ev && ev.released ? 'evaluated' : rep.status;
    return {
      html: '<a href="#/reports" class="small" style="text-decoration:none">' + icon('back').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"') + ' All reports</a>' +
        head(q + ' report: ' + info.name, esc(info.field), '<a class="btn btn-ghost btn-sm" href="#/reports/' + q + '/view">' + icon('eye') + 'Full report</a>' + reportActions(q, null), '') +
        '<div class="chips" style="margin:-8px 0 18px">' + chip((STATUS[s] || [s])[0], (STATUS[s] || [])[1]) + (rep.submittedAt ? chip('Submitted ' + fmtStamp(rep.submittedAt)) : '') + '</div>' +
        (ev ? evaluationHtml(ev, st.evalCriteria) : '') +
        '<form data-form="report" data-q="' + q + '"><div class="card"><div class="card-head"><h2>My self report</h2>' + (locked && !canEdit() ? '' : locked ? '<span class="sub">Locked after evaluation</span>' : '<span class="sub">Saved as a draft until you submit</span>') + '</div>' + qs +
        '<div class="label" style="margin-top:6px">Rate yourself this quarter (1 low, 5 high)</div>' + rs + '</div>' +
        (locked ? '' : '<div class="form-actions" style="margin-top:16px"><button class="btn btn-ghost" type="submit" name="mode" value="draft">Save draft</button><button class="btn" type="submit" name="mode" value="submit">' + icon('send') + (rep.status === 'submitted' ? 'Update submitted report' : 'Submit to my facilitators') + '</button></div>') + '</form>'
    };
  }

  function scale(name, value, disabled) {
    var h = '<div class="scale" role="radiogroup">';
    for (var i = 1; i <= 5; i++) h += '<label><input type="radio" name="' + name + '" value="' + i + '"' + (Number(value) === i ? ' checked' : '') + (disabled ? ' disabled' : '') + ' aria-label="' + i + '"><span>' + i + '</span></label>';
    return h + '</div>';
  }

  function evaluationHtml(ev, criteria) {
    return '<div class="card" style="margin-bottom:16px;border-color:var(--purple-light)"><div class="card-head"><h2>Facilitator evaluation</h2><span class="sub">' + esc(ev.by || '') + (ev.at ? ' &middot; ' + esc(fmtStamp(ev.at)) : '') + (ev.released ? '' : ' &middot; not yet released to the fellow') + '</span></div>' +
      (criteria || []).map(function (c) { var v = ev.ratings && ev.ratings[c.k]; return '<div class="rating-row"><span>' + esc(c.l) + '</span><span class="stars" aria-label="' + (v || 0) + ' of 5">' + (v ? '★'.repeat(v) + '<span style="opacity:.25">' + '★'.repeat(5 - v) + '</span>' : '<span class="muted small">Not rated</span>') + '</span></div>'; }).join('') +
      [['Strengths', ev.strengths], ['Areas to grow', ev.growth], ['Comment', ev.comment]].filter(function (x) { return x[1]; }).map(function (x) { return '<div class="qa" style="margin-top:14px"><div class="q">' + x[0] + '</div><div class="a">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>';
  }

  function reportActions(q, personId) {
    var data = ' data-q="' + q + '"' + (personId ? ' data-pid="' + esc(personId) + '"' : '');
    var share = canEdit() || (isAdmin() && !S.viewAs);
    return '<button class="btn btn-ghost btn-sm" data-act="report-pdf"' + data + '>' + icon('download') + 'PDF</button>' + (share ? '<button class="btn btn-ghost btn-sm" data-act="report-share"' + data + '>' + icon('share') + 'Share</button>' : '');
  }

  function reportPage(q, personId) {
    var key = 'rep:' + (personId || (S.viewAs || 'me')) + ':' + q;
    var cached = S.reportCache && S.reportCache[key];
    var back = personId ? '#/admin/reports/' + q : '#/reports/' + q;
    var top = '<a href="' + back + '" class="small no-print" style="text-decoration:none">' + icon('back').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"') + ' Back</a>' +
      '<div class="page-head no-print" style="margin-top:10px"><div><div class="eyebrow">Full report</div><h1>' + q + ' report</h1></div><div class="actions">' + reportActions(q, personId) + '<button class="btn btn-ghost btn-sm" data-act="print">' + icon('print') + 'Print</button></div></div>';
    if (cached) return { html: top + reportView(cached) };
    return {
      html: top + '<div class="card"><div class="boot" style="min-height:200px"><div><div class="spinner"></div>Preparing the report</div></div></div>',
      after: function () {
        var payload = { quarter: q };
        if (personId) payload.personId = personId;
        var call = S.viewAs ? api('reportData', { quarter: q, personId: S.viewAs }) : api('reportData', payload);
        call.then(function (r) { S.reportCache = S.reportCache || {}; S.reportCache[key] = r.report; if (route().raw.indexOf(q) >= 0) render(); }, function (e) { toast(e.message, true); });
      }
    };
  }

  function reportView(d) {
    var m = d.metrics, a = d.answers, ev = d.evaluation;
    var stat = function (v, l) { return '<div><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; };
    return '<article class="report"><div class="report-top"><div class="eyebrow">' + esc(d.cohortName) + ' &middot; ' + esc(d.quarter) + ' report</div><h1>' + esc(d.fellow.name) + '</h1><p>' + esc(m.name) + ': ' + esc(m.field) + (d.fellow.country ? ' &middot; ' + esc([d.fellow.city, d.fellow.country].filter(String).join(', ')) : '') + '</p></div>' +
      '<div class="report-body"><div class="report-stats">' +
      stat(m.attendanceRate === null ? 'n/a' : m.attendanceRate + '%', 'Attendance') + stat(m.present + '/' + m.sessionsHeld, 'Sessions attended') + stat(m.reflections, 'Reflections') + stat(m.biblePercent + '%', 'Bible in a year') + stat(m.tasksDone + '/' + m.tasksTotal, 'Assignments') +
      stat(m.disciples, 'Disciples') + stat(m.meetings, 'Discipleship meetings') + stat(m.hi5Members, 'Hi 5 members') + stat(m.prayers, 'Days prayed') + stat(m.excused, 'Excused absences') + '</div>' +
      (m.peopleGroup ? '<p class="muted" style="margin-top:12px">Hi 5 adopted people group: <b style="color:var(--text)">' + esc(m.peopleGroup) + '</b></p>' : '') +
      (m.tasks.length ? '<h3>Assignments this quarter</h3><ul class="list">' + m.tasks.map(function (t) { var s = STATUS[t.status] || [t.status, '']; return '<li><div class="grow">' + esc(t.title) + (t.result ? ' <span class="muted">(' + esc(t.result) + ')</span>' : '') + '</div>' + chip(s[0], s[1]) + '</li>'; }).join('') + '</ul>' : '') +
      (m.iWills.length ? '<h3>Recent "I will" statements</h3>' + m.iWills.map(function (w) { return '<div class="iwill" style="margin-bottom:8px;padding:14px 16px 14px 20px"><q style="font-size:16px">' + nl(w) + '</q></div>'; }).join('') : '') +
      '<h3>Self report</h3>' + (!a ? '<p class="muted">Not written yet.</p>' : d.questions.map(function (x) { return '<div class="qa"><div class="q">' + esc(x.q) + '</div><div class="a">' + (a[x.k] ? esc(a[x.k]) : '<span class="muted">No answer</span>') + '</div></div>'; }).join('') +
        '<div style="margin-top:8px">' + d.selfRatings.map(function (x) { var v = a.ratings && a.ratings[x.k]; return '<div class="rating-row"><span>' + esc(x.l) + '</span><b style="color:var(--accent-text)">' + (v ? v + ' / 5' : 'Not rated') + '</b></div>'; }).join('') + '</div>') +
      (ev ? '<h3>Facilitator evaluation</h3>' + d.evalCriteria.map(function (c) { var v = ev.ratings && ev.ratings[c.k]; return '<div class="rating-row"><span>' + esc(c.l) + '</span><span class="stars">' + (v ? '★'.repeat(v) + '<span style="opacity:.25">' + '★'.repeat(5 - v) + '</span>' : '<span class="muted small">Not rated</span>') + '</span></div>'; }).join('') +
        [['Strengths', ev.strengths], ['Areas to grow', ev.growth], ['Comment', ev.comment]].filter(function (x) { return x[1]; }).map(function (x) { return '<div class="qa" style="margin-top:14px"><div class="q">' + x[0] + '</div><div class="a">' + esc(x[1]) + '</div></div>'; }).join('') +
        (ev.by ? '<p class="small muted" style="margin-top:10px">Evaluated by ' + esc(ev.by) + (ev.at ? ' on ' + esc(fmtStamp(ev.at)) : '') + (ev.released ? '' : '. Not yet released to the fellow.') + '</p>' : '') : '') +
      '<p class="small muted" style="margin-top:26px;border-top:1px solid var(--line);padding-top:10px">The Shadrach Fellowship, The HuD Group Global. Generated ' + esc(fmt(d.generatedAt, true)) + '. Private: shared by or with the permission of the fellow.</p></div></article>';
  }

  function vShared(token) {
    app.innerHTML = '<div class="shared-wrap"><div class="boot" style="min-height:60vh"><div><div class="spinner"></div>Opening the shared report</div></div></div>';
    api('sharedReport', { shareToken: token }).then(function (r) {
      app.innerHTML = '<div class="shared-wrap"><div class="shared-bar no-print"><picture><source srcset="images/the-hud-group-logo-dark.png" media="(prefers-color-scheme: dark)"><img src="images/the-hud-group-logo.png" alt="The HuD Group" width="119" height="40"></picture><div class="form-actions" style="margin:0"><span class="small muted">Link expires ' + esc(fmtStamp(r.report.expiresAt)) + '</span><button class="btn btn-sm" data-act="print">' + icon('print') + 'Print or save as PDF</button></div></div>' + reportView(r.report) + '</div>';
      document.title = r.report.fellow.name + ': ' + r.report.quarter + ' report | The Shadrach Fellowship';
    }, function (e) {
      app.innerHTML = '<div class="shared-wrap"><div class="card" style="margin-top:10vh">' + empty('link', esc(e.message)) + '</div></div>';
    });
  }

  /* ================================================================ fellow: resources, voice, profile */
  FELLOW_VIEWS.resources = function () {
    var d = F();
    var list = (d.resources || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var cards = list.map(function (r) {
      return '<div class="card"' + (r.gift ? ' style="border-color:var(--peach)"' : '') + '><div class="card-head" style="margin-bottom:8px"><span class="eyebrow">' + esc(r.kind === 'book' ? 'Book' : r.kind === 'course' ? 'Course' : r.kind === 'assessment' ? 'Assessment' : r.kind === 'plan' ? 'Reading plan' : r.kind || 'Resource') + (r.quarter ? ' &middot; ' + esc(r.quarter) : '') + '</span>' + (r.gift ? '<span class="chip amber">' + icon('gift').replace('<svg', '<svg style="width:13px;height:13px"') + 'Graduation gift</span>' : '') + '</div>' +
        '<h3>' + esc(r.title) + '</h3>' + (r.author ? '<div class="small muted" style="margin-top:2px">' + esc(r.author) + '</div>' : '') + (r.description ? '<p class="small" style="margin-top:8px">' + esc(r.description) + '</p>' : '') +
        (r.link ? '<a class="btn btn-soft btn-sm" href="' + esc(r.link) + '" target="_blank" rel="noopener">' + icon('link') + 'Open</a>' : '<span class="small muted">Your facilitators will share a copy.</span>') + '</div>';
    }).join('');
    return { html: head('Resources', 'The books, courses and assessments that carry the year.') + '<div class="grid g3">' + (cards || '<div class="card">' + empty('library', 'No resources yet.') + '</div>') + '</div>' };
  };

  FELLOW_VIEWS.voice = function () {
    var d = F(), list = (d.concerns || []).slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var form = canEdit() ? '<div class="card"><div class="card-head"><h2>Share with the facilitators</h2></div><form data-form="concern">' +
      '<div class="row2"><div class="field"><label for="c-cat">What is it about?</label><select class="input" id="c-cat" name="category"><option value="concern">A concern</option><option value="complaint">A complaint</option><option value="question">A question</option><option value="prayer">A prayer request</option><option value="suggestion">A suggestion</option></select></div>' +
      '<div class="field"><label for="c-sub">Subject</label><input class="input" id="c-sub" name="subject" placeholder="Optional"></div></div>' +
      '<div class="field"><label for="c-msg">Your message</label><textarea class="input" id="c-msg" name="message" rows="5" required></textarea></div>' +
      '<div class="field"><label class="check"><input type="checkbox" name="anonymous"> Send without my name <span class="muted">(you will still see replies here)</span></label></div>' +
      '<div class="form-actions"><button class="btn" type="submit">' + icon('send') + 'Send privately</button></div></form></div>' : '';
    var hist = '<div class="card"><div class="card-head"><h2>Your messages</h2></div>' + (list.length ? '<ul class="list">' + list.map(function (c) {
      var tone = c.status === 'resolved' ? 'green' : c.status === 'in-progress' ? 'blue' : 'amber';
      return '<li style="align-items:flex-start"><div class="grow"><div class="chips" style="margin-bottom:6px">' + chip(c.category) + chip(c.status === 'in-progress' ? 'In progress' : c.status.charAt(0).toUpperCase() + c.status.slice(1), tone) + (c.anonymous ? chip('Anonymous', 'purple') : '') + '</div>' +
        (c.subject ? '<div class="title">' + esc(c.subject) + '</div>' : '') + '<div class="small">' + nl(c.message) + '</div><div class="meta" style="margin-top:4px">' + esc(fmtStamp(c.createdAt)) + '</div>' +
        (c.response ? '<div class="feedback"><b>' + esc(c.respondedBy || 'Facilitator') + '</b><div>' + nl(c.response) + '</div></div>' : '') + '</div></li>';
    }).join('') + '</ul>' : empty('message', 'Nothing yet. Whatever you share here goes only to the fellowship admins.')) + '</div>';
    return { html: head('Concerns and prayer', 'A private line to your facilitators for concerns, complaints, questions, suggestions and prayer requests.') + '<div class="grid g-main"><div>' + form + '</div><div>' + hist + '</div></div>' };
  };

  FELLOW_VIEWS.profile = function () {
    var d = F(), me = d.me, ro = !canEdit(), dis = ro ? ' disabled' : '';
    return {
      html: head('My profile', 'Keep your contact details up to date so your facilitators can reach you.') +
        '<div class="grid g-main"><div class="card"><div class="person" style="margin-bottom:18px"><div class="avatar lg">' + esc(initials(me.name)) + '</div><div><b style="font:600 22px var(--font-h);color:var(--heading)">' + esc(me.name) + '</b><small>' + esc(me.email) + '</small></div></div>' +
        '<form data-form="profile"><div class="row2"><div class="field"><label for="p-phone">Phone</label><input class="input" id="p-phone" name="phone" value="' + esc(me.phone || '') + '"' + dis + '></div><div class="field"><label for="p-wa">WhatsApp</label><input class="input" id="p-wa" name="whatsapp" value="' + esc(me.whatsapp || '') + '"' + dis + '></div></div>' +
        '<div class="row2"><div class="field"><label for="p-city">City</label><input class="input" id="p-city" name="city" value="' + esc(me.city || '') + '"' + dis + '></div><div class="field"><label for="p-country">Country</label><input class="input" id="p-country" name="country" value="' + esc(me.country || '') + '"' + dis + '></div></div>' +
        '<div class="field"><label for="p-bio">A little about you</label><textarea class="input" id="p-bio" name="bio" rows="4"' + dis + '>' + esc(me.bio || '') + '</textarea></div>' +
        (ro ? '' : '<div class="form-actions"><button class="btn" type="submit">Save my details</button></div>') + '</form></div>' +
        '<div class="stack"><div class="card"><h3>Calendar</h3><p class="small muted" style="margin-top:6px">Add every Friday session to your phone or computer calendar.</p><button class="btn btn-soft btn-sm" data-act="ics-all">' + icon('calendar') + 'Download the calendar</button></div>' +
        (d.settings.whatsappGroup ? '<div class="card"><h3>Cohort WhatsApp</h3><p class="small muted" style="margin-top:6px">Stay connected with your cohort between sessions.</p><a class="btn btn-soft btn-sm" target="_blank" rel="noopener" href="' + esc(d.settings.whatsappGroup) + '">Open the group</a></div>' : '') +
        '<div class="card"><h3>Your privacy</h3><p class="small muted" style="margin-top:6px">Only you and the fellowship admins can see your portal. Reports leave the portal only when you download them or create a share link, and you can withdraw a link at any time.</p>' + (ro ? '' : '<button class="btn btn-ghost btn-sm" data-act="sign-out">' + icon('logout') + 'Sign out</button>') + '</div></div></div>'
    };
  };

  /* ================================================================ admin */
  var ADMIN_VIEWS = {};

  ADMIN_VIEWS.overview = function () {
    var d = S.data, a = am(d), st = d.settings;
    var active = a.active;
    var rates = active.map(function (f) { return a.stats[f.id].attRate; }).filter(function (x) { return x !== null; });
    var avgAtt = rates.length ? Math.round(rates.reduce(function (x, y) { return x + y; }, 0) / rates.length) : null;
    var lh = a.lastHeld;
    var reflLast = lh ? active.filter(function (f) { return a.refl[f.id + '|' + lh.id]; }).length : 0;
    var counts = adminCounts();
    var flagged = active.filter(function (f) { return a.stats[f.id].flags.length; });
    var kpis = '<div class="grid g4">' +
      kpi(active.length, 'Active fellows') + kpi(avgAtt === null ? 'n/a' : avgAtt + '%', 'Average attendance') +
      kpi(lh ? reflLast + '/' + active.length : 'n/a', 'Reflections, last session') + kpi(counts.voice + counts.assignments + counts.reports, 'Waiting on you', counts.voice + counts.assignments + counts.reports > 0) + '</div>';
    var attention = '<div class="card"><div class="card-head"><h2>Needs attention</h2><span class="sub">' + plural(flagged.length, 'fellow') + '</span></div>' + (flagged.length ? '<ul class="list">' + flagged.map(function (f) {
      return '<li><a class="rowlink" href="#/admin/fellow/' + esc(f.id) + '"><div class="avatar">' + esc(initials(f.name)) + '</div><div class="grow"><div class="title">' + esc(f.name) + '</div><div class="chips" style="margin-top:4px">' + a.stats[f.id].flags.map(function (x) { return chip(x, 'red'); }).join('') + '</div></div>' + icon('chevron') + '</a></li>';
    }).join('') + '</ul>' : empty('check', 'Everyone is on track. Thank God.')) + '</div>';
    var queue = '<div class="card"><div class="card-head"><h2>Your queue</h2></div>' +
      '<a class="todo" href="#/admin/voice"><span class="tick">' + (counts.voice ? '' : icon('check')) + '</span><span><span class="t">' + plural(counts.voice, 'open concern') + '</span><br><span class="s">Concerns, complaints, questions and prayer</span></span><span class="go">' + icon('chevron') + '</span></a>' +
      '<a class="todo" href="#/admin/assignments"><span class="tick">' + (counts.assignments ? '' : icon('check')) + '</span><span><span class="t">' + plural(counts.assignments, 'submission') + ' to review</span><br><span class="s">Assignments and assessments</span></span><span class="go">' + icon('chevron') + '</span></a>' +
      '<a class="todo" href="#/admin/reports"><span class="tick">' + (counts.reports ? '' : icon('check')) + '</span><span><span class="t">' + plural(counts.reports, 'report') + ' to evaluate</span><br><span class="s">Quarterly self reports</span></span><span class="go">' + icon('chevron') + '</span></a>' +
      (lh ? '<a class="todo" href="#/admin/attendance/' + esc(lh.id) + '"><span class="tick">' + (active.every(function (f) { return a.att[f.id + '|' + lh.id]; }) ? icon('check') : '') + '</span><span><span class="t">Attendance for week ' + esc(lh.week || '') + '</span><br><span class="s">' + esc(lh.title) + ' &middot; ' + esc(fmt(lh.date)) + '</span></span><span class="go">' + icon('chevron') + '</span></a>' : '') + '</div>';
    var nextCard = a.next ? '<div class="card"><div class="card-head"><h3>Next session</h3></div><a class="rowlink" href="#/admin/roadmap"><div class="date-pill now"><small>' + MONTHS[parse(a.next.date).getMonth()] + '</small><b>' + parse(a.next.date).getDate() + '</b></div><div class="grow"><div class="title">' + esc(a.next.title) + '</div><div class="meta">' + (a.next.week ? 'Week ' + a.next.week : '') + (a.next.passage ? ' &middot; ' + esc(a.next.passage) : '') + '</div></div></a></div>' : '';
    var roster = rosterTable(a, active);
    return {
      html: head('Cohort overview', esc(st.cohortName || '') + ' &middot; ' + esc(fmt(a.today, true)), '<a class="btn btn-ghost btn-sm" href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">' + icon('sheet') + 'Open the sheet</a>' + (lh ? '<a class="btn btn-sm" href="#/admin/attendance/' + esc(lh.id) + '">' + icon('check') + 'Take attendance</a>' : '')) +
        kpis + '<div class="grid g-main" style="margin-top:16px"><div>' + attention + '</div><div class="stack">' + queue + nextCard + '</div></div>' +
        '<div class="qhead" style="margin-top:28px"><h2>Fellows at a glance</h2><span class="muted">Select a fellow to see everything about them</span></div>' + roster
    };
  };

  function kpi(v, l, alert) { return '<div class="card kpi' + (alert ? ' alert' : '') + '"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + '</div></div>'; }

  function rosterTable(a, list) {
    if (!list.length) return '<div class="card">' + empty('users', 'No fellows yet. Add them under Fellows.') + '</div>';
    return '<div class="table-wrap"><table class="t"><thead><tr><th>Fellow</th><th class="num">Attendance</th><th class="num">Reflections</th><th class="num">Bible</th><th class="num">Assignments</th><th class="num">Disciples</th><th class="num">Hi 5</th><th>Flags</th></tr></thead><tbody>' +
      list.map(function (f) {
        var s = a.stats[f.id];
        return '<tr class="click" data-act="go" data-href="#/admin/fellow/' + esc(f.id) + '"><td><div class="person"><div class="avatar">' + esc(initials(f.name)) + '</div><div><b>' + esc(f.name) + '</b><small>' + esc([f.city, f.country].filter(String).join(', ') || f.email) + '</small></div></div></td>' +
          '<td class="num">' + (s.attRate === null ? '<span class="muted">n/a</span>' : s.attRate + '%') + '</td><td class="num">' + s.refl + '/' + a.held.length + '</td><td class="num">' + pct(s.bibleDone, 365) + '%' + (s.bibleBehind > 21 ? ' <span class="chip red">-' + s.bibleBehind + 'd</span>' : '') + '</td><td class="num">' + s.tasksDone + '/' + S.data.tasks.length + '</td><td class="num">' + s.mentees + '</td><td class="num">' + s.hi5 + '</td>' +
          '<td>' + (s.flags.length ? chip(plural(s.flags.length, 'flag'), 'red') : chip(f.status === 'active' ? 'On track' : f.status, f.status === 'active' ? 'green' : '')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  ADMIN_VIEWS.fellows = function () {
    var d = S.data, a = am(d);
    var admins = d.people.filter(function (p) { return p.role === 'admin'; }).sort(by('name'));
    var fellowsRows = a.fellows.map(function (f) {
      return '<tr><td><div class="person"><div class="avatar">' + esc(initials(f.name)) + '</div><div><b>' + esc(f.name) + '</b><small>' + esc(f.email) + '</small></div></div></td><td>' + esc([f.city, f.country].filter(String).join(', ')) + '</td><td>' + chip(f.status, f.status === 'active' ? 'green' : f.status === 'graduated' ? 'purple' : 'amber') + '</td>' +
        '<td style="white-space:nowrap"><a class="btn btn-soft btn-sm" href="#/admin/fellow/' + esc(f.id) + '">Open</a> <button class="btn btn-ghost btn-sm" data-act="view-as" data-id="' + esc(f.id) + '">' + icon('eye') + 'Their portal</button> <button class="icon-btn" data-act="edit-person" data-id="' + esc(f.id) + '" aria-label="Edit ' + esc(f.name) + '">' + icon('edit') + '</button></td></tr>';
    }).join('');
    var adminRows = admins.map(function (p) { return '<li><div class="avatar purple">' + esc(initials(p.name)) + '</div><div class="grow"><div class="title">' + esc(p.name) + (p.id === d.me.id ? ' <span class="chip">You</span>' : '') + '</div><div class="meta">' + esc(p.email) + '</div></div><button class="icon-btn" data-act="edit-person" data-id="' + esc(p.id) + '" aria-label="Edit">' + icon('edit') + '</button></li>'; }).join('');
    return {
      html: head('Fellows and admins', 'Everyone on this list can sign in with their email. Fellows see only their own portal; admins see everything.',
        '<button class="btn btn-ghost btn-sm" data-act="bulk-add">' + icon('users') + 'Add many</button><button class="btn btn-ghost btn-sm" data-act="send-welcome">' + icon('mail') + 'Send welcome emails</button><button class="btn btn-sm" data-act="edit-person">' + icon('plus') + 'Add a person</button>') +
        '<div class="table-wrap"><table class="t"><thead><tr><th>Fellow</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>' + (fellowsRows || '<tr><td colspan="4">' + empty('users', 'No fellows yet.') + '</td></tr>') + '</tbody></table></div>' +
        '<div class="qhead" style="margin-top:28px"><h2>Admins</h2><span class="muted">Facilitators and coordinators</span></div><div class="card"><ul class="list">' + adminRows + '</ul></div>'
    };
  };

  function personModal(id) {
    var p = S.data.people.filter(function (x) { return x.id === id; })[0] || { role: 'fellow', status: 'active', cohort: S.data.settings.cohortName };
    var opt = function (list, v) { return list.map(function (x) { return '<option value="' + x[0] + '"' + (v === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };
    openModal(p.id ? 'Edit ' + p.name : 'Add a person', '<form data-form="person" data-id="' + esc(p.id || '') + '">' +
      '<div class="row2"><div class="field"><label for="pp-name">Full name</label><input class="input" id="pp-name" name="name" required value="' + esc(p.name || '') + '"></div><div class="field"><label for="pp-email">Email (used to sign in)</label><input class="input" id="pp-email" name="email" type="email" required value="' + esc(p.email || '') + '"></div></div>' +
      '<div class="row3"><div class="field"><label for="pp-role">Role</label><select class="input" id="pp-role" name="role">' + opt([['fellow', 'Fellow'], ['admin', 'Admin']], p.role) + '</select></div><div class="field"><label for="pp-status">Status</label><select class="input" id="pp-status" name="status">' + opt([['active', 'Active'], ['paused', 'Paused'], ['dropped', 'Dropped off'], ['graduated', 'Graduated']], p.status) + '</select></div><div class="field"><label for="pp-cohort">Cohort</label><input class="input" id="pp-cohort" name="cohort" value="' + esc(p.cohort || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label for="pp-city">City</label><input class="input" id="pp-city" name="city" value="' + esc(p.city || '') + '"></div><div class="field"><label for="pp-country">Country</label><input class="input" id="pp-country" name="country" value="' + esc(p.country || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label for="pp-phone">Phone</label><input class="input" id="pp-phone" name="phone" value="' + esc(p.phone || '') + '"></div><div class="field"><label for="pp-wa">WhatsApp</label><input class="input" id="pp-wa" name="whatsapp" value="' + esc(p.whatsapp || '') + '"></div></div>' +
      '<div class="form-actions"><button class="btn" type="submit">Save</button>' + (p.id && p.id !== S.data.me.id ? '<button class="btn btn-danger" type="button" data-act="remove-person" data-id="' + esc(p.id) + '">' + icon('trash') + 'Remove access</button>' : '') + '</div></form>');
  }

  ADMIN_VIEWS.fellow = function (r) {
    var d = S.data, a = am(d), f = d.people.filter(function (p) { return p.id === r.b; })[0];
    if (!f) return { html: head('Fellow not found') + '<a class="btn" href="#/admin/fellows">Back</a>' };
    var s = a.stats[f.id] || {};
    var tab = r.c || 'attendance';
    var tabs = '<div class="tabs">' + [['attendance', 'Attendance'], ['reflections', 'Reflections'], ['assignments', 'Assignments'], ['disciples', 'Disciples and Hi 5'], ['reports', 'Reports'], ['concerns', 'Concerns']].map(function (t) { return '<a href="#/admin/fellow/' + esc(f.id) + '/' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</a>'; }).join('') + '</div>';
    var body = '';
    var sessById = mapBy(d.sessions, 'id');
    if (tab === 'attendance') {
      body = '<div class="card"><ul class="list">' + a.held.slice().reverse().map(function (x) { var at = a.att[f.id + '|' + x.id]; return '<li><div class="grow"><div class="title">' + esc(x.title) + '</div><div class="meta">Week ' + esc(x.week || '') + ' &middot; ' + esc(fmt(x.date)) + '</div></div>' + (at ? chip(ATT[at.status][0], ATT[at.status][1]) : chip('Not marked')) + '</li>'; }).join('') + '</ul></div>';
    } else if (tab === 'reflections') {
      var rs = d.reflections.filter(function (x) { return x.personId === f.id; }).sort(function (x, y) { return ((sessById[x.sessionId] || {}).date || '') < ((sessById[y.sessionId] || {}).date || '') ? 1 : -1; });
      body = rs.length ? rs.map(function (x) { return reflectionCard(x, sessById[x.sessionId]); }).join('') : '<div class="card">' + empty('book', 'No reflections yet.') + '</div>';
    } else if (tab === 'assignments') {
      var model = { bibleDone: s.bibleDone, mentees: d.mentees.filter(function (x) { return x.personId === f.id && x.status !== 'ended'; }), hi5: d.hi5.filter(function (x) { return x.personId === f.id; })[0], prog: mapBy(d.progress.filter(function (p) { return p.personId === f.id; }), 'taskId'), reports: mapBy(d.reports.filter(function (x) { return x.personId === f.id; }), 'quarter') };
      body = '<div class="table-wrap"><table class="t"><thead><tr><th>Assignment</th><th>Due</th><th>Status</th><th>Result or note</th><th></th></tr></thead><tbody>' + d.tasks.slice().sort(function (x, y) { return (x.order || 0) - (y.order || 0); }).map(function (t) {
        var ts = taskState(t, model), stt = STATUS[ts.status] || [ts.status, ''];
        return '<tr><td><b>' + esc(t.title) + '</b><br><small class="muted">' + esc(KIND[t.kind] || t.kind) + '</small></td><td>' + esc(fmt(t.due)) + '</td><td>' + chip(stt[0], stt[1]) + '</td><td class="wrap small">' + esc((ts.p && (ts.p.result || ts.p.note)) || ts.note || '') + '</td><td>' + (ts.p && !ts.auto ? '<button class="btn btn-soft btn-sm" data-act="review-progress" data-id="' + esc(ts.p.id) + '">Review</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    } else if (tab === 'disciples') {
      var ms = d.mentees.filter(function (x) { return x.personId === f.id; });
      var h = d.hi5.filter(function (x) { return x.personId === f.id; })[0];
      body = '<div class="grid g2"><div class="card"><h3>Disciples</h3>' + (ms.length ? '<ul class="list">' + ms.map(function (x) { return '<li><div class="grow"><div class="title">' + esc(x.name) + '</div><div class="meta">' + esc(x.relationship || '') + ' &middot; ' + plural((x.meetings || []).length, 'meeting') + ' &middot; ' + esc(x.status) + '</div></div></li>'; }).join('') + '</ul>' : empty('users', 'None listed yet.')) + '</div>' +
        '<div class="card"><h3>Hi 5 group</h3>' + (h ? '<p style="margin-top:8px"><b>' + esc(h.groupName || 'Hi 5') + '</b>: ' + esc((h.members || []).map(function (x) { return x.name; }).join(', ') || 'no members yet') + '</p><p>People group: <b>' + esc(h.peopleGroup || 'not chosen') + '</b>' + (h.peopleCountry ? ', ' + esc(h.peopleCountry) : '') + '</p><p class="small muted">' + plural((h.prayerLog || []).length, 'day') + ' of prayer logged</p>' : empty('heart', 'Not set up yet.')) + '</div></div>';
    } else if (tab === 'reports') {
      body = '<div class="grid g2">' + ['Q1', 'Q2', 'Q3', 'Q4'].map(function (q) { return adminReportCard(f, q); }).join('') + '</div>';
    } else if (tab === 'concerns') {
      var cs = d.concerns.filter(function (c) { return c.personId === f.id; });
      body = cs.length ? cs.map(concernCard).join('') : '<div class="card">' + empty('message', 'Nothing from this fellow (anonymous messages are not shown here).') + '</div>';
    }
    return {
      html: '<a href="#/admin/fellows" class="small" style="text-decoration:none">' + icon('back').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"') + ' Fellows</a>' +
        '<div class="page-head" style="margin-top:10px"><div class="person"><div class="avatar lg">' + esc(initials(f.name)) + '</div><div><h1>' + esc(f.name) + '</h1><small class="muted">' + [f.email, f.phone, [f.city, f.country].filter(String).join(', ')].filter(String).map(esc).join(' &middot; ') + '</small></div></div>' +
        '<div class="actions"><button class="btn btn-ghost btn-sm" data-act="edit-person" data-id="' + esc(f.id) + '">' + icon('edit') + 'Edit</button><button class="btn btn-sm" data-act="view-as" data-id="' + esc(f.id) + '">' + icon('eye') + 'Open their portal</button></div></div>' +
        (s.flags && s.flags.length ? '<div class="chips" style="margin:-6px 0 16px">' + s.flags.map(function (x) { return chip(x, 'red'); }).join('') + '</div>' : '') +
        '<div class="grid g4" style="margin-bottom:18px">' + statCard(s.attRate || 0, 'var(--green)', s.attRate === null ? 'n/a' : s.present + '/' + s.marked, 'Attendance') + statCard(pct(s.bibleDone, 365), 'var(--purple-mid)', s.bibleDone + '/365', 'Bible in One Year') + statCard(pct(s.refl, a.held.length || 1), 'var(--orange)', s.refl + '/' + a.held.length, 'Reflections') + statCard(pct(s.tasksDone, d.tasks.length), 'var(--blue)', s.tasksDone + '/' + d.tasks.length, 'Assignments') + '</div>' +
        tabs + body
    };
  };

  function reflectionCard(x, s) {
    s = s || {};
    return '<div class="card"><div class="card-head"><div><div class="eyebrow">Week ' + esc(s.week || '') + ' &middot; ' + esc(fmt(s.date)) + '</div><h3 style="margin-top:4px">' + esc(s.title || '') + '</h3></div><button class="btn btn-soft btn-sm" data-act="reflection-feedback" data-id="' + esc(x.id) + '">' + icon('message') + (x.feedback ? 'Edit reply' : 'Reply') + '</button></div>' +
      (x.iWill ? '<div class="iwill" style="padding:14px 16px 14px 20px"><q style="font-size:16px">' + nl(x.iWill) + '</q><div class="by">' + esc(x.scripture || '') + (x.shareWith ? ' &middot; sharing with ' + esc(x.shareWith) + (x.shared ? ' (shared)' : '') : '') + '</div></div>' : '') +
      (x.review ? '<div class="qa" style="margin-top:12px"><div class="q small">Review</div><div class="a small">' + esc(x.review) + '</div></div>' : '') +
      (x.questions ? '<div class="qa"><div class="q small">Questions</div><div class="a small">' + esc(x.questions) + '</div></div>' : '') +
      (x.feedback ? '<div class="feedback small"><b>' + esc(x.feedbackBy || 'You') + '</b><div>' + nl(x.feedback) + '</div></div>' : '') + '</div>';
  }

  function sessionPicker(base, selected, a) {
    return '<div class="field" style="max-width:520px"><label for="sess-pick">Session</label><select class="input" id="sess-pick" data-change="go-session" data-base="' + base + '">' +
      a.real.filter(function (s) { return s.kind !== 'induction' || true; }).map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' + esc(fmt(s.date) + (s.week ? ' · Week ' + s.week : '') + ' · ' + s.title) + (s.date > a.today ? ' (upcoming)' : '') + '</option>'; }).join('') + '</select></div>';
  }

  ADMIN_VIEWS.attendance = function (r) {
    var d = S.data, a = am(d);
    var mode = r.b === 'grid' ? 'grid' : 'mark';
    var tabs = '<div class="tabs"><a href="#/admin/attendance" class="' + (mode === 'mark' ? 'active' : '') + '">Take attendance</a><a href="#/admin/attendance/grid" class="' + (mode === 'grid' ? 'active' : '') + '">Year grid</a></div>';
    if (mode === 'grid') {
      var cols = a.held.length ? a.held : a.real.slice(0, 8);
      var grid = '<div class="table-wrap"><table class="t matrix"><thead><tr><th>Fellow</th>' + cols.map(function (s) { return '<th title="' + esc(s.title) + '">W' + esc(s.week || '') + '<br><small>' + esc(fmt(s.date)) + '</small></th>'; }).join('') + '<th>Rate</th></tr></thead><tbody>' +
        a.fellows.map(function (f) { return '<tr><td><b>' + esc(f.name) + '</b></td>' + cols.map(function (s) { var at = a.att[f.id + '|' + s.id]; return '<td><span class="cell ' + (at ? at.status : '') + '" title="' + esc(at ? ATT[at.status][0] : 'Not marked') + '"></span></td>'; }).join('') + '<td><b>' + (a.stats[f.id].attRate === null ? 'n/a' : a.stats[f.id].attRate + '%') + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
      return {
        html: head('Attendance', 'The whole year at a glance, laid out like the attendance sheet.', '<button class="btn btn-ghost btn-sm" data-act="export-attendance">' + icon('download') + 'Export CSV</button>') + tabs +
          '<div class="legend" style="margin-bottom:12px">' + Object.keys(ATT).map(function (k) { return '<span><span class="cell ' + k + '" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>' + ATT[k][0] + '</span>'; }).join('') + '<span><span class="cell" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>Not marked</span></div>' + grid
      };
    }
    var sid = r.b || (a.lastHeld ? a.lastHeld.id : (a.real[0] || {}).id);
    var s = d.sessions.filter(function (x) { return x.id === sid; })[0];
    if (!s) return { html: head('Attendance') + tabs + empty('calendar', 'No sessions yet.') };
    var list = a.fellows.filter(function (f) { return f.status === 'active' || a.att[f.id + '|' + s.id]; });
    var rows = list.map(function (f) {
      var cur = a.att[f.id + '|' + s.id];
      return '<div class="mark-row" data-pid="' + esc(f.id) + '"><div class="person"><div class="avatar">' + esc(initials(f.name)) + '</div><div><b>' + esc(f.name) + '</b><small>' + (cur ? 'Marked by ' + esc(cur.markedBy || '') : 'Not marked yet') + '</small></div></div><div class="seg" role="group" aria-label="Attendance for ' + esc(f.name) + '">' +
        Object.keys(ATT).map(function (k) { return '<button type="button" data-act="mark" data-v="' + k + '" class="' + (cur && cur.status === k ? 'on' : '') + '" aria-pressed="' + (cur && cur.status === k ? 'true' : 'false') + '">' + (k === 'dropped' ? 'Dropped' : ATT[k][0]) + '</button>'; }).join('') + '</div></div>';
    }).join('');
    return {
      html: head('Attendance', 'Mark each fellow, then save. Fellows see their own attendance on their journey.') + tabs + sessionPicker('#/admin/attendance/', s.id, a) +
        '<div class="card"><div class="card-head"><div><h2>' + esc(s.title) + '</h2><span class="sub">' + esc(fmt(s.date, true)) + (s.passage ? ' &middot; ' + esc(s.passage) : '') + '</span></div><button class="btn btn-ghost btn-sm" data-act="mark-all">Mark all present</button></div>' +
        '<div id="mark-list" data-sid="' + esc(s.id) + '">' + (rows || empty('users', 'No active fellows.')) + '</div>' +
        '<div class="form-actions" style="margin-top:16px"><button class="btn" data-act="save-attendance">' + icon('check') + 'Save attendance</button><span class="small muted" id="mark-dirty"></span></div></div>'
    };
  };

  ADMIN_VIEWS.reflections = function (r) {
    var d = S.data, a = am(d);
    var sid = r.b || (a.lastHeld ? a.lastHeld.id : (a.real[0] || {}).id);
    var s = d.sessions.filter(function (x) { return x.id === sid; })[0];
    var actions = '<button class="btn btn-ghost btn-sm" data-act="export-dbs">' + icon('download') + 'Export the year (CSV)</button>';
    if (!s) return { html: head('Reflections (DBS action points)', '', actions) + empty('book', 'No sessions yet.') };
    var rs = d.reflections.filter(function (x) { return x.sessionId === s.id; });
    var byP = mapBy(rs, 'personId');
    var missing = a.active.filter(function (f) { return !byP[f.id]; });
    var people = mapBy(d.people, 'id');
    var table = rs.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>"I WILL" statement</th><th>Scripture</th><th>Who will you share this with?</th><th>Review and questions</th><th></th></tr></thead><tbody>' + rs.sort(function (x, y) { return ((people[x.personId] || {}).name || '') < ((people[y.personId] || {}).name || '') ? -1 : 1; }).map(function (x) {
      return '<tr><td><b>' + esc((people[x.personId] || {}).name || 'Unknown') + '</b></td><td class="wrap">' + nl(x.iWill) + '</td><td>' + esc(x.scripture) + '</td><td>' + esc(x.shareWith) + (x.shared ? ' ' + chip('Shared', 'green') : '') + '</td><td class="wrap small">' + nl(x.review) + (x.questions ? '<br><b>Q:</b> ' + nl(x.questions) : '') + (x.feedback ? '<div class="feedback small"><b>Reply:</b> ' + nl(x.feedback) + '</div>' : '') + '</td><td><button class="btn btn-soft btn-sm" data-act="reflection-feedback" data-id="' + esc(x.id) + '">' + (x.feedback ? 'Edit reply' : 'Reply') + '</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="card">' + empty('book', 'No reflections for this session yet.') + '</div>';
    return {
      html: head('Reflections (DBS action points)', 'Every fellow\'s review, "I will" statement, Scripture and who they will share with, session by session.', actions) + sessionPicker('#/admin/reflections/', s.id, a) +
        '<div class="chips" style="margin-bottom:14px">' + chip(rs.length + ' of ' + a.active.length + ' submitted', rs.length >= a.active.length ? 'green' : 'amber') + (s.passage ? chip(s.passage, 'purple') : '') + '</div>' +
        (missing.length && s.date <= a.today ? '<p class="small muted">Not yet submitted: ' + missing.map(function (f) { return esc(f.name); }).join(', ') + '</p>' : '') + table
    };
  };

  ADMIN_VIEWS.assignments = function () {
    var d = S.data, a = am(d), people = mapBy(d.people, 'id'), tasks = mapBy(d.tasks, 'id');
    var queue = d.progress.filter(function (p) { return p.status === 'submitted'; });
    var queueHtml = '<div class="card"><div class="card-head"><h2>Waiting for review</h2><span class="sub">' + plural(queue.length, 'submission') + '</span></div>' + (queue.length ? '<ul class="list">' + queue.map(function (p) {
      return '<li><div class="avatar">' + esc(initials((people[p.personId] || {}).name)) + '</div><div class="grow"><div class="title">' + esc((tasks[p.taskId] || {}).title || '') + '</div><div class="meta">' + esc((people[p.personId] || {}).name || '') + ' &middot; ' + esc(fmtStamp(p.updatedAt)) + (p.fileName ? ' &middot; file attached' : '') + '</div></div><button class="btn btn-soft btn-sm" data-act="review-progress" data-id="' + esc(p.id) + '">Review</button></li>';
    }).join('') + '</ul>' : empty('check', 'Nothing waiting. All caught up.')) + '</div>';
    var sorted = d.tasks.slice().sort(function (x, y) { return (x.order || 0) - (y.order || 0); });
    var matrix = '<div class="table-wrap" style="margin-top:16px"><table class="t matrix"><thead><tr><th>Fellow</th>' + sorted.map(function (t) { return '<th title="' + esc(t.title) + '" style="max-width:70px;white-space:normal;font-size:10px">' + esc(t.title.replace(/^Read: /, '').slice(0, 18)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      a.fellows.map(function (f) {
        var model = { bibleDone: a.stats[f.id].bibleDone, mentees: d.mentees.filter(function (x) { return x.personId === f.id && x.status !== 'ended'; }), hi5: d.hi5.filter(function (x) { return x.personId === f.id; })[0], prog: mapBy(d.progress.filter(function (p) { return p.personId === f.id; }), 'taskId'), reports: mapBy(d.reports.filter(function (x) { return x.personId === f.id; }), 'quarter') };
        return '<tr><td><a href="#/admin/fellow/' + esc(f.id) + '/assignments"><b>' + esc(f.name) + '</b></a></td>' + sorted.map(function (t) { var st = taskState(t, model); return '<td><span class="cell ' + (st.done && st.status !== 'submitted' ? 'done' : st.status) + '" title="' + esc(t.title + ': ' + (STATUS[st.status] || [st.status])[0]) + '"></span></td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    var manage = '<div class="card" style="margin-top:16px"><div class="card-head"><h2>Assignments for the year</h2><button class="btn btn-sm" data-act="edit-task">' + icon('plus') + 'Add assignment</button></div><ul class="list">' + sorted.map(function (t) {
      return '<li><div class="grow"><div class="title">' + esc(t.title) + '</div><div class="meta">' + esc(t.quarter) + ' &middot; ' + esc(KIND[t.kind] || t.kind) + (t.due ? ' &middot; due ' + esc(fmt(t.due)) : '') + '</div></div><button class="icon-btn" data-act="edit-task" data-id="' + esc(t.id) + '" aria-label="Edit">' + icon('edit') + '</button></li>';
    }).join('') + '</ul></div>';
    return { html: head('Assignments and assessments', 'Review submissions, see the whole cohort at a glance and manage the year\'s assignments.') + queueHtml + '<div class="legend" style="margin-top:18px"><span><span class="cell done" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>Done</span><span><span class="cell submitted" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>Submitted</span><span><span class="cell in-progress" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>In progress</span><span><span class="cell returned" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>Needs work</span><span><span class="cell" style="width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:6px"></span>Not started</span></div>' + matrix + manage };
  };

  function reviewModal(id) {
    var d = S.data, p = d.progress.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var t = d.tasks.filter(function (x) { return x.id === p.taskId; })[0] || {}, f = d.people.filter(function (x) { return x.id === p.personId; })[0] || {};
    openModal(t.title || 'Review', '<p class="muted">' + esc(f.name) + ' &middot; ' + esc((STATUS[p.status] || [p.status])[0]) + ' &middot; updated ' + esc(fmtStamp(p.updatedAt)) + '</p>' +
      (p.result ? '<div class="qa"><div class="q">Result</div><div class="a">' + esc(p.result) + '</div></div>' : '') +
      (p.note ? '<div class="qa"><div class="q">Notes</div><div class="a">' + esc(p.note) + '</div></div>' : '') +
      (p.fileId ? '<p><button class="btn btn-ghost btn-sm" data-act="get-file" data-id="' + esc(p.fileId) + '">' + icon('download') + esc(p.fileName || 'Download file') + '</button></p>' : '') +
      '<form data-form="review" data-id="' + esc(p.id) + '"><div class="field"><label for="rv-fb">Your feedback</label><textarea class="input" id="rv-fb" name="feedback" rows="4">' + esc(p.feedback || '') + '</textarea></div>' +
      '<div class="form-actions"><button class="btn" type="submit" name="status" value="approved">' + icon('check') + 'Approve</button><button class="btn btn-ghost" type="submit" name="status" value="returned">Ask for changes</button></div></form>');
  }

  function taskEditModal(id) {
    var t = S.data.tasks.filter(function (x) { return x.id === id; })[0] || { kind: 'reading', quarter: 'Q1', required: true };
    var res = S.data.resources;
    openModal(t.id ? 'Edit assignment' : 'Add an assignment', '<form data-form="task-edit" data-id="' + esc(t.id || '') + '">' +
      '<div class="field"><label for="te-title">Title</label><input class="input" id="te-title" name="title" required value="' + esc(t.title || '') + '"></div>' +
      '<div class="field"><label for="te-desc">What fellows should do</label><textarea class="input" id="te-desc" name="description" rows="3">' + esc(t.description || '') + '</textarea></div>' +
      '<div class="row3"><div class="field"><label for="te-kind">Type</label><select class="input" id="te-kind" name="kind">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (t.kind === k ? ' selected' : '') + '>' + KIND[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="te-q">Quarter</label><select class="input" id="te-q" name="quarter">' + ['Q1', 'Q2', 'Q3', 'Q4'].map(function (q) { return '<option' + (t.quarter === q ? ' selected' : '') + '>' + q + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="te-due">Due</label><input class="input" type="date" id="te-due" name="due" value="' + esc(t.due || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label for="te-res">Linked resource</label><select class="input" id="te-res" name="resourceId"><option value="">None</option>' + res.map(function (r) { return '<option value="' + esc(r.id) + '"' + (t.resourceId === r.id ? ' selected' : '') + '>' + esc(r.title) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="te-order">Order</label><input class="input" type="number" id="te-order" name="order" value="' + esc(t.order || S.data.tasks.length + 1) + '"></div></div>' +
      '<div class="form-actions"><button class="btn" type="submit">Save</button>' + (t.id ? '<button class="btn btn-danger" type="button" data-act="delete-row" data-table="Tasks" data-id="' + esc(t.id) + '">' + icon('trash') + 'Delete</button>' : '') + '</div></form>');
  }

  function adminReportCard(f, q) {
    var r = S.data.reports.filter(function (x) { return x.personId === f.id && x.quarter === q; })[0];
    var ev = r && r.evaluation;
    var st = !r || !r.status || r.status === 'not-submitted' ? 'not-started' : r.status;
    return '<div class="card"><div class="card-head"><span class="eyebrow">' + q + ' &middot; ' + esc(quarterInfo(q).name) + '</span><div class="chips">' + chip('Self report: ' + (STATUS[st] || [st])[0], st === 'submitted' ? 'blue' : st === 'draft' ? 'amber' : '') + chip(ev ? (ev.released ? 'Evaluation released' : 'Evaluation draft') : 'Not evaluated', ev && ev.released ? 'green' : ev ? 'amber' : '') + '</div></div>' +
      '<div class="form-actions"><a class="btn btn-sm" href="#/admin/report/' + esc(f.id) + '/' + q + '">' + (ev ? 'Open evaluation' : 'Evaluate') + '</a><a class="btn btn-ghost btn-sm" href="#/admin/report/' + esc(f.id) + '/' + q + '/view">' + icon('eye') + 'Full report</a></div></div>';
  }

  ADMIN_VIEWS.reports = function (r) {
    var d = S.data, a = am(d);
    var q = /^Q[1-4]$/.test(r.b) ? r.b : quarterOf(a.today < (d.settings.startDate || '') ? d.settings.startDate : a.today);
    var tabs = '<div class="tabs">' + ['Q1', 'Q2', 'Q3', 'Q4'].map(function (x) { return '<a href="#/admin/reports/' + x + '" class="' + (x === q ? 'active' : '') + '">' + x + '<span class="tab-long"> ' + esc(quarterInfo(x).name.split(' ')[0]) + '</span>' + '</a>'; }).join('') + '</div>';
    var rows = a.fellows.map(function (f) {
      var rep = d.reports.filter(function (x) { return x.personId === f.id && x.quarter === q; })[0];
      var ev = rep && rep.evaluation, st = !rep || rep.status === 'not-submitted' ? 'not-started' : rep.status;
      return '<tr><td><div class="person"><div class="avatar">' + esc(initials(f.name)) + '</div><div><b>' + esc(f.name) + '</b><small>' + esc(f.country || '') + '</small></div></div></td><td>' + chip((STATUS[st] || [st])[0], st === 'submitted' ? 'blue' : st === 'draft' ? 'amber' : '') + (rep && rep.submittedAt ? '<br><small class="muted">' + esc(fmtStamp(rep.submittedAt)) + '</small>' : '') + '</td><td>' + chip(ev ? (ev.released ? 'Released' : 'Draft') : 'Not started', ev && ev.released ? 'green' : ev ? 'amber' : '') + '</td>' +
        '<td style="white-space:nowrap"><a class="btn btn-sm ' + (ev && ev.released ? 'btn-ghost' : '') + '" href="#/admin/report/' + esc(f.id) + '/' + q + '">' + (ev ? 'Open' : 'Evaluate') + '</a> ' + reportActions(q, f.id) + '</td></tr>';
    }).join('');
    return { html: head('Quarterly reports', 'Read each self report, write your evaluation and release it to the fellow when it is ready. Every report downloads as a PDF and can be shared with a private link.', '<button class="btn btn-ghost btn-sm" data-act="export-reports" data-q="' + q + '">' + icon('download') + 'Export ' + q + ' (CSV)</button>') + tabs + '<div class="qhead"><span class="q">' + q + '</span><h2>' + esc(quarterInfo(q).name) + '</h2><span class="muted">' + esc(quarterInfo(q).field) + '</span></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Fellow</th><th>Self report</th><th>Evaluation</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">' + empty('users', 'No fellows yet.') + '</td></tr>') + '</tbody></table></div>' };
  };

  ADMIN_VIEWS.report = function (r) {
    var d = S.data, f = d.people.filter(function (p) { return p.id === r.b; })[0], q = r.c;
    if (!f || !/^Q[1-4]$/.test(q)) return { html: head('Report not found') };
    if (route().raw.split('/').pop() === 'view') return reportPage(q, f.id);
    var rep = d.reports.filter(function (x) { return x.personId === f.id && x.quarter === q; })[0] || {};
    var a = rep.answers, ev = rep.evaluation || { ratings: {} }, st = d.settings;
    var self = '<div class="card"><div class="card-head"><h2>' + esc(firstName(f.name)) + '\'s self report</h2>' + chip((STATUS[rep.status] || ['Not started'])[0], rep.status === 'submitted' ? 'blue' : 'amber') + '</div>' + (a ? (st.reportQuestions || []).map(function (x) { return '<div class="qa"><div class="q">' + esc(x.q) + '</div><div class="a">' + (a[x.k] ? esc(a[x.k]) : '<span class="muted">No answer</span>') + '</div></div>'; }).join('') +
      (st.selfRatings || []).map(function (x) { var v = a.ratings && a.ratings[x.k]; return '<div class="rating-row"><span>' + esc(x.l) + '</span><b style="color:var(--accent-text)">' + (v ? v + ' / 5' : 'Not rated') + '</b></div>'; }).join('') : empty('file', 'Not written yet. You can still evaluate from what you have seen.')) + '</div>';
    var form = '<form data-form="evaluate" data-pid="' + esc(f.id) + '" data-q="' + q + '"><div class="card"><div class="card-head"><h2>Your evaluation</h2>' + (ev.at ? '<span class="sub">Last saved by ' + esc(ev.by || '') + ' ' + esc(fmtStamp(ev.at)) + '</span>' : '') + '</div>' +
      (st.evalCriteria || []).map(function (c) { return '<div class="rating-row"><span>' + esc(c.l) + '</span>' + scale('e-' + c.k, ev.ratings && ev.ratings[c.k], false) + '</div>'; }).join('') +
      '<div class="field" style="margin-top:14px"><label for="ev-s">Strengths</label><textarea class="input" id="ev-s" name="strengths" rows="3">' + esc(ev.strengths || '') + '</textarea></div>' +
      '<div class="field"><label for="ev-g">Areas to grow</label><textarea class="input" id="ev-g" name="growth" rows="3">' + esc(ev.growth || '') + '</textarea></div>' +
      '<div class="field"><label for="ev-c">Comment to the fellow</label><textarea class="input" id="ev-c" name="comment" rows="3">' + esc(ev.comment || '') + '</textarea></div>' +
      '<div class="field"><label class="check"><input type="checkbox" name="released"' + (ev.released ? ' checked' : '') + '> Release to ' + esc(firstName(f.name)) + ' (they get an email and can read, download and share it)</label></div>' +
      '<div class="form-actions"><button class="btn" type="submit">Save evaluation</button></div></div></form>';
    return {
      html: '<a href="#/admin/reports/' + q + '" class="small" style="text-decoration:none">' + icon('back').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"') + ' ' + q + ' reports</a>' +
        head(f.name + ': ' + q + ' report', esc(quarterInfo(q).name + '. ' + quarterInfo(q).field), '<a class="btn btn-ghost btn-sm" href="#/admin/report/' + esc(f.id) + '/' + q + '/view">' + icon('eye') + 'Full report</a>' + reportActions(q, f.id)) +
        '<div class="grid g2" style="align-items:start">' + self + form + '</div>'
    };
  };

  function concernCard(c) {
    var people = mapBy(S.data.people, 'id');
    var who = c.anonymous ? 'Anonymous fellow' : (people[c.personId] || {}).name || 'Unknown';
    var tone = c.status === 'resolved' ? 'green' : c.status === 'in-progress' ? 'blue' : 'amber';
    return '<div class="card"><div class="card-head"><div class="chips">' + chip(c.category) + chip(c.status === 'in-progress' ? 'In progress' : c.status, tone) + (c.anonymous ? chip('Anonymous', 'purple') : '') + '</div><span class="sub">' + esc(fmtStamp(c.createdAt)) + '</span></div>' +
      '<div class="title" style="font-weight:700">' + esc(who) + (c.subject ? ': ' + esc(c.subject) : '') + '</div><p style="margin-top:6px">' + nl(c.message) + '</p>' +
      (c.response ? '<div class="feedback small"><b>' + esc(c.respondedBy || '') + '</b><div>' + nl(c.response) + '</div></div>' : '') +
      '<div class="form-actions" style="margin-top:12px"><button class="btn btn-soft btn-sm" data-act="respond-concern" data-id="' + esc(c.id) + '">' + icon('message') + (c.response ? 'Update reply' : 'Reply') + '</button></div></div>';
  }

  ADMIN_VIEWS.voice = function (r) {
    var d = S.data, filter = r.b || 'open';
    var list = d.concerns.filter(function (c) { return filter === 'all' ? true : filter === 'open' ? c.status !== 'resolved' : c.status === 'resolved'; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var tabs = '<div class="tabs">' + [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(function (t) { return '<a href="#/admin/voice/' + t[0] + '" class="' + (filter === t[0] ? 'active' : '') + '">' + t[1] + '</a>'; }).join('') + '</div>';
    return { html: head('Concerns, complaints and prayer', 'Everything fellows share privately. Replies are emailed to the fellow and appear in their portal, including for anonymous messages.') + tabs + '<div class="stack">' + (list.length ? list.map(concernCard).join('') : '<div class="card">' + empty('message', 'Nothing here.') + '</div>') + '</div>' };
  };

  ADMIN_VIEWS.roadmap = function () {
    var d = S.data, a = am(d);
    var rows = a.sessions.map(function (s) {
      return '<tr class="click" data-act="edit-session" data-id="' + esc(s.id) + '"' + (s.kind === 'break' ? ' style="opacity:.6"' : '') + '><td style="white-space:nowrap">' + esc(fmt(s.date, true)) + '</td><td class="num">' + esc(s.week || '') + '</td><td><b>' + esc(s.title) + '</b>' + (s.kind !== 'session' ? ' ' + chip(s.kind) : '') + '</td><td>' + esc(s.passage || '') + '</td><td>' + esc(s.facilitator || '') + '</td></tr>';
    }).join('');
    return { html: head('Roadmap', 'The year\'s sessions. Fellows see this as their journey, and the Thursday reminder emails use it. This starter roadmap was carried over from 2025/2026 with Making Ends Meet moved after MLM: check the dates and passages.', '<button class="btn btn-ghost btn-sm" data-act="ics-all">' + icon('calendar') + 'Calendar file</button><button class="btn btn-sm" data-act="edit-session">' + icon('plus') + 'Add session</button>') +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th class="num">Week</th><th>Session</th><th>DBS passage</th><th>Facilitator</th></tr></thead><tbody>' + rows + '</tbody></table></div>' };
  };

  function sessionModal(id) {
    var s = S.data.sessions.filter(function (x) { return x.id === id; })[0] || { kind: 'session', date: todayISO() };
    openModal(s.id ? 'Edit session' : 'Add a session', '<form data-form="session" data-id="' + esc(s.id || '') + '">' +
      '<div class="field"><label for="se-title">Title</label><input class="input" id="se-title" name="title" required value="' + esc(s.title || '') + '"></div>' +
      '<div class="row3"><div class="field"><label for="se-date">Date</label><input class="input" type="date" id="se-date" name="date" required value="' + esc(s.date || '') + '"></div><div class="field"><label for="se-week">Week</label><input class="input" type="number" id="se-week" name="week" value="' + esc(s.week || '') + '"></div>' +
      '<div class="field"><label for="se-kind">Type</label><select class="input" id="se-kind" name="kind">' + [['session', 'Session'], ['intensive', 'Intensive'], ['retreat', 'Retreat'], ['induction', 'Induction'], ['graduation', 'Graduation'], ['break', 'Break']].map(function (k) { return '<option value="' + k[0] + '"' + (s.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="row2"><div class="field"><label for="se-pass">DBS passage</label><input class="input" id="se-pass" name="passage" value="' + esc(s.passage || '') + '"></div><div class="field"><label for="se-fac">Facilitator</label><input class="input" id="se-fac" name="facilitator" value="' + esc(s.facilitator || '') + '"></div></div>' +
      '<div class="field"><label for="se-link">Meeting link</label><input class="input" id="se-link" name="link" type="url" value="' + esc(s.link || '') + '" placeholder="Leave empty to use the usual link from Settings"></div>' +
      '<div class="field"><label for="se-res">Resources</label><textarea class="input" id="se-res" name="resources" rows="2">' + esc(s.resources || '') + '</textarea></div>' +
      '<div class="field"><label for="se-notes">Notes for fellows</label><textarea class="input" id="se-notes" name="notes" rows="3">' + esc(s.notes || '') + '</textarea></div>' +
      '<div class="form-actions"><button class="btn" type="submit">Save</button>' + (s.id ? '<button class="btn btn-danger" type="button" data-act="delete-row" data-table="Sessions" data-id="' + esc(s.id) + '">' + icon('trash') + 'Delete</button>' : '') + '</div></form>');
  }

  var SETTINGS_FIELDS = [
    ['cohortName', 'Cohort name', 'text'], ['programmeYear', 'Programme year', 'text'], ['startDate', 'Start date', 'date'], ['endDate', 'End date', 'date'],
    ['bibleStart', 'Bible in One Year starts on', 'date'], ['sessionTime', 'When sessions happen', 'text'], ['meetingLink', 'Usual meeting link (Zoom or Meet)', 'url'],
    ['whatsappGroup', 'Cohort WhatsApp group link', 'url'], ['welcomeNote', 'Welcome note on the home page', 'textarea'], ['remindersOn', 'Reminder emails (yes or no)', 'text']
  ];

  ADMIN_VIEWS.content = function () {
    var d = S.data, set = d.allSettings || {};
    var anns = d.announcements.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var annHtml = '<div class="card"><div class="card-head"><h2>Announcements</h2><button class="btn btn-sm" data-act="edit-ann">' + icon('plus') + 'New</button></div>' + (anns.length ? '<ul class="list">' + anns.map(function (x) { return '<li><div class="grow"><div class="title">' + (x.pinned ? chip('Pinned', 'amber') + ' ' : '') + esc(x.title) + '</div><div class="meta">' + esc(fmtStamp(x.createdAt)) + '</div></div><button class="icon-btn" data-act="edit-ann" data-id="' + esc(x.id) + '" aria-label="Edit">' + icon('edit') + '</button></li>'; }).join('') + '</ul>' : empty('megaphone', 'No announcements yet.')) + '</div>';
    var resHtml = '<div class="card"><div class="card-head"><h2>Resources</h2><button class="btn btn-sm" data-act="edit-res">' + icon('plus') + 'New</button></div><ul class="list">' + d.resources.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (x) { return '<li><div class="grow"><div class="title">' + esc(x.title) + (x.gift ? ' ' + chip('Gift', 'amber') : '') + '</div><div class="meta">' + esc(x.kind || '') + (x.link ? ' &middot; has a link' : ' &middot; no link yet') + '</div></div><button class="icon-btn" data-act="edit-res" data-id="' + esc(x.id) + '" aria-label="Edit">' + icon('edit') + '</button></li>'; }).join('') + '</ul></div>';
    var setHtml = '<div class="card"><div class="card-head"><h2>Settings</h2></div><form data-form="settings">' + SETTINGS_FIELDS.map(function (f) {
      return '<div class="field"><label for="st-' + f[0] + '">' + esc(f[1]) + '</label>' + (f[2] === 'textarea' ? '<textarea class="input" id="st-' + f[0] + '" name="' + f[0] + '" rows="3">' + esc(set[f[0]] || '') + '</textarea>' : '<input class="input" id="st-' + f[0] + '" name="' + f[0] + '" type="' + (f[2] === 'url' ? 'url' : f[2]) + '" value="' + esc(set[f[0]] || '') + '">') + '</div>';
    }).join('') + '<div class="form-actions"><button class="btn" type="submit">Save settings</button></div></form></div>';
    var tools = '<div class="card"><h3>The spreadsheet</h3><p class="small muted" style="margin-top:6px">Everything lives in the TSF Portal sheet under engage@thehudgroupglobal.org. The "Attendance Grid" and "DBS Action Points" tabs mirror the sheets you already use and refresh automatically.</p><div class="form-actions"><a class="btn btn-soft btn-sm" href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">' + icon('sheet') + 'Open the sheet</a><button class="btn btn-ghost btn-sm" data-act="refresh-views">' + icon('refresh') + 'Refresh the sheet views</button></div></div>';
    return { html: head('Content and settings', 'Announcements, the resource library and cohort settings.') + '<div class="grid g2" style="align-items:start"><div class="stack">' + annHtml + resHtml + tools + '</div>' + setHtml + '</div>' };
  };

  function annModal(id) {
    var x = S.data.announcements.filter(function (y) { return y.id === id; })[0] || {};
    openModal(x.id ? 'Edit announcement' : 'New announcement', '<form data-form="ann" data-id="' + esc(x.id || '') + '"><div class="field"><label for="an-t">Title</label><input class="input" id="an-t" name="title" required value="' + esc(x.title || '') + '"></div><div class="field"><label for="an-b">Message</label><textarea class="input" id="an-b" name="body" rows="5" required>' + esc(x.body || '') + '</textarea></div><div class="field"><label class="check"><input type="checkbox" name="pinned"' + (x.pinned ? ' checked' : '') + '> Pin to the top</label></div><div class="form-actions"><button class="btn" type="submit">Publish</button>' + (x.id ? '<button class="btn btn-danger" type="button" data-act="delete-row" data-table="Announcements" data-id="' + esc(x.id) + '">' + icon('trash') + 'Delete</button>' : '') + '</div></form>');
  }
  function resModal(id) {
    var x = S.data.resources.filter(function (y) { return y.id === id; })[0] || { kind: 'book' };
    openModal(x.id ? 'Edit resource' : 'New resource', '<form data-form="res" data-id="' + esc(x.id || '') + '"><div class="row2"><div class="field"><label for="rs-t">Title</label><input class="input" id="rs-t" name="title" required value="' + esc(x.title || '') + '"></div><div class="field"><label for="rs-a">Author</label><input class="input" id="rs-a" name="author" value="' + esc(x.author || '') + '"></div></div>' +
      '<div class="row3"><div class="field"><label for="rs-k">Type</label><select class="input" id="rs-k" name="kind">' + [['book', 'Book'], ['course', 'Course'], ['assessment', 'Assessment'], ['plan', 'Reading plan'], ['video', 'Video'], ['other', 'Other']].map(function (k) { return '<option value="' + k[0] + '"' + (x.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></div><div class="field"><label for="rs-q">Quarter</label><select class="input" id="rs-q" name="quarter"><option value="">Any</option>' + ['Q1', 'Q2', 'Q3', 'Q4'].map(function (q) { return '<option' + (x.quarter === q ? ' selected' : '') + '>' + q + '</option>'; }).join('') + '</select></div><div class="field"><label for="rs-o">Order</label><input class="input" type="number" id="rs-o" name="order" value="' + esc(x.order || '') + '"></div></div>' +
      '<div class="field"><label for="rs-l">Link (Google Drive, website or video)</label><input class="input" type="url" id="rs-l" name="link" value="' + esc(x.link || '') + '"><div class="hint">For a Drive file, share it with "Anyone with the link" or with the fellows first.</div></div>' +
      '<div class="field"><label for="rs-d">Description</label><textarea class="input" id="rs-d" name="description" rows="3">' + esc(x.description || '') + '</textarea></div>' +
      '<div class="field"><label class="check"><input type="checkbox" name="gift"' + (x.gift ? ' checked' : '') + '> Graduation gift</label></div>' +
      '<div class="form-actions"><button class="btn" type="submit">Save</button>' + (x.id ? '<button class="btn btn-danger" type="button" data-act="delete-row" data-table="Resources" data-id="' + esc(x.id) + '">' + icon('trash') + 'Delete</button>' : '') + '</div></form>');
  }

  /* ================================================================ actions (clicks) */
  var ACT = {};
  ACT['close-modal'] = closeModal;
  ACT.reload = function () { location.reload(); };
  ACT.go = function (el) { location.hash = el.getAttribute('data-href'); };
  ACT.print = function () { window.print(); };
  ACT['sign-out'] = function () {
    var t = S.token;
    if (t) api('signOut').catch(function () { /* sign out locally anyway */ });
    signOutLocal();
  };
  ACT['login-back'] = function () { S.loginStep = 'email'; vLogin(); };
  ACT['login-resend'] = function (el) { run(el, api('requestCode', { email: S.loginEmail }), 'A new code is on its way'); };
  ACT['more-menu'] = function () {
    var admin = isAdmin() && !S.viewAs;
    var items = admin ? ADMIN_NAV.slice(4) : FELLOW_NAV.slice(4);
    openModal('More', '<div class="more-grid">' + items.map(function (n) { return '<a href="' + (admin ? '#/admin/' + n[0] : '#/' + n[0]) + '">' + icon(n[2]) + esc(n[1]) + '</a>'; }).join('') + '<a href="#" data-act="sign-out">' + icon('logout') + 'Sign out</a></div>');
  };
  ACT['view-as'] = function (el) {
    var id = el.getAttribute('data-id');
    busy(el, true);
    api('bootstrap', { as: id }).then(function (r) { S.fd = r.data; S.viewAs = id; store.sset('tsf.viewAs', id); bump(); busy(el, false); if (location.hash === '#/home') render(); else location.hash = '#/home'; }, function (e) { busy(el, false); toast(e.message, true); });
  };
  ACT['exit-view-as'] = function () { var id = S.viewAs; S.viewAs = ''; S.fd = null; store.sset('tsf.viewAs', ''); bump(); location.hash = '#/admin/fellow/' + id; };

  ACT['bible-day'] = function (el) {
    var i = +el.getAttribute('data-i');
    var on = !el.classList.contains('on');
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', on);
    setBibleDay(i, on);
  };
  ACT['bible-today'] = function () {
    var m = fm(F());
    var i = m.bibleExpected - 1;
    if (i < 0) return toast('Your Bible plan has not started yet.', true);
    setBibleDay(Math.min(i, 364), true);
    render();
  };
  ACT['pray-today'] = function (el) {
    var h = F().hi5, today = todayISO();
    if (!h) { location.hash = '#/disciples'; return; }
    var undo = (h.prayerLog || []).indexOf(today) >= 0;
    run(el, api('prayHi5', { date: today, undo: undo }), undo ? 'Removed' : 'Prayer logged. Thank you for standing in the gap.').then(function (r) { F().hi5 = r.hi5; bump(); render(); });
  };
  ACT['edit-mentee'] = function (el) { menteeModal(el.getAttribute('data-id')); };
  ACT['log-meeting'] = function (el) {
    var id = el.getAttribute('data-id');
    openModal('Log a meeting', '<form data-form="meeting" data-id="' + esc(id) + '"><div class="field"><label for="mt-d">Date</label><input class="input" type="date" id="mt-d" name="date" value="' + todayISO() + '" required></div><div class="field"><label for="mt-n">What did you do together?</label><textarea class="input" id="mt-n" name="note" rows="3" placeholder="e.g. Read John 4 together, prayed for exams"></textarea></div><div class="form-actions"><button class="btn" type="submit">Save</button></div></form>');
  };
  ACT['delete-mentee'] = function (el) {
    var id = el.getAttribute('data-id');
    confirmBox('Remove this disciple from your list? Their meeting history will be deleted.', 'Remove', true).then(function (ok) {
      if (!ok) return;
      api('deleteMentee', { id: id }).then(function () { F().mentees = F().mentees.filter(function (x) { return x.id !== id; }); bump(); toast('Removed'); render(); }, function (e) { toast(e.message, true); });
    });
  };
  ACT['edit-hi5'] = hi5Modal;
  ACT['open-task'] = function (el) { taskModal(el.getAttribute('data-id')); };
  ACT['get-file'] = function (el) {
    run(el, api('getFile', { fileId: el.getAttribute('data-id') })).then(function (r) { saveBlob(b64ToBlob(r.data, r.type), r.name); });
  };
  ACT['ics-all'] = function () { var d = F() || S.data; saveBlob(icsFor(d.sessions, d.settings.cohortName), 'TSF sessions.ics'); };
  ACT['ics-one'] = function (el) { var d = F(); var s = d.sessions.filter(function (x) { return x.id === el.getAttribute('data-id'); }); saveBlob(icsFor(s, d.settings.cohortName), 'TSF ' + (s[0] ? s[0].date : 'session') + '.ics'); };

  function reportTarget(el) {
    var p = { quarter: el.getAttribute('data-q') };
    var pid = el.getAttribute('data-pid') || S.viewAs;
    if (pid) p.personId = pid;
    return p;
  }
  ACT['report-pdf'] = function (el) {
    var p = reportTarget(el);
    run(el, api('reportPdf', p)).then(function (r) {
      var blob = b64ToBlob(r.data, 'application/pdf');
      var file = typeof File === 'function' ? new File([blob], r.name, { type: 'application/pdf' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && window.matchMedia('(max-width: 900px)').matches) {
        openModal('Your PDF is ready', '<p>' + esc(r.name) + '</p><div class="form-actions"><button class="btn" data-share-file>' + icon('share') + 'Share</button><button class="btn btn-ghost" data-save-file>' + icon('download') + 'Save</button></div>');
        S.modal.querySelector('[data-share-file]').onclick = function () { navigator.share({ files: [file], title: r.name }).catch(function () { /* cancelled */ }); };
        S.modal.querySelector('[data-save-file]').onclick = function () { saveBlob(blob, r.name); closeModal(); };
      } else saveBlob(blob, r.name);
    });
  };
  ACT['report-share'] = function (el) {
    var p = reportTarget(el);
    run(el, api('shareReport', p)).then(function (r) {
      var d = S.viewAs ? S.fd : S.data;
      if (d.shares) d.shares.push(r.share);
      var url = location.origin + location.pathname + '#/shared/' + r.share.token;
      openModal('Share this report', '<p class="muted">Anyone with this link can read this one report until ' + esc(fmtStamp(r.share.expiresAt)) + '. They cannot see anything else in the portal, and you can withdraw the link at any time from the reports page.</p>' +
        '<div class="field"><input class="input" id="share-url" readonly value="' + esc(url) + '"></div><div class="form-actions"><button class="btn" data-copy>' + icon('link') + 'Copy link</button>' + (navigator.share ? '<button class="btn btn-ghost" data-native>' + icon('share') + 'Share</button>' : '') + '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('My Shadrach Fellowship ' + p.quarter + ' report: ' + url) + '">WhatsApp</a></div>');
      S.modal.querySelector('[data-copy]').onclick = function () { copy(url); };
      var nat = S.modal.querySelector('[data-native]');
      if (nat) nat.onclick = function () { navigator.share({ title: 'Shadrach Fellowship report', url: url }).catch(function () { /* cancelled */ }); };
    });
  };
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Link copied'); }, function () {
      var i = document.getElementById('share-url'); if (i) { i.select(); document.execCommand('copy'); toast('Link copied'); }
    });
  }
  ACT['copy-share'] = function (el) { copy(location.origin + location.pathname + '#/shared/' + el.getAttribute('data-token')); };
  ACT['revoke-share'] = function (el) {
    var token = el.getAttribute('data-token');
    confirmBox('Withdraw this link? Anyone who has it will no longer be able to open the report.', 'Withdraw', true).then(function (ok) {
      if (!ok) return;
      api('revokeShare', { shareToken: token }).then(function () { var d = F(); d.shares = (d.shares || []).filter(function (s) { return s.token !== token; }); bump(); toast('Link withdrawn'); render(); }, function (e) { toast(e.message, true); });
    });
  };

  // admin clicks
  ACT['edit-person'] = function (el) { personModal(el.getAttribute('data-id')); };
  ACT['remove-person'] = function (el) {
    var id = el.getAttribute('data-id');
    var p = S.data.people.filter(function (x) { return x.id === id; })[0];
    confirmBox('Remove ' + (p ? p.name : 'this person') + '\'s access? They will be signed out. Their records stay in the sheet.', 'Remove access', true).then(function (ok) {
      if (!ok) return;
      api('adminDelete', { table: 'People', id: id }).then(function () { S.data.people = S.data.people.filter(function (x) { return x.id !== id; }); bump(); toast('Access removed'); location.hash = '#/admin/fellows'; render(); }, function (e) { toast(e.message, true); });
    });
  };
  ACT['bulk-add'] = function () {
    openModal('Add many people', '<form data-form="bulk"><p class="muted small">One person per line: <b>Full name, email, country</b>. City and phone can follow if you like: <b>Name, email, country, city, phone</b>. Everyone is added as an active fellow in ' + esc(S.data.settings.cohortName || 'this cohort') + '.</p><div class="field"><textarea class="input" name="rows" rows="10" placeholder="Ama Mensah, ama@example.com, Ghana"></textarea></div><div class="form-actions"><button class="btn" type="submit">Add to the roster</button></div></form>', true);
  };
  ACT['send-welcome'] = function () {
    var list = S.data.people.filter(function (p) { return p.status === 'active'; }).sort(by('name'));
    openModal('Send welcome emails', '<form data-form="welcome"><p class="muted small">Each person gets an email from engage@thehudgroupglobal.org with the portal link and how to sign in.</p><div class="field"><label class="check"><input type="checkbox" data-all checked> Select everyone</label></div><div style="max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px 12px">' +
      list.map(function (p) { return '<label class="check" style="padding:8px 0;border-bottom:1px solid var(--line)"><input type="checkbox" name="p" value="' + esc(p.id) + '"' + (p.role === 'fellow' ? ' checked' : '') + '> ' + esc(p.name) + ' <span class="muted">' + esc(p.email) + (p.role === 'admin' ? ' (admin)' : '') + '</span></label>'; }).join('') +
      '</div><div class="form-actions" style="margin-top:14px"><button class="btn" type="submit">' + icon('send') + 'Send</button></div></form>', true);
    var all = S.modal.querySelector('[data-all]');
    all.onchange = function () { S.modal.querySelectorAll('input[name=p]').forEach(function (c) { c.checked = all.checked; }); };
  };
  ACT.mark = function (el) {
    var seg = el.parentNode;
    var was = el.classList.contains('on');
    seg.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    if (!was) { el.classList.add('on'); el.setAttribute('aria-pressed', 'true'); }
    var dirty = document.getElementById('mark-dirty'); if (dirty) dirty.textContent = 'Unsaved changes';
  };
  ACT['mark-all'] = function () {
    document.querySelectorAll('#mark-list .mark-row').forEach(function (row) {
      if (row.querySelector('button.on')) return;
      var b = row.querySelector('button[data-v="present"]'); b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
    });
    var dirty = document.getElementById('mark-dirty'); if (dirty) dirty.textContent = 'Unsaved changes';
  };
  ACT['save-attendance'] = function (el) {
    var box = document.getElementById('mark-list'), sid = box.getAttribute('data-sid'), marks = {};
    box.querySelectorAll('.mark-row').forEach(function (row) { var on = row.querySelector('button.on'); marks[row.getAttribute('data-pid')] = on ? on.getAttribute('data-v') : ''; });
    run(el, api('markAttendance', { sessionId: sid, marks: marks }), 'Attendance saved').then(function (r) {
      S.data.attendance = S.data.attendance.filter(function (a) { return a.sessionId !== sid; }).concat(r.attendance); bump(); render();
    });
  };
  ACT['reflection-feedback'] = function (el) {
    var x = S.data.reflections.filter(function (r) { return r.id === el.getAttribute('data-id'); })[0];
    var p = S.data.people.filter(function (y) { return y.id === x.personId; })[0] || {};
    openModal('Reply to ' + firstName(p.name), (x.iWill ? '<div class="iwill" style="padding:14px 16px 14px 20px;margin-bottom:14px"><q style="font-size:16px">' + nl(x.iWill) + '</q></div>' : '') + '<form data-form="feedback" data-id="' + esc(x.id) + '"><div class="field"><label for="fb">Your reply</label><textarea class="input" id="fb" name="feedback" rows="4">' + esc(x.feedback || '') + '</textarea><div class="hint">' + esc(firstName(p.name)) + ' sees this under their reflection and gets an email.</div></div><div class="form-actions"><button class="btn" type="submit">' + icon('send') + 'Send reply</button></div></form>');
  };
  ACT['review-progress'] = function (el) { reviewModal(el.getAttribute('data-id')); };
  ACT['edit-task'] = function (el) { taskEditModal(el.getAttribute('data-id')); };
  ACT['edit-session'] = function (el) { sessionModal(el.getAttribute('data-id')); };
  ACT['edit-ann'] = function (el) { annModal(el.getAttribute('data-id')); };
  ACT['edit-res'] = function (el) { resModal(el.getAttribute('data-id')); };
  ACT['delete-row'] = function (el) {
    var table = el.getAttribute('data-table'), id = el.getAttribute('data-id');
    confirmBox('Delete this permanently? This cannot be undone.', 'Delete', true).then(function (ok) {
      if (!ok) return;
      api('adminDelete', { table: table, id: id }).then(function () {
        var key = { Tasks: 'tasks', Sessions: 'sessions', Announcements: 'announcements', Resources: 'resources' }[table];
        S.data[key] = S.data[key].filter(function (x) { return x.id !== id; }); bump(); toast('Deleted'); render();
      }, function (e) { toast(e.message, true); });
    });
  };
  ACT['respond-concern'] = function (el) {
    var c = S.data.concerns.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    openModal('Reply', '<p class="small muted">' + nl(c.message) + '</p><form data-form="respond" data-id="' + esc(c.id) + '"><div class="field"><label for="rp">Your reply</label><textarea class="input" id="rp" name="response" rows="4">' + esc(c.response || '') + '</textarea><div class="hint">The fellow gets an email and sees the reply in their portal' + (c.anonymous ? ', without their name ever being shown to you' : '') + '.</div></div>' +
      '<div class="field"><label for="rp-s">Status</label><select class="input" id="rp-s" name="status">' + [['open', 'Open'], ['in-progress', 'In progress'], ['resolved', 'Resolved']].map(function (s) { return '<option value="' + s[0] + '"' + (c.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div><div class="form-actions"><button class="btn" type="submit">Save</button></div></form>');
  };
  ACT['refresh-views'] = function (el) { run(el, api('refreshViews'), 'Sheet views refreshed'); };
  ACT['export-attendance'] = function () {
    var a = am(S.data);
    var rows = [['Fellow'].concat(a.real.map(function (s) { return 'Week ' + (s.week || '') + ' - ' + s.date; }))];
    a.fellows.forEach(function (f) { rows.push([f.name].concat(a.real.map(function (s) { var x = a.att[f.id + '|' + s.id]; return x ? S.data.settings.attendanceLabels[x.status] : ''; }))); });
    downloadCsv('TSF attendance.csv', rows);
  };
  ACT['export-dbs'] = function () {
    var people = mapBy(S.data.people, 'id'), sess = mapBy(S.data.sessions, 'id');
    var rows = [['Date', 'Week', 'Session', 'Passage', 'Name', '"I WILL" Statement', 'Scripture', 'Who will you share this with?', 'Shared', 'Review and notes', 'Questions', 'Facilitator reply']];
    S.data.reflections.slice().sort(function (a, b) { return ((sess[a.sessionId] || {}).date || '') < ((sess[b.sessionId] || {}).date || '') ? -1 : 1; }).forEach(function (r) {
      var s = sess[r.sessionId] || {};
      rows.push([s.date, s.week, s.title, s.passage, (people[r.personId] || {}).name, r.iWill, r.scripture, r.shareWith, r.shared ? 'Yes' : '', r.review, r.questions, r.feedback]);
    });
    downloadCsv('TSF DBS action points.csv', rows);
  };
  ACT['export-reports'] = function (el) {
    var q = el.getAttribute('data-q'), st = S.data.settings, people = mapBy(S.data.people, 'id');
    var rows = [['Fellow', 'Self report status', 'Submitted'].concat(st.reportQuestions.map(function (x) { return x.q; }), st.selfRatings.map(function (x) { return 'Self: ' + x.l; }), st.evalCriteria.map(function (x) { return 'Facilitator: ' + x.l; }), ['Strengths', 'Areas to grow', 'Comment', 'Released'])];
    S.data.reports.filter(function (r) { return r.quarter === q; }).forEach(function (r) {
      var a = r.answers || {}, e = r.evaluation || {};
      rows.push([(people[r.personId] || {}).name, r.status, fmtStamp(r.submittedAt)].concat(st.reportQuestions.map(function (x) { return a[x.k] || ''; }), st.selfRatings.map(function (x) { return (a.ratings || {})[x.k] || ''; }), st.evalCriteria.map(function (x) { return (e.ratings || {})[x.k] || ''; }), [e.strengths, e.growth, e.comment, e.released ? 'Yes' : 'No']));
    });
    downloadCsv('TSF ' + q + ' reports.csv', rows);
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var fn = ACT[el.getAttribute('data-act')];
    if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]');
    if (el && el.getAttribute('data-change') === 'go-session') location.hash = el.getAttribute('data-base') + encodeURIComponent(el.value);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.modal) closeModal();
    if (e.key === 'Enter' && e.target.matches && e.target.matches('tr.click')) e.target.click();
  });

  /* ================================================================ forms */
  var FORM = {};
  function vals(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'file' || el.type === 'submit') return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value.trim();
    });
    return o;
  }

  FORM['request-code'] = function (form, btn) {
    var v = vals(form);
    var err = form.querySelector('#login-err');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) { err.innerHTML = '<div class="err">Please enter a valid email address.</div>'; return; }
    S.loginEmail = v.email.toLowerCase();
    store.set('tsf.remember', v.remember ? 'yes' : 'no', true);
    run(btn, api('requestCode', { email: S.loginEmail })).then(function () { S.loginStep = 'code'; vLogin(); }, function (e) { err.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  };
  FORM['verify-code'] = function (form, btn) {
    var code = (vals(form).code || '').replace(/\D/g, '');
    var err = form.querySelector('#login-err');
    if (code.length !== 6) { err.innerHTML = '<div class="err">Please enter the 6-digit code from the email.</div>'; return; }
    run(btn, api('verifyCode', { email: S.loginEmail, code: code })).then(function (r) {
      S.token = r.token;
      store.set('tsf.token', r.token, store.get('tsf.remember') !== 'no');
      location.hash = r.role === 'admin' ? '#/admin' : '#/home';
      load();
    }, function (e) { err.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  };

  FORM.reflection = function (form, btn) {
    var v = vals(form), sid = form.getAttribute('data-id');
    v.sessionId = sid;
    run(btn, api('saveReflection', v), 'Saved. Now go and live it out.').then(function (r) {
      upsert(F().reflections, r.reflection); bump();
      var c = form.querySelector('[name=concern]'); if (c && c.value) { c.value = ''; toast('Your concern went privately to the facilitators'); }
      render();
    });
  };
  FORM.mentee = function (form, btn) {
    var v = vals(form), id = form.getAttribute('data-id');
    if (id) { v.id = id; var ex = F().mentees.filter(function (x) { return x.id === id; })[0]; if (ex) v.meetings = ex.meetings || []; }
    run(btn, api('saveMentee', v), 'Saved').then(function (r) { upsert(F().mentees, r.mentee); bump(); closeModal(); render(); });
  };
  FORM.meeting = function (form, btn) {
    var v = vals(form), id = form.getAttribute('data-id');
    var ex = F().mentees.filter(function (x) { return x.id === id; })[0];
    if (!ex) return;
    var payload = Object.assign({}, ex, { meetings: (ex.meetings || []).concat([{ date: v.date, note: v.note }]) });
    run(btn, api('saveMentee', payload), 'Meeting logged').then(function (r) { upsert(F().mentees, r.mentee); bump(); closeModal(); render(); });
  };
  FORM.hi5 = function (form, btn) {
    var v = vals(form), members = [];
    for (var i = 0; i < 5; i++) if (v['mname' + i]) members.push({ name: v['mname' + i], contact: v['mcontact' + i] || '' });
    run(btn, api('saveHi5', { groupName: v.groupName, members: members, peopleGroup: v.peopleGroup, peopleCountry: v.peopleCountry, prayerDay: v.prayerDay, notes: v.notes }), 'Hi 5 group saved').then(function (r) { F().hi5 = r.hi5; bump(); closeModal(); render(); });
  };
  FORM.task = function (form, btn) {
    var v = vals(form), fileInput = form.querySelector('input[type=file]');
    v.taskId = form.getAttribute('data-id');
    var file = fileInput && fileInput.files[0];
    busy(btn, true);
    (file ? readFile(file) : Promise.resolve(null)).then(function (f) {
      if (f) v.file = f;
      busy(btn, false);
      return run(btn, api('saveProgress', v), v.status === 'submitted' ? 'Submitted to your facilitators' : 'Progress saved');
    }, function (e) { busy(btn, false); toast(e.message, true); throw e; }).then(function (r) { upsert(F().progress, r.progress); bump(); closeModal(); render(); });
  };
  FORM.report = function (form, btn, submitter) {
    var q = form.getAttribute('data-q'), v = vals(form), st = F().settings, answers = { ratings: {} };
    st.reportQuestions.forEach(function (x) { answers[x.k] = v[x.k] || ''; });
    st.selfRatings.forEach(function (x) { answers.ratings[x.k] = v['r-' + x.k] ? Number(v['r-' + x.k]) : null; });
    var submit = submitter && submitter.value === 'submit';
    var go = function () {
      run(submitter || btn, api('saveReport', { quarter: q, answers: answers, submit: submit }), submit ? 'Submitted. Your facilitators have been notified.' : 'Draft saved').then(function (r) {
        upsert(F().reports, r.report); bump(); if (S.reportCache) delete S.reportCache['rep:me:' + q]; render();
      });
    };
    if (submit) confirmBox('Submit your ' + q + ' report to your facilitators? You can still edit it until it is evaluated.', 'Submit').then(function (ok) { if (ok) go(); });
    else go();
  };
  FORM.concern = function (form, btn) {
    var v = vals(form);
    if (!v.message) return toast('Please write your message.', true);
    run(btn, api('submitConcern', v), 'Sent privately to the facilitators').then(function (r) { F().concerns.push(r.concern); bump(); render(); });
  };
  FORM.profile = function (form, btn) {
    run(btn, api('saveProfile', vals(form)), 'Your details are saved').then(function (r) { S.data.me = r.me; bump(); render(); });
  };

  // admin forms
  FORM.person = function (form, btn) {
    var v = vals(form); v.id = form.getAttribute('data-id') || undefined;
    run(btn, api('adminSave', { table: 'People', record: v }), 'Saved').then(function (r) { upsert(S.data.people, r.record); bump(); closeModal(); render(); });
  };
  FORM.bulk = function (form, btn) {
    var rows = vals(form).rows.split(/\n/).map(function (line) { var p = line.split(/[,\t;]/).map(function (x) { return x.trim(); }); return { name: p[0], email: p[1], country: p[2], city: p[3], phone: p[4] }; }).filter(function (r) { return r.name || r.email; });
    if (!rows.length) return toast('Please paste at least one line.', true);
    run(btn, api('bulkAddPeople', { rows: rows })).then(function (r) {
      r.added.forEach(function (p) { S.data.people.push(p); }); bump(); closeModal(); render();
      toast(plural(r.added.length, 'person', 'people') + ' added' + (r.skipped.length ? ', ' + r.skipped.length + ' skipped' : ''));
      if (r.skipped.length) openModal('Some lines were skipped', '<ul>' + r.skipped.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>');
    });
  };
  FORM.welcome = function (form, btn) {
    var ids = Array.prototype.filter.call(form.querySelectorAll('input[name=p]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    if (!ids.length) return toast('Please choose at least one person.', true);
    run(btn, api('sendWelcome', { personIds: ids })).then(function (r) { closeModal(); toast(plural(r.sent, 'welcome email') + ' sent'); });
  };
  FORM.feedback = function (form, btn) {
    run(btn, api('feedbackReflection', { id: form.getAttribute('data-id'), feedback: vals(form).feedback }), 'Reply sent').then(function (r) { upsert(S.data.reflections, r.reflection); bump(); closeModal(); render(); });
  };
  FORM.review = function (form, btn, submitter) {
    run(submitter || btn, api('reviewProgress', { id: form.getAttribute('data-id'), status: submitter ? submitter.value : 'approved', feedback: vals(form).feedback }), 'Review saved').then(function (r) { upsert(S.data.progress, r.progress); bump(); closeModal(); render(); });
  };
  FORM['task-edit'] = function (form, btn) {
    var v = vals(form); v.id = form.getAttribute('data-id') || undefined; v.required = true;
    run(btn, api('adminSave', { table: 'Tasks', record: v }), 'Saved').then(function (r) { upsert(S.data.tasks, r.record); bump(); closeModal(); render(); });
  };
  FORM.evaluate = function (form, btn) {
    var v = vals(form), st = S.data.settings, ev = { ratings: {}, strengths: v.strengths, growth: v.growth, comment: v.comment, released: v.released };
    st.evalCriteria.forEach(function (c) { ev.ratings[c.k] = v['e-' + c.k] ? Number(v['e-' + c.k]) : null; });
    var pid = form.getAttribute('data-pid'), q = form.getAttribute('data-q');
    run(btn, api('evaluateReport', { personId: pid, quarter: q, evaluation: ev }), ev.released ? 'Saved and released to the fellow' : 'Evaluation saved').then(function (r) { upsert(S.data.reports, r.report); bump(); if (S.reportCache) delete S.reportCache['rep:' + pid + ':' + q]; render(); });
  };
  FORM.respond = function (form, btn) {
    var v = vals(form);
    run(btn, api('respondConcern', { id: form.getAttribute('data-id'), response: v.response, status: v.status }), 'Saved').then(function (r) { upsert(S.data.concerns, r.concern); bump(); closeModal(); render(); });
  };
  FORM.session = function (form, btn) {
    var v = vals(form); v.id = form.getAttribute('data-id') || undefined;
    run(btn, api('adminSave', { table: 'Sessions', record: v }), 'Saved').then(function (r) { upsert(S.data.sessions, r.record); bump(); closeModal(); render(); });
  };
  FORM.ann = function (form, btn) {
    var v = vals(form); v.id = form.getAttribute('data-id') || undefined;
    run(btn, api('adminSave', { table: 'Announcements', record: v }), 'Published').then(function (r) { upsert(S.data.announcements, r.record); bump(); closeModal(); render(); });
  };
  FORM.res = function (form, btn) {
    var v = vals(form); v.id = form.getAttribute('data-id') || undefined;
    run(btn, api('adminSave', { table: 'Resources', record: v }), 'Saved').then(function (r) { upsert(S.data.resources, r.record); bump(); closeModal(); render(); });
  };
  FORM.settings = function (form, btn) {
    var v = vals(form);
    var changed = SETTINGS_FIELDS.filter(function (f) { return (S.data.allSettings[f[0]] || '') !== v[f[0]]; });
    if (!changed.length) return toast('Nothing has changed.');
    busy(btn, true);
    changed.reduce(function (p, f) { return p.then(function () { return api('adminSave', { table: 'Settings', record: { key: f[0], value: v[f[0]] } }); }); }, Promise.resolve())
      .then(function () { busy(btn, false); toast('Settings saved'); return load(); }, function (e) { busy(btn, false); toast(e.message, true); });
  };

  // Older Safari (before 15.4) has no e.submitter, so remember which submit button was pressed.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button[type=submit]') : null;
    if (b && b.form) b.form._lastSubmitter = b;
  }, true);

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    var fn = FORM[form.getAttribute('data-form')];
    var submitter = e.submitter || form._lastSubmitter || null;
    form._lastSubmitter = null;
    var btn = submitter || form.querySelector('[type=submit]');
    if (fn) fn(form, btn, submitter);
  });

  window.addEventListener('beforeunload', function () { if (S.bibleTimer) { clearTimeout(S.bibleTimer); var d = F(); if (d && d.bible) navigator.sendBeacon && API && navigator.sendBeacon(API, new Blob([JSON.stringify({ action: 'saveBible', token: S.token, days: d.bible.days })], { type: 'text/plain' })); } });

  /* ================================================================ start */
  S.token = store.get('tsf.token');
  S.viewAs = store.sget('tsf.viewAs');
  render();
})();
