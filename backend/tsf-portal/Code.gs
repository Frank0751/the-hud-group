/**
 * The Shadrach Fellowship Portal: backend
 *
 * One Google Apps Script web app, bound to the "TSF Portal" spreadsheet that is owned by
 * engage@thehudgroupglobal.org. The spreadsheet is the database (one tab per table), private
 * files live in a Drive folder under the same account, and every email goes out from it.
 *
 * Everything the portal does arrives here as a POST with a JSON body: { action, token, ... }.
 *   Public actions:  ping, requestCode, verifyCode, sharedReport
 *   Signed in:       bootstrap, signOut, getFile, reportPdf, shareReport, revokeShare
 *   Fellows only:    saveReflection, saveBible, saveMentee, deleteMentee, saveHi5, prayHi5,
 *                    saveProgress, saveReport, submitConcern, saveProfile
 *   Admins only:     markAttendance, adminSave, adminDelete, bulkAddPeople, sendWelcome,
 *                    feedbackReflection, reviewProgress, evaluateReport, respondConcern, refreshViews
 *
 * A fellow can only ever read or change their own records: the server takes the person from the
 * sign-in token, never from the request. Admins can read everyone and view any fellow's portal.
 *
 * Setup: see README.md in this folder.
 */

var CONFIG = {
  OWNER_EMAIL: 'engage@thehudgroupglobal.org',
  NOTIFY_EMAIL: 'engage@thehudgroupglobal.org',
  // People who can sign in as admins straight after setup. Add more from the portal (People tab).
  FIRST_ADMINS: ['engage@thehudgroupglobal.org'],
  SENDER_NAME: 'The Shadrach Fellowship',
  PORTAL_URL: 'https://the-hud-group.vercel.app/portal',
  FOLDER_NAME: 'TSF Portal Files',
  // Optional: the ID of a Drive folder you made yourself. Leave empty to create FOLDER_NAME.
  FOLDER_ID: '',
  TIMEZONE: 'Africa/Accra',
  SESSION_DAYS: 30,
  CODE_MINUTES: 10,
  CODE_ATTEMPTS: 5,
  CODES_PER_HOUR: 5,
  SHARE_DAYS: 30,
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_TEXT: 8000
};

var QUARTERS = [
  { q: 'Q1', name: 'Spiritual Formation', field: 'Bible discovery, purpose and self-awareness', months: [1, 2, 3] },
  { q: 'Q2', name: 'Missional Formation', field: 'Seeded Field: Gospel Plan', months: [4, 5, 6] },
  { q: 'Q3', name: 'Leadership Formation', field: 'Growing Field: Disciple Maturing Plan', months: [7, 8, 9] },
  { q: 'Q4', name: 'Communal Formation', field: 'Harvest Field: New Church Plan', months: [10, 11, 12] }
];

var REPORT_QUESTIONS = [
  { k: 'learning', q: 'What has God been teaching you this quarter?' },
  { k: 'shaping', q: 'Which session, practice or reading shaped you most, and how?' },
  { k: 'iwill', q: 'Which "I will" commitments did you keep, and what changed as a result?' },
  { k: 'disciples', q: 'Your three disciples and your Hi 5 group: what happened this quarter?' },
  { k: 'struggles', q: 'Where did you struggle, and what support would help you?' },
  { k: 'next', q: 'Your goals for next quarter' }
];

var SELF_RATINGS = [
  { k: 'spiritual', l: 'Walk with God' },
  { k: 'character', l: 'Character and emotional health' },
  { k: 'mission', l: 'Making disciples' },
  { k: 'leadership', l: 'Leadership' },
  { k: 'community', l: 'Community and accountability' }
];

var EVAL_CRITERIA = [
  { k: 'attendance', l: 'Attendance and punctuality' },
  { k: 'participation', l: 'Participation in sessions' },
  { k: 'assignments', l: 'Assignments and reading' },
  { k: 'disciplemaking', l: 'Disciple making (the 3 and Hi 5)' },
  { k: 'growth', l: 'Character and spiritual growth' }
];

var ATTENDANCE = ['present', 'late', 'excused', 'absent', 'dropped'];
var ATTENDANCE_LABEL = { present: 'Present', late: 'Late', excused: 'Absent with excuse', absent: 'Absent without excuse', dropped: 'Dropped off' };

/* ------------------------------------------------------------------ tables */

// type hints: j = JSON, n = number, b = boolean. Everything else is text.
var SCHEMA = {
  People: { key: 'id', cols: ['id', 'email', 'name', 'role', 'status', 'country', 'city', 'phone', 'whatsapp', 'cohort', 'bio', 'folderId', 'createdAt', 'updatedAt'] },
  Sessions: { key: 'id', cols: ['id', 'week', 'date', 'title', 'kind', 'passage', 'facilitator', 'link', 'resources', 'notes'], types: { week: 'n' } },
  Attendance: { key: 'id', cols: ['id', 'sessionId', 'personId', 'status', 'note', 'markedBy', 'updatedAt'] },
  Reflections: { key: 'id', cols: ['id', 'personId', 'sessionId', 'review', 'questions', 'iWill', 'scripture', 'shareWith', 'shared', 'feedback', 'feedbackBy', 'createdAt', 'updatedAt'], types: { shared: 'b' } },
  Tasks: { key: 'id', cols: ['id', 'kind', 'title', 'description', 'quarter', 'due', 'resourceId', 'required', 'order'], types: { required: 'b', order: 'n' } },
  Progress: { key: 'id', cols: ['id', 'personId', 'taskId', 'status', 'percent', 'note', 'result', 'fileId', 'fileName', 'feedback', 'reviewedBy', 'updatedAt'], types: { percent: 'n' } },
  Bible: { key: 'personId', cols: ['personId', 'days', 'updatedAt'] },
  Mentees: { key: 'id', cols: ['id', 'personId', 'name', 'contact', 'relationship', 'startedOn', 'status', 'meetings', 'notes', 'updatedAt'], types: { meetings: 'j' } },
  Hi5: { key: 'personId', cols: ['personId', 'groupName', 'members', 'peopleGroup', 'peopleCountry', 'prayerDay', 'prayerLog', 'notes', 'updatedAt'], types: { members: 'j', prayerLog: 'j' } },
  Reports: { key: 'id', cols: ['id', 'personId', 'quarter', 'answers', 'status', 'submittedAt', 'evaluation', 'evaluatedBy', 'evaluatedAt', 'updatedAt'], types: { answers: 'j', evaluation: 'j' } },
  Concerns: { key: 'id', cols: ['id', 'personId', 'ownerHash', 'category', 'subject', 'message', 'anonymous', 'status', 'response', 'respondedBy', 'createdAt', 'updatedAt'], types: { anonymous: 'b' } },
  Announcements: { key: 'id', cols: ['id', 'title', 'body', 'pinned', 'createdAt', 'by'], types: { pinned: 'b' } },
  Resources: { key: 'id', cols: ['id', 'title', 'author', 'kind', 'link', 'description', 'quarter', 'order', 'gift'], types: { order: 'n', gift: 'b' } },
  Settings: { key: 'key', cols: ['key', 'value'] },
  Shares: { key: 'token', cols: ['token', 'personId', 'quarter', 'createdBy', 'createdAt', 'expiresAt', 'revoked'], types: { revoked: 'b' } },
  Auth: { key: 'tokenHash', cols: ['tokenHash', 'personId', 'createdAt', 'expiresAt'] },
  Log: { key: 'at', cols: ['at', 'actor', 'action', 'detail'] }
};

// What admins may create or edit through adminSave, and which fields.
var ADMIN_EDITABLE = {
  People: ['id', 'email', 'name', 'role', 'status', 'country', 'city', 'phone', 'whatsapp', 'cohort', 'bio'],
  Sessions: ['id', 'week', 'date', 'title', 'kind', 'passage', 'facilitator', 'link', 'resources', 'notes'],
  Tasks: ['id', 'kind', 'title', 'description', 'quarter', 'due', 'resourceId', 'required', 'order'],
  Resources: ['id', 'title', 'author', 'kind', 'link', 'description', 'quarter', 'order', 'gift'],
  Announcements: ['id', 'title', 'body', 'pinned'],
  Settings: ['key', 'value']
};

var PUBLIC_SETTINGS = ['cohortName', 'programmeYear', 'startDate', 'endDate', 'bibleStart', 'sessionTime', 'meetingLink', 'welcomeNote', 'whatsappGroup'];

var MEMO = {};

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  var cols = SCHEMA[name].cols;
  if (!sh) {
    sh = ss.insertSheet(name);
    var head = sh.getRange(1, 1, 1, cols.length);
    head.setValues([cols]);
    head.setFontWeight('bold').setBackground('#320c32').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function now_() { return new Date().toISOString(); }
function today_() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'); }

function fromCell_(v, type) {
  if (v === null || v === undefined) v = '';
  if (v instanceof Date) v = v.toISOString();
  if (type === 'j') { if (v === '') return null; try { return JSON.parse(v); } catch (e) { return null; } }
  if (type === 'n') return v === '' ? null : Number(v);
  if (type === 'b') return v === true || v === 'true' || v === 'TRUE' || v === 'yes';
  return String(v);
}

function toCell_(v, type) {
  if (v === null || v === undefined) return '';
  if (type === 'j') return JSON.stringify(v);
  if (type === 'b') return v ? 'true' : 'false';
  var s = String(v);
  // Never let a value become a formula when it lands in the sheet.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function readAll_(name) {
  if (MEMO[name]) return MEMO[name];
  var def = SCHEMA[name];
  var sh = sheet_(name);
  var last = sh.getLastRow();
  var out = [];
  if (last > 1) {
    var values = sh.getRange(2, 1, last - 1, def.cols.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (row[0] === '' || row[0] === null) continue;
      var o = { _row: i + 2 };
      for (var c = 0; c < def.cols.length; c++) o[def.cols[c]] = fromCell_(row[c], def.types && def.types[def.cols[c]]);
      out.push(o);
    }
  }
  MEMO[name] = out;
  return out;
}

function find_(name, keyValue) {
  var key = SCHEMA[name].key;
  var all = readAll_(name);
  for (var i = 0; i < all.length; i++) if (all[i][key] === keyValue) return all[i];
  return null;
}

function where_(name, field, value) {
  return readAll_(name).filter(function (r) { return r[field] === value; });
}

function save_(name, obj) {
  var def = SCHEMA[name];
  var sh = sheet_(name);
  var existing = find_(name, obj[def.key]);
  var merged = {};
  def.cols.forEach(function (c) { merged[c] = (c in obj) ? obj[c] : (existing ? existing[c] : ''); });
  var rowValues = def.cols.map(function (c) { return toCell_(merged[c], def.types && def.types[c]); });
  var rowIndex = existing ? existing._row : Math.max(sh.getLastRow(), 1) + 1;
  var range = sh.getRange(rowIndex, 1, 1, def.cols.length);
  range.setNumberFormat('@');
  range.setValues([rowValues]);
  merged._row = rowIndex;
  var all = readAll_(name);
  if (existing) { for (var i = 0; i < all.length; i++) if (all[i] === existing) all[i] = merged; } else all.push(merged);
  return merged;
}

function remove_(name, keyValue) {
  var row = find_(name, keyValue);
  if (!row) return false;
  sheet_(name).deleteRow(row._row);
  delete MEMO[name];
  return true;
}

function strip_(o) {
  if (!o) return o;
  var c = {};
  Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; });
  return c;
}
function stripAll_(list) { return list.map(strip_); }

function uid_(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

function sha_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

function settings_() {
  if (MEMO._settings) return MEMO._settings;
  var o = {};
  readAll_('Settings').forEach(function (r) { o[r.key] = r.value; });
  MEMO._settings = o;
  return o;
}

function salt_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SALT');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SALT', s); }
  return s;
}

function log_(actor, action, detail) {
  try {
    var sh = sheet_('Log');
    var r = sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, 4);
    r.setNumberFormat('@');
    r.setValues([[now_(), actor || '', action, toCell_(detail || '')]]);
  } catch (e) { /* logging must never break a request */ }
}

/* ------------------------------------------------------------------ input cleaning */

function text_(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return s.slice(0, max || CONFIG.MAX_TEXT);
}
function email_(v) { return text_(v, 200).toLowerCase(); }
function isEmail_(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function isDate_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); }
function oneOf_(v, list, fallback) { return list.indexOf(v) >= 0 ? v : fallback; }

function fail_(msg) { var e = new Error(msg); e.userFacing = true; throw e; }

/* ------------------------------------------------------------------ web app entry */

function doGet() {
  return json_({ ok: true, service: 'TSF Portal', time: now_() });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Bad request.' }); }
  MEMO = {};
  try {
    return json_(route_(body));
  } catch (err) {
    if (err && err.userFacing) return json_({ ok: false, error: err.message });
    log_('', 'error', String(err && err.stack || err).slice(0, 1500));
    return json_({ ok: false, error: 'Something went wrong on our side. Please try again in a moment.' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

var PUBLIC_ACTIONS = { ping: 1, requestCode: 1, verifyCode: 1, sharedReport: 1 };
var FELLOW_ACTIONS = { saveReflection: 1, saveBible: 1, saveMentee: 1, deleteMentee: 1, saveHi5: 1, prayHi5: 1, saveProgress: 1, saveReport: 1, submitConcern: 1, saveProfile: 1 };
var ADMIN_ACTIONS = { markAttendance: 1, adminSave: 1, adminDelete: 1, bulkAddPeople: 1, sendWelcome: 1, feedbackReflection: 1, reviewProgress: 1, evaluateReport: 1, respondConcern: 1, refreshViews: 1 };
var SHARED_ACTIONS = { bootstrap: 1, signOut: 1, getFile: 1, reportData: 1, reportPdf: 1, shareReport: 1, revokeShare: 1 };

function route_(b) {
  var action = String(b.action || '');
  if (PUBLIC_ACTIONS[action]) return ACTIONS[action](b, null);
  if (!FELLOW_ACTIONS[action] && !ADMIN_ACTIONS[action] && !SHARED_ACTIONS[action]) fail_('Unknown request.');
  var me = authed_(b.token);
  if (!me) return { ok: false, error: 'Your session has ended. Please sign in again.', signedOut: true };
  if (FELLOW_ACTIONS[action] && me.role !== 'fellow') fail_('Only fellows can do this.');
  if (ADMIN_ACTIONS[action] && me.role !== 'admin') fail_('Only admins can do this.');
  var needsLock = FELLOW_ACTIONS[action] || ADMIN_ACTIONS[action] || action === 'shareReport' || action === 'revokeShare';
  if (!needsLock) return ACTIONS[action](b, me);
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return ACTIONS[action](b, me); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ sign in */

function authed_(token) {
  if (!token || typeof token !== 'string' || token.length < 40) return null;
  var hash = sha_(token);
  var cache = CacheService.getScriptCache();
  var cached = cache.get('tok:' + hash);
  var personId, expiresAt;
  if (cached) { personId = cached.split('|')[0]; expiresAt = cached.split('|')[1]; }
  else {
    var row = find_('Auth', hash);
    if (!row) return null;
    personId = row.personId; expiresAt = row.expiresAt;
    cache.put('tok:' + hash, personId + '|' + expiresAt, 21600);
  }
  if (!expiresAt || expiresAt < now_()) return null;
  var person = find_('People', personId);
  if (!person || person.status === 'removed') return null;
  return person;
}

var ACTIONS = {};

ACTIONS.ping = function () { return { ok: true, time: now_() }; };

ACTIONS.requestCode = function (b) {
  var email = email_(b.email);
  if (!isEmail_(email)) fail_('Please enter a valid email address.');
  var cache = CacheService.getScriptCache();
  var rateKey = 'rate:' + email;
  var count = Number(cache.get(rateKey) || 0);
  if (count >= CONFIG.CODES_PER_HOUR) fail_('Too many codes requested for this email. Please wait an hour and try again.');
  cache.put(rateKey, String(count + 1), 3600);
  var person = readAll_('People').filter(function (p) { return p.email === email && p.status !== 'removed'; })[0];
  if (person) {
    var code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000);
    while (code.length < 6) code = '0' + code;
    cache.put('code:' + email, JSON.stringify({ h: sha_(code + '|' + email), tries: 0 }), CONFIG.CODE_MINUTES * 60);
    sendMail_(email, 'Your sign-in code: ' + code,
      'Hello ' + firstName_(person.name) + ',',
      ['Here is your code for The Shadrach Fellowship portal:',
       '<div style="font:700 32px/1.2 Arial,sans-serif;letter-spacing:8px;color:#320c32;margin:18px 0">' + code + '</div>',
       'It works once and expires in ' + CONFIG.CODE_MINUTES + ' minutes.',
       'If you did not ask for this code, you can ignore this email. Nobody can sign in without it.']);
  }
  // Same answer either way, so the form never reveals who is on the roster.
  return { ok: true };
};

ACTIONS.verifyCode = function (b) {
  var email = email_(b.email);
  var code = String(b.code || '').replace(/\D/g, '');
  var cache = CacheService.getScriptCache();
  var raw = cache.get('code:' + email);
  if (!raw) fail_('That code has expired. Please ask for a new one.');
  var rec = JSON.parse(raw);
  if (rec.h !== sha_(code + '|' + email)) {
    rec.tries++;
    if (rec.tries >= CONFIG.CODE_ATTEMPTS) { cache.remove('code:' + email); fail_('Too many wrong attempts. Please ask for a new code.'); }
    cache.put('code:' + email, JSON.stringify(rec), CONFIG.CODE_MINUTES * 60);
    fail_('That code is not right. Please check the email and try again.');
  }
  cache.remove('code:' + email);
  var person = readAll_('People').filter(function (p) { return p.email === email && p.status !== 'removed'; })[0];
  if (!person) fail_('This email is not on the fellowship roster.');
  var token = (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    // tidy expired sessions now and then
    readAll_('Auth').filter(function (a) { return a.expiresAt < now_(); }).slice(0, 20).reverse().forEach(function (a) { remove_('Auth', a.tokenHash); });
    save_('Auth', { tokenHash: sha_(token), personId: person.id, createdAt: now_(), expiresAt: new Date(Date.now() + CONFIG.SESSION_DAYS * 864e5).toISOString() });
  } finally { lock.releaseLock(); }
  log_(person.email, 'signIn', person.role);
  return { ok: true, token: token, role: person.role };
};

ACTIONS.signOut = function (b) {
  var hash = sha_(String(b.token));
  CacheService.getScriptCache().remove('tok:' + hash);
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { remove_('Auth', hash); } finally { lock.releaseLock(); }
  return { ok: true };
};

/* ------------------------------------------------------------------ data bundles */

function publicSettings_() {
  var s = settings_();
  var o = {};
  PUBLIC_SETTINGS.forEach(function (k) { o[k] = s[k] || ''; });
  o.today = today_();
  o.quarters = QUARTERS;
  o.reportQuestions = REPORT_QUESTIONS;
  o.selfRatings = SELF_RATINGS;
  o.evalCriteria = EVAL_CRITERIA;
  o.attendanceLabels = ATTENDANCE_LABEL;
  return o;
}

function publicPerson_(p) {
  return { id: p.id, email: p.email, name: p.name, role: p.role, status: p.status, country: p.country, city: p.city, phone: p.phone, whatsapp: p.whatsapp, cohort: p.cohort, bio: p.bio };
}

function fellowBundle_(person) {
  var id = person.id;
  var mine = function (t) { return stripAll_(where_(t, 'personId', id)); };
  var reports = mine('Reports').map(function (r) {
    // A facilitator's evaluation becomes visible to the fellow only once it is released.
    if (!(r.evaluation && r.evaluation.released)) r.evaluation = null;
    return r;
  });
  var ownerHash = sha_(id + salt_());
  var concerns = stripAll_(readAll_('Concerns').filter(function (c) { return c.personId === id || c.ownerHash === ownerHash; }))
    .map(function (c) { delete c.ownerHash; return c; });
  var shares = stripAll_(where_('Shares', 'personId', id).filter(function (s) { return !s.revoked && s.expiresAt > now_(); }));
  var bible = find_('Bible', id);
  var hi5 = find_('Hi5', id);
  return {
    me: publicPerson_(person),
    settings: publicSettings_(),
    sessions: stripAll_(readAll_('Sessions')),
    tasks: stripAll_(readAll_('Tasks')),
    resources: stripAll_(readAll_('Resources')),
    announcements: stripAll_(readAll_('Announcements')),
    attendance: mine('Attendance'),
    reflections: mine('Reflections'),
    progress: mine('Progress'),
    bible: bible ? strip_(bible) : { personId: id, days: '' },
    mentees: mine('Mentees'),
    hi5: hi5 ? strip_(hi5) : null,
    reports: reports,
    concerns: concerns,
    shares: shares,
    pulse: pulse_()
  };
}

// Cohort-wide numbers only, never names, so fellows can see how the group is doing.
function pulse_() {
  var fellows = readAll_('People').filter(function (p) { return p.role === 'fellow' && p.status === 'active'; });
  var today = today_();
  var held = readAll_('Sessions').filter(function (s) { return s.date < today && s.kind !== 'break' && s.kind !== 'induction'; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var last = held[0];
  var out = { fellows: fellows.length, lastSessionId: last ? last.id : '', reflected: 0, attended: 0 };
  if (last) {
    var ids = {};
    fellows.forEach(function (f) { ids[f.id] = 1; });
    out.reflected = readAll_('Reflections').filter(function (r) { return r.sessionId === last.id && ids[r.personId]; }).length;
    out.attended = readAll_('Attendance').filter(function (a) { return a.sessionId === last.id && ids[a.personId] && (a.status === 'present' || a.status === 'late'); }).length;
  }
  return out;
}

function adminBundle_(person) {
  var ownerHashes = {};
  var people = readAll_('People');
  var salt = salt_();
  people.forEach(function (p) { ownerHashes[sha_(p.id + salt)] = p.id; });
  var concerns = stripAll_(readAll_('Concerns')).map(function (c) {
    // Anonymous concerns reach admins without a name attached.
    if (c.anonymous) c.personId = '';
    else if (!c.personId && ownerHashes[c.ownerHash]) c.personId = ownerHashes[c.ownerHash];
    delete c.ownerHash;
    return c;
  });
  return {
    me: publicPerson_(person),
    settings: publicSettings_(),
    allSettings: settings_(),
    people: people.filter(function (p) { return p.status !== 'removed'; }).map(publicPerson_),
    sessions: stripAll_(readAll_('Sessions')),
    tasks: stripAll_(readAll_('Tasks')),
    resources: stripAll_(readAll_('Resources')),
    announcements: stripAll_(readAll_('Announcements')),
    attendance: stripAll_(readAll_('Attendance')),
    reflections: stripAll_(readAll_('Reflections')),
    progress: stripAll_(readAll_('Progress')),
    bible: stripAll_(readAll_('Bible')),
    mentees: stripAll_(readAll_('Mentees')),
    hi5: stripAll_(readAll_('Hi5')),
    reports: stripAll_(readAll_('Reports')),
    concerns: concerns,
    shares: stripAll_(readAll_('Shares').filter(function (s) { return !s.revoked && s.expiresAt > now_(); })),
    sheetUrl: ss_().getUrl()
  };
}

ACTIONS.bootstrap = function (b, me) {
  if (me.role === 'admin' && b.as) {
    var fellow = find_('People', String(b.as));
    if (!fellow || fellow.role !== 'fellow') fail_('That fellow could not be found.');
    var bundle = fellowBundle_(fellow);
    bundle.viewingAs = true;
    bundle.admin = publicPerson_(me);
    // admins see the evaluation whether or not it has been released
    bundle.reports = stripAll_(where_('Reports', 'personId', fellow.id));
    return { ok: true, data: bundle };
  }
  return { ok: true, data: me.role === 'admin' ? adminBundle_(me) : fellowBundle_(me) };
};

/* ------------------------------------------------------------------ fellow actions */

function sessionOrFail_(id) {
  var s = find_('Sessions', String(id || ''));
  if (!s) fail_('That session could not be found.');
  return s;
}

ACTIONS.saveReflection = function (b, me) {
  var s = sessionOrFail_(b.sessionId);
  var id = me.id + '-' + s.id;
  var existing = find_('Reflections', id);
  var rec = {
    id: id, personId: me.id, sessionId: s.id,
    review: text_(b.review), questions: text_(b.questions),
    iWill: text_(b.iWill, 1000), scripture: text_(b.scripture, 300), shareWith: text_(b.shareWith, 300),
    shared: !!b.shared, updatedAt: now_()
  };
  if (!rec.iWill && !rec.review && !rec.questions) fail_('Please write at least your "I will" statement or a short review.');
  if (!existing) rec.createdAt = now_();
  var saved = save_('Reflections', rec);
  if (text_(b.concern)) {
    ACTIONS.submitConcern({ category: 'concern', subject: 'From week ' + (s.week || '') + ' reflection', message: b.concern, anonymous: false }, me);
  }
  tryViews_();
  return { ok: true, reflection: strip_(saved) };
};

ACTIONS.saveBible = function (b, me) {
  var days = String(b.days || '').replace(/[^01]/g, '').slice(0, 366);
  var saved = save_('Bible', { personId: me.id, days: days, updatedAt: now_() });
  return { ok: true, bible: strip_(saved) };
};

ACTIONS.saveMentee = function (b, me) {
  var id = String(b.id || '');
  var existing = id ? find_('Mentees', id) : null;
  if (existing && existing.personId !== me.id) fail_('That record could not be found.');
  if (!existing && where_('Mentees', 'personId', me.id).filter(function (m) { return m.status !== 'ended'; }).length >= 6) fail_('You already have six disciples listed.');
  var name = text_(b.name, 120);
  if (!name) fail_('Please add your disciple\'s name.');
  var meetings = Array.isArray(b.meetings) ? b.meetings.slice(-200).map(function (m) {
    return { date: isDate_(m.date) ? m.date : today_(), note: text_(m.note, 600) };
  }) : (existing ? existing.meetings : []);
  var saved = save_('Mentees', {
    id: existing ? existing.id : uid_('M'), personId: me.id, name: name, contact: text_(b.contact, 160),
    relationship: text_(b.relationship, 160), startedOn: isDate_(b.startedOn) ? b.startedOn : (existing ? existing.startedOn : today_()),
    status: oneOf_(b.status, ['active', 'paused', 'ended'], 'active'), meetings: meetings, notes: text_(b.notes, 2000), updatedAt: now_()
  });
  return { ok: true, mentee: strip_(saved) };
};

ACTIONS.deleteMentee = function (b, me) {
  var m = find_('Mentees', String(b.id || ''));
  if (!m || m.personId !== me.id) fail_('That record could not be found.');
  remove_('Mentees', m.id);
  return { ok: true };
};

ACTIONS.saveHi5 = function (b, me) {
  var existing = find_('Hi5', me.id);
  var members = Array.isArray(b.members) ? b.members.slice(0, 8).map(function (m) {
    return { name: text_(m && m.name, 120), contact: text_(m && m.contact, 160) };
  }).filter(function (m) { return m.name; }) : [];
  var saved = save_('Hi5', {
    personId: me.id, groupName: text_(b.groupName, 120), members: members,
    peopleGroup: text_(b.peopleGroup, 160), peopleCountry: text_(b.peopleCountry, 120),
    prayerDay: text_(b.prayerDay, 60), prayerLog: existing && existing.prayerLog ? existing.prayerLog : [],
    notes: text_(b.notes, 2000), updatedAt: now_()
  });
  return { ok: true, hi5: strip_(saved) };
};

ACTIONS.prayHi5 = function (b, me) {
  var existing = find_('Hi5', me.id);
  if (!existing) fail_('Set up your Hi 5 group first.');
  var log = existing.prayerLog || [];
  var day = isDate_(b.date) ? b.date : today_();
  var i = log.indexOf(day);
  if (b.undo) { if (i >= 0) log.splice(i, 1); } else if (i < 0) log.push(day);
  log.sort();
  var saved = save_('Hi5', { personId: me.id, prayerLog: log.slice(-800), updatedAt: now_() });
  return { ok: true, hi5: strip_(saved) };
};

function fellowFolder_(person) {
  var root = rootFolder_();
  if (person.folderId) {
    try { return DriveApp.getFolderById(person.folderId); } catch (e) { /* recreate below */ }
  }
  var f = root.createFolder(safeName_(person.name || person.email) + ' (' + person.id + ')');
  save_('People', { id: person.id, folderId: f.getId() });
  return f;
}

function rootFolder_() {
  if (CONFIG.FOLDER_ID) return DriveApp.getFolderById(CONFIG.FOLDER_ID);
  var stored = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (stored) { try { return DriveApp.getFolderById(stored); } catch (e) { /* recreate */ } }
  var it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.FOLDER_NAME);
  PropertiesService.getScriptProperties().setProperty('FOLDER_ID', f.getId());
  return f;
}

function safeName_(s) { return String(s || 'file').replace(/[^\w .()-]+/g, '_').slice(0, 80); }

var FILE_TYPES = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain' };

ACTIONS.saveProgress = function (b, me) {
  var task = find_('Tasks', String(b.taskId || ''));
  if (!task) fail_('That assignment could not be found.');
  var id = me.id + '-' + task.id;
  var existing = find_('Progress', id);
  var rec = {
    id: id, personId: me.id, taskId: task.id,
    status: oneOf_(b.status, ['not-started', 'in-progress', 'submitted', 'done'], existing ? existing.status : 'in-progress'),
    percent: Math.max(0, Math.min(100, Number(b.percent) || 0)),
    note: text_(b.note), result: text_(b.result, 500), updatedAt: now_()
  };
  if (existing && existing.status === 'approved') rec.status = 'approved';
  if (b.file && b.file.data) {
    var ext = String(b.file.name || '').split('.').pop().toLowerCase();
    if (!FILE_TYPES[ext]) fail_('Please upload a PDF, Word, PowerPoint, text or image file.');
    var bytes = Utilities.base64Decode(String(b.file.data));
    if (bytes.length > CONFIG.MAX_FILE_BYTES) fail_('Files must be 5 MB or smaller.');
    var folder = fellowFolder_(me);
    var file = folder.createFile(Utilities.newBlob(bytes, FILE_TYPES[ext], safeName_(task.title) + ' - ' + safeName_(me.name) + '.' + ext));
    rec.fileId = file.getId();
    rec.fileName = safeName_(b.file.name);
  }
  var saved = save_('Progress', rec);
  if (rec.status === 'submitted' && (!existing || existing.status !== 'submitted')) {
    notifyTeam_('Assignment submitted: ' + task.title, me.name + ' submitted "' + task.title + '".', 'admin/assignments');
  }
  return { ok: true, progress: strip_(saved) };
};

ACTIONS.saveReport = function (b, me) {
  var quarter = oneOf_(b.quarter, ['Q1', 'Q2', 'Q3', 'Q4'], '');
  if (!quarter) fail_('Please choose a quarter.');
  var id = me.id + '-' + quarter;
  var existing = find_('Reports', id);
  if (existing && existing.evaluation && existing.evaluation.released) fail_('This report has been evaluated and is now locked.');
  var answers = {};
  REPORT_QUESTIONS.forEach(function (q) { answers[q.k] = text_(b.answers && b.answers[q.k], 4000); });
  answers.ratings = {};
  SELF_RATINGS.forEach(function (r) {
    var v = Number(b.answers && b.answers.ratings && b.answers.ratings[r.k]);
    answers.ratings[r.k] = v >= 1 && v <= 5 ? v : null;
  });
  var submit = !!b.submit;
  if (submit) {
    var missing = REPORT_QUESTIONS.filter(function (q) { return !answers[q.k]; });
    if (missing.length) fail_('Please answer every question before you submit. Still empty: ' + missing.map(function (q) { return '"' + q.q + '"'; }).join(', '));
  }
  var rec = { id: id, personId: me.id, quarter: quarter, answers: answers, status: submit ? 'submitted' : (existing && existing.status === 'submitted' ? 'submitted' : 'draft'), updatedAt: now_() };
  if (submit && (!existing || existing.status !== 'submitted')) rec.submittedAt = now_();
  var saved = save_('Reports', rec);
  if (submit && (!existing || existing.status !== 'submitted')) notifyTeam_(quarter + ' report submitted', me.name + ' submitted their ' + quarter + ' report.', 'admin/reports');
  var out = strip_(saved);
  if (!(out.evaluation && out.evaluation.released)) out.evaluation = null;
  return { ok: true, report: out };
};

ACTIONS.submitConcern = function (b, me) {
  var message = text_(b.message, 4000);
  if (!message) fail_('Please write your message.');
  var anonymous = !!b.anonymous;
  var rec = {
    id: uid_('C'), personId: anonymous ? '' : me.id, ownerHash: sha_(me.id + salt_()),
    category: oneOf_(b.category, ['concern', 'complaint', 'prayer', 'suggestion', 'question'], 'concern'),
    subject: text_(b.subject, 160), message: message, anonymous: anonymous, status: 'open',
    createdAt: now_(), updatedAt: now_()
  };
  var saved = save_('Concerns', rec);
  notifyTeam_('New ' + rec.category + (anonymous ? ' (anonymous)' : ' from ' + me.name),
    (rec.subject ? rec.subject + ': ' : '') + message, 'admin/voice');
  var out = strip_(saved); delete out.ownerHash;
  return { ok: true, concern: out };
};

ACTIONS.saveProfile = function (b, me) {
  var saved = save_('People', {
    id: me.id, phone: text_(b.phone, 40), whatsapp: text_(b.whatsapp, 40), city: text_(b.city, 80),
    country: text_(b.country, 80), bio: text_(b.bio, 1000), updatedAt: now_()
  });
  return { ok: true, me: publicPerson_(saved) };
};

/* ------------------------------------------------------------------ files and reports */

ACTIONS.getFile = function (b, me) {
  var p = readAll_('Progress').filter(function (r) { return r.fileId && r.fileId === String(b.fileId || ''); })[0];
  if (!p) fail_('That file could not be found.');
  if (me.role !== 'admin' && p.personId !== me.id) fail_('That file could not be found.');
  var blob = DriveApp.getFileById(p.fileId).getBlob();
  return { ok: true, name: p.fileName || blob.getName(), type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
};

function quarterOf_(date) {
  var m = Number(String(date).slice(5, 7));
  for (var i = 0; i < QUARTERS.length; i++) if (QUARTERS[i].months.indexOf(m) >= 0) return QUARTERS[i];
  return QUARTERS[0];
}

function metrics_(personId, quarter) {
  var q = QUARTERS.filter(function (x) { return x.q === quarter; })[0];
  var today = today_();
  var inQ = function (date) { return date && quarterOf_(date).q === quarter && String(date).slice(0, 4) === (settings_().programmeYear || String(date).slice(0, 4)); };
  var sessions = readAll_('Sessions').filter(function (s) { return s.kind !== 'break' && inQ(s.date); });
  var held = sessions.filter(function (s) { return s.date < today; });
  var heldIds = {}; held.forEach(function (s) { heldIds[s.id] = 1; });
  var att = where_('Attendance', 'personId', personId).filter(function (a) { return heldIds[a.sessionId]; });
  var count = function (st) { return att.filter(function (a) { return a.status === st; }).length; };
  var present = count('present') + count('late');
  var refl = where_('Reflections', 'personId', personId).filter(function (r) { return heldIds[r.sessionId]; });
  var bible = find_('Bible', personId);
  var days = bible ? String(bible.days || '') : '';
  var done = (days.match(/1/g) || []).length;
  var tasks = readAll_('Tasks').filter(function (t) { return t.quarter === quarter && t.kind !== 'report'; });
  var prog = {}; where_('Progress', 'personId', personId).forEach(function (p) { prog[p.taskId] = p; });
  var mentees = where_('Mentees', 'personId', personId).filter(function (m) { return m.status !== 'ended'; });
  var meetingsInQ = 0; mentees.forEach(function (m) { (m.meetings || []).forEach(function (x) { if (inQ(x.date)) meetingsInQ++; }); });
  var hi5 = find_('Hi5', personId);
  // Some assignments are tracked automatically from other parts of the portal, the same way the app shows them.
  var statusOf = function (t) {
    if (t.kind === 'bible') return done >= 365 ? 'done' : done ? 'in-progress' : 'not-started';
    if (t.kind === 'mentees') return mentees.length >= 3 ? 'done' : mentees.length ? 'in-progress' : 'not-started';
    if (t.kind === 'hi5') return hi5 && hi5.members && hi5.members.length >= 5 && hi5.peopleGroup ? 'done' : hi5 ? 'in-progress' : 'not-started';
    return prog[t.id] ? prog[t.id].status : 'not-started';
  };
  var tasksDone = tasks.filter(function (t) { var s = statusOf(t); return s === 'done' || s === 'approved' || s === 'submitted'; }).length;
  var prayers = hi5 && hi5.prayerLog ? hi5.prayerLog.filter(inQ).length : 0;
  return {
    quarter: quarter, name: q ? q.name : '', field: q ? q.field : '',
    sessionsPlanned: sessions.length, sessionsHeld: held.length,
    present: present, late: count('late'), excused: count('excused'), absent: count('absent'),
    attendanceRate: held.length ? Math.round(present / held.length * 100) : null,
    reflections: refl.length, iWills: refl.filter(function (r) { return r.iWill; }).map(function (r) { return r.iWill; }).slice(-6),
    bibleDays: done, biblePercent: Math.round(done / 365 * 100),
    tasksTotal: tasks.length, tasksDone: tasksDone,
    tasks: tasks.map(function (t) { var p = prog[t.id]; return { title: t.title, status: statusOf(t), result: p ? p.result : '' }; }),
    disciples: mentees.length, meetings: meetingsInQ,
    hi5Members: hi5 && hi5.members ? hi5.members.length : 0, peopleGroup: hi5 ? hi5.peopleGroup : '', prayers: prayers
  };
}

function reportData_(personId, quarter, withEvaluation) {
  var person = find_('People', personId);
  if (!person) fail_('That fellow could not be found.');
  var r = find_('Reports', personId + '-' + quarter);
  return {
    fellow: { name: person.name, country: person.country, city: person.city, cohort: person.cohort || settings_().cohortName || '' },
    quarter: quarter,
    cohortName: settings_().cohortName || 'The Shadrach Fellowship',
    metrics: metrics_(personId, quarter),
    answers: r ? r.answers : null,
    status: r ? r.status : 'not-started',
    submittedAt: r ? r.submittedAt : '',
    evaluation: r && r.evaluation && (withEvaluation || r.evaluation.released) ? r.evaluation : null,
    questions: REPORT_QUESTIONS, selfRatings: SELF_RATINGS, evalCriteria: EVAL_CRITERIA,
    generatedAt: today_()
  };
}

function reportTarget_(b, me) {
  var quarter = oneOf_(b.quarter, ['Q1', 'Q2', 'Q3', 'Q4'], '');
  if (!quarter) fail_('Please choose a quarter.');
  var personId = me.role === 'admin' ? String(b.personId || '') : me.id;
  if (!personId) fail_('Please choose a fellow.');
  return { quarter: quarter, personId: personId };
}

ACTIONS.reportData = function (b, me) {
  var t = reportTarget_(b, me);
  return { ok: true, report: reportData_(t.personId, t.quarter, me.role === 'admin') };
};

ACTIONS.reportPdf = function (b, me) {
  var t = reportTarget_(b, me);
  var data = reportData_(t.personId, t.quarter, me.role === 'admin');
  var html = reportHtml_(data);
  var name = 'TSF ' + t.quarter + ' Report - ' + safeName_(data.fellow.name) + '.pdf';
  var pdf = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf').setName(name);
  try {
    // keep a copy in the fellow's private folder so the record is always there
    var person = find_('People', t.personId);
    var folder = fellowFolder_(person);
    var old = folder.getFilesByName(name);
    while (old.hasNext()) old.next().setTrashed(true);
    folder.createFile(pdf);
  } catch (e) { /* the download still works */ }
  return { ok: true, name: name, type: 'application/pdf', data: Utilities.base64Encode(pdf.getBytes()) };
};

ACTIONS.shareReport = function (b, me) {
  var t = reportTarget_(b, me);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var rec = save_('Shares', { token: token, personId: t.personId, quarter: t.quarter, createdBy: me.email, createdAt: now_(), expiresAt: new Date(Date.now() + CONFIG.SHARE_DAYS * 864e5).toISOString(), revoked: false });
  log_(me.email, 'shareReport', t.personId + ' ' + t.quarter);
  return { ok: true, share: strip_(rec), url: CONFIG.PORTAL_URL + '#/shared/' + token };
};

ACTIONS.revokeShare = function (b, me) {
  var s = find_('Shares', String(b.shareToken || ''));
  if (!s || (me.role !== 'admin' && s.personId !== me.id)) fail_('That link could not be found.');
  save_('Shares', { token: s.token, revoked: true });
  return { ok: true };
};

ACTIONS.sharedReport = function (b) {
  var s = find_('Shares', String(b.shareToken || ''));
  if (!s || s.revoked || s.expiresAt < now_()) fail_('This link has expired or been withdrawn. Please ask for a new one.');
  var data = reportData_(s.personId, s.quarter, false);
  data.expiresAt = s.expiresAt;
  return { ok: true, report: data };
};

function esc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function para_(s) { return esc_(s).replace(/\n/g, '<br>'); }

function reportHtml_(d) {
  var m = d.metrics;
  var stat = function (label, value) {
    return '<td style="padding:10px 12px;border:1px solid #e8dde8;text-align:center"><div style="font:bold 20px Georgia,serif;color:#320c32">' + esc_(value) + '</div><div style="font:10px Arial,sans-serif;color:#6b5a68;text-transform:uppercase;letter-spacing:1px">' + esc_(label) + '</div></td>';
  };
  var h = [];
  h.push('<!DOCTYPE html><html><head><meta charset="utf-8"><style>body,table,td,p,div{font-family:Arial,sans-serif;font-size:12px}</style></head><body style="font-family:Arial,sans-serif;color:#1a1420;font-size:12px;line-height:1.5">');
  h.push('<table width="100%" style="border-collapse:collapse;background:#320c32;color:#ffffff"><tr><td style="padding:22px 24px">');
  h.push('<div style="font:bold 10px Arial,sans-serif;letter-spacing:2px;color:#ffb866;text-transform:uppercase">' + esc_(d.cohortName) + ' &middot; ' + esc_(d.quarter) + ' report</div>');
  h.push('<div style="font:bold 26px Georgia,serif;margin-top:6px">' + esc_(d.fellow.name) + '</div>');
  h.push('<div style="font:13px Arial,sans-serif;color:#e9d6e9;margin-top:4px">' + esc_(m.name) + ': ' + esc_(m.field) + (d.fellow.country ? ' &middot; ' + esc_([d.fellow.city, d.fellow.country].filter(String).join(', ')) : '') + '</div>');
  h.push('</td></tr></table>');
  h.push('<table width="100%" style="border-collapse:collapse;margin-top:14px"><tr>');
  h.push(stat('Attendance', m.attendanceRate === null ? 'n/a' : m.attendanceRate + '%'));
  h.push(stat('Sessions attended', m.present + ' of ' + m.sessionsHeld));
  h.push(stat('Weekly reflections', m.reflections));
  h.push(stat('Bible in a year', m.biblePercent + '%'));
  h.push(stat('Assignments done', m.tasksDone + ' of ' + m.tasksTotal));
  h.push('</tr><tr>');
  h.push(stat('Disciples', m.disciples));
  h.push(stat('Discipleship meetings', m.meetings));
  h.push(stat('Hi 5 members', m.hi5Members));
  h.push(stat('Days prayed (Hi 5)', m.prayers));
  h.push(stat('Excused absences', m.excused));
  h.push('</tr></table>');
  if (m.peopleGroup) h.push('<p style="margin:10px 0 0;color:#6b5a68">Hi 5 adopted people group: <b style="color:#1a1420">' + esc_(m.peopleGroup) + '</b></p>');
  var heading = function (t) { h.push('<div style="font:bold 15px Georgia,serif;color:#541854;margin:22px 0 8px;border-bottom:2px solid #ffb866;padding-bottom:4px">' + esc_(t) + '</div>'); };
  if (m.tasks.length) {
    heading('Assignments this quarter');
    h.push('<table width="100%" style="border-collapse:collapse">');
    m.tasks.forEach(function (t) {
      h.push('<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">' + esc_(t.title) + (t.result ? ' <span style="color:#6b5a68">(' + esc_(t.result) + ')</span>' : '') + '</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;color:#6b5a68">' + esc_(statusLabel_(t.status)) + '</td></tr>');
    });
    h.push('</table>');
  }
  if (m.iWills.length) {
    heading('Recent "I will" statements');
    m.iWills.forEach(function (w) { h.push('<p style="margin:0 0 6px;padding-left:10px;border-left:3px solid #fc9018">' + para_(w) + '</p>'); });
  }
  heading('Self report');
  if (!d.answers) h.push('<p style="color:#6b5a68">Not written yet.</p>');
  else {
    d.questions.forEach(function (q) {
      h.push('<p style="margin:12px 0 2px;font-weight:bold;color:#320c32">' + esc_(q.q) + '</p><p style="margin:0">' + (d.answers[q.k] ? para_(d.answers[q.k]) : '<span style="color:#6b5a68">No answer</span>') + '</p>');
    });
    var r = d.answers.ratings || {};
    h.push('<table style="border-collapse:collapse;margin-top:12px">');
    d.selfRatings.forEach(function (s) { h.push('<tr><td style="padding:3px 14px 3px 0">' + esc_(s.l) + '</td><td style="color:#df6e0c;font-weight:bold">' + (r[s.k] ? r[s.k] + ' / 5' : 'not rated') + '</td></tr>'); });
    h.push('</table>');
  }
  if (d.evaluation) {
    var e = d.evaluation;
    heading('Facilitator evaluation');
    h.push('<table style="border-collapse:collapse">');
    d.evalCriteria.forEach(function (c) { h.push('<tr><td style="padding:3px 14px 3px 0">' + esc_(c.l) + '</td><td style="color:#541854;font-weight:bold">' + (e.ratings && e.ratings[c.k] ? e.ratings[c.k] + ' / 5' : 'not rated') + '</td></tr>'); });
    h.push('</table>');
    [['Strengths', e.strengths], ['Areas to grow', e.growth], ['Comment', e.comment]].forEach(function (x) {
      if (x[1]) h.push('<p style="margin:12px 0 2px;font-weight:bold;color:#320c32">' + x[0] + '</p><p style="margin:0">' + para_(x[1]) + '</p>');
    });
    if (e.by) h.push('<p style="margin-top:10px;color:#6b5a68">Evaluated by ' + esc_(e.by) + (e.at ? ' on ' + esc_(String(e.at).slice(0, 10)) : '') + '</p>');
  }
  h.push('<p style="margin-top:28px;font-size:10px;color:#6b5a68;border-top:1px solid #eee;padding-top:8px">The Shadrach Fellowship, The HuD Group Global. Generated ' + esc_(d.generatedAt) + '. Private: shared by or with the permission of the fellow.</p>');
  h.push('</body></html>');
  return h.join('');
}

function statusLabel_(s) {
  return { 'not-started': 'Not started', 'in-progress': 'In progress', submitted: 'Submitted', done: 'Done', approved: 'Approved', returned: 'Needs work' }[s] || s;
}

/* ------------------------------------------------------------------ admin actions */

ACTIONS.markAttendance = function (b, me) {
  var s = sessionOrFail_(b.sessionId);
  var marks = b.marks || {};
  var count = 0;
  Object.keys(marks).forEach(function (pid) {
    var person = find_('People', pid);
    if (!person || person.role !== 'fellow') return;
    var id = pid + '-' + s.id;
    var st = String(marks[pid] || '');
    if (!st) { if (remove_('Attendance', id)) count++; return; }
    if (ATTENDANCE.indexOf(st) < 0) return;
    save_('Attendance', { id: id, sessionId: s.id, personId: pid, status: st, markedBy: me.email, updatedAt: now_() });
    count++;
  });
  log_(me.email, 'markAttendance', s.id + ' (' + count + ')');
  tryViews_();
  return { ok: true, attendance: stripAll_(where_('Attendance', 'sessionId', s.id)) };
};

ACTIONS.adminSave = function (b, me) {
  var table = String(b.table || '');
  var allowed = ADMIN_EDITABLE[table];
  if (!allowed) fail_('That cannot be edited here.');
  var r = b.record || {};
  var rec = {};
  allowed.forEach(function (k) { if (k in r) rec[k] = r[k]; });
  var def = SCHEMA[table];
  var key = def.key;
  if (table === 'Settings') {
    if (!rec.key) fail_('Setting name missing.');
    rec.key = text_(rec.key, 60); rec.value = text_(rec.value, 4000);
  } else {
    Object.keys(rec).forEach(function (k) {
      var type = def.types && def.types[k];
      if (type === 'n') rec[k] = rec[k] === '' || rec[k] === null ? '' : Number(rec[k]);
      else if (type === 'b') rec[k] = !!rec[k];
      else rec[k] = text_(rec[k], k === 'body' || k === 'description' || k === 'notes' ? 6000 : 600);
    });
    if (!rec[key]) rec[key] = uid_(table.charAt(0));
  }
  if (table === 'People') {
    var before = find_('People', rec.id);
    if (before) allowed.forEach(function (k) { if (!(k in rec)) rec[k] = before[k]; });
    rec.email = email_(rec.email);
    if (!isEmail_(rec.email)) fail_('Please enter a valid email address.');
    if (!rec.name) fail_('Please enter a name.');
    var clash = readAll_('People').filter(function (p) { return p.email === rec.email && p.id !== rec.id && p.status !== 'removed'; })[0];
    if (clash) fail_('Someone with that email is already on the roster.');
    rec.role = oneOf_(rec.role, ['fellow', 'admin'], 'fellow');
    rec.status = oneOf_(rec.status, ['active', 'paused', 'dropped', 'graduated'], 'active');
    if (!find_('People', rec.id)) rec.createdAt = now_();
    rec.updatedAt = now_();
    if (rec.id === me.id && rec.role !== 'admin') fail_('You cannot remove your own admin access.');
  }
  if (table === 'Sessions' && rec.date && !isDate_(rec.date)) fail_('Please use a date like 2027-01-08.');
  if (table === 'Tasks' && rec.due && !isDate_(rec.due)) fail_('Please use a date like 2027-01-08.');
  if (table === 'Announcements') { rec.by = me.name; if (!find_('Announcements', rec.id)) rec.createdAt = now_(); }
  var saved = save_(table, rec);
  if (table === 'Settings') delete MEMO._settings;
  log_(me.email, 'save ' + table, saved[key]);
  if (table === 'Sessions' || table === 'People') tryViews_();
  var out = strip_(saved);
  if (table === 'People') out = publicPerson_(saved);
  return { ok: true, record: out };
};

ACTIONS.adminDelete = function (b, me) {
  var table = String(b.table || '');
  if (['People', 'Sessions', 'Tasks', 'Resources', 'Announcements'].indexOf(table) < 0) fail_('That cannot be deleted here.');
  var id = String(b.id || '');
  if (table === 'People') {
    if (id === me.id) fail_('You cannot remove yourself.');
    // People are never hard deleted, so their history stays intact.
    var p = find_('People', id);
    if (!p) fail_('Not found.');
    save_('People', { id: id, status: 'removed', updatedAt: now_() });
    readAll_('Auth').filter(function (a) { return a.personId === id; }).forEach(function (a) { remove_('Auth', a.tokenHash); CacheService.getScriptCache().remove('tok:' + a.tokenHash); });
  } else if (!remove_(table, id)) fail_('Not found.');
  log_(me.email, 'delete ' + table, id);
  return { ok: true };
};

ACTIONS.bulkAddPeople = function (b, me) {
  var rows = Array.isArray(b.rows) ? b.rows.slice(0, 200) : [];
  var added = [], skipped = [];
  rows.forEach(function (r) {
    var email = email_(r.email), name = text_(r.name, 120);
    if (!name || !isEmail_(email)) { skipped.push((name || email || '?') + ': missing name or email'); return; }
    if (readAll_('People').some(function (p) { return p.email === email && p.status !== 'removed'; })) { skipped.push(name + ': already on the roster'); return; }
    var saved = save_('People', { id: uid_('P'), email: email, name: name, role: oneOf_(r.role, ['fellow', 'admin'], 'fellow'), status: 'active', country: text_(r.country, 80), city: text_(r.city, 80), phone: text_(r.phone, 40), whatsapp: text_(r.whatsapp, 40), cohort: text_(r.cohort, 60) || settings_().cohortName || '', createdAt: now_(), updatedAt: now_() });
    added.push(publicPerson_(saved));
  });
  log_(me.email, 'bulkAddPeople', added.length + ' added');
  tryViews_();
  return { ok: true, added: added, skipped: skipped };
};

ACTIONS.sendWelcome = function (b, me) {
  var ids = Array.isArray(b.personIds) ? b.personIds : [];
  var sent = 0;
  ids.slice(0, 100).forEach(function (id) {
    var p = find_('People', String(id));
    if (!p || p.status === 'removed') return;
    sendMail_(p.email, 'Your Shadrach Fellowship portal is ready',
      'Welcome, ' + firstName_(p.name) + '!',
      [p.role === 'admin'
        ? 'You have admin access to The Shadrach Fellowship portal, where the whole cohort is managed in one place.'
        : 'Your personal portal for The Shadrach Fellowship is ready. It holds your journey for the year: weekly sessions and reflections, Bible in One Year, your three disciples and Hi 5 group, assignments, assessments and quarterly reports.',
       'Sign in with this email address (' + esc_(p.email) + '). We will send you a one-time code each time, so there is no password to remember.',
       button_('Open my portal', CONFIG.PORTAL_URL)]);
    sent++;
  });
  log_(me.email, 'sendWelcome', sent);
  return { ok: true, sent: sent };
};

ACTIONS.feedbackReflection = function (b, me) {
  var r = find_('Reflections', String(b.id || ''));
  if (!r) fail_('That reflection could not be found.');
  var saved = save_('Reflections', { id: r.id, feedback: text_(b.feedback, 2000), feedbackBy: me.name });
  if (text_(b.feedback)) {
    var p = find_('People', r.personId);
    var s = find_('Sessions', r.sessionId);
    if (p && b.notify !== false) sendMail_(p.email, 'A note on your reflection', 'Hello ' + firstName_(p.name) + ',',
      [esc_(me.name) + ' replied to your reflection on ' + esc_(s ? s.title : 'a session') + ':', '<blockquote style="border-left:3px solid #fc9018;margin:12px 0;padding:4px 12px">' + para_(b.feedback) + '</blockquote>', button_('Open my portal', CONFIG.PORTAL_URL + '#/session/' + r.sessionId)]);
  }
  return { ok: true, reflection: strip_(saved) };
};

ACTIONS.reviewProgress = function (b, me) {
  var p = find_('Progress', String(b.id || ''));
  if (!p) fail_('That submission could not be found.');
  var status = oneOf_(b.status, ['approved', 'returned', 'submitted', 'in-progress', 'done'], p.status);
  var saved = save_('Progress', { id: p.id, status: status, feedback: text_(b.feedback, 2000), reviewedBy: me.name, updatedAt: now_() });
  var person = find_('People', p.personId), task = find_('Tasks', p.taskId);
  if (person && (status === 'approved' || status === 'returned')) {
    sendMail_(person.email, (status === 'approved' ? 'Approved: ' : 'Please revisit: ') + (task ? task.title : 'your assignment'), 'Hello ' + firstName_(person.name) + ',',
      [status === 'approved' ? 'Your work on <b>' + esc_(task ? task.title : '') + '</b> has been approved. Well done.' : 'Your facilitator has asked you to take another look at <b>' + esc_(task ? task.title : '') + '</b>.',
       b.feedback ? '<blockquote style="border-left:3px solid #fc9018;margin:12px 0;padding:4px 12px">' + para_(b.feedback) + '</blockquote>' : '', button_('Open my portal', CONFIG.PORTAL_URL + '#/assignments')]);
  }
  return { ok: true, progress: strip_(saved) };
};

ACTIONS.evaluateReport = function (b, me) {
  var quarter = oneOf_(b.quarter, ['Q1', 'Q2', 'Q3', 'Q4'], '');
  var person = find_('People', String(b.personId || ''));
  if (!quarter || !person) fail_('Please choose a fellow and a quarter.');
  var id = person.id + '-' + quarter;
  var existing = find_('Reports', id);
  var e = b.evaluation || {};
  var ev = { ratings: {}, strengths: text_(e.strengths, 3000), growth: text_(e.growth, 3000), comment: text_(e.comment, 3000), released: !!e.released, by: me.name, at: now_() };
  EVAL_CRITERIA.forEach(function (c) { var v = Number(e.ratings && e.ratings[c.k]); ev.ratings[c.k] = v >= 1 && v <= 5 ? v : null; });
  var wasReleased = existing && existing.evaluation && existing.evaluation.released;
  var saved = save_('Reports', { id: id, personId: person.id, quarter: quarter, status: existing ? existing.status : 'not-submitted', answers: existing ? existing.answers : null, evaluation: ev, evaluatedBy: me.name, evaluatedAt: now_(), updatedAt: now_() });
  if (ev.released && !wasReleased) {
    sendMail_(person.email, 'Your ' + quarter + ' report has been evaluated', 'Hello ' + firstName_(person.name) + ',',
      ['Your facilitators have finished your ' + quarter + ' evaluation. You can read it, download it as a PDF and share it from your portal.', button_('Read my evaluation', CONFIG.PORTAL_URL + '#/reports/' + quarter)]);
  }
  return { ok: true, report: strip_(saved) };
};

ACTIONS.respondConcern = function (b, me) {
  var c = find_('Concerns', String(b.id || ''));
  if (!c) fail_('That message could not be found.');
  var response = text_(b.response, 4000);
  var saved = save_('Concerns', { id: c.id, status: oneOf_(b.status, ['open', 'in-progress', 'resolved'], c.status), response: response, respondedBy: me.name, updatedAt: now_() });
  if (response && response !== c.response) {
    var person = c.personId ? find_('People', c.personId) : null;
    if (!person) {
      var salt = salt_();
      person = readAll_('People').filter(function (p) { return sha_(p.id + salt) === c.ownerHash; })[0] || null;
    }
    if (person) sendMail_(person.email, 'A reply to your ' + c.category, 'Hello ' + firstName_(person.name) + ',',
      ['There is a reply to what you shared' + (c.subject ? ' ("' + esc_(c.subject) + '")' : '') + ':', '<blockquote style="border-left:3px solid #fc9018;margin:12px 0;padding:4px 12px">' + para_(response) + '</blockquote>', button_('Open my portal', CONFIG.PORTAL_URL + '#/voice')]);
  }
  var out = strip_(saved);
  if (out.anonymous) out.personId = '';
  delete out.ownerHash;
  return { ok: true, concern: out };
};

ACTIONS.refreshViews = function () { refreshViews_(); return { ok: true }; };

/* ------------------------------------------------------------------ readable views in the sheet */

function tryViews_() { try { refreshViews_(); } catch (e) { log_('', 'views error', String(e)); } }

// Two read-only tabs laid out like the sheets the team already uses:
// "Attendance Grid" (fellows down, weeks across) and "DBS Action Points" (one row per reflection).
function refreshViews_() {
  var ss = ss_();
  var fellows = readAll_('People').filter(function (p) { return p.role === 'fellow' && p.status !== 'removed'; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  var sessions = readAll_('Sessions').filter(function (s) { return s.kind !== 'break'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var att = {};
  readAll_('Attendance').forEach(function (a) { att[a.personId + '|' + a.sessionId] = ATTENDANCE_LABEL[a.status] || a.status; });
  var grid = [['Fellow'].concat(sessions.map(function (s) { return 'Week ' + (s.week || '') + ' - ' + s.date; }))];
  fellows.forEach(function (f) { grid.push([f.name].concat(sessions.map(function (s) { return att[f.id + '|' + s.id] || ''; }))); });
  writeView_(ss, 'Attendance Grid', grid);

  var byId = {}; readAll_('Sessions').forEach(function (s) { byId[s.id] = s; });
  var names = {}; fellows.forEach(function (f) { names[f.id] = f.name; });
  var dbs = [['Date', 'Week', 'Session', 'Passage', 'Name', '"I WILL" Statement', 'Scripture', 'Who will you share this with?', 'Review and notes', 'Questions', 'Facilitator feedback']];
  readAll_('Reflections').slice().sort(function (a, b) {
    var da = (byId[a.sessionId] || {}).date || '', db = (byId[b.sessionId] || {}).date || '';
    return da === db ? ((names[a.personId] || '') < (names[b.personId] || '') ? -1 : 1) : (da < db ? -1 : 1);
  }).forEach(function (r) {
    var s = byId[r.sessionId] || {};
    dbs.push([s.date || '', s.week || '', s.title || '', s.passage || '', names[r.personId] || '', r.iWill, r.scripture, r.shareWith, r.review, r.questions, r.feedback]);
  });
  writeView_(ss, 'DBS Action Points', dbs);
}

function writeView_(ss, name, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
  var data = rows.map(function (r) { var c = r.map(function (v) { return toCell_(v); }); while (c.length < width) c.push(''); return c; });
  var range = sh.getRange(1, 1, data.length, width);
  range.setNumberFormat('@');
  range.setValues(data);
  sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#320c32').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
}

/* ------------------------------------------------------------------ email */

function firstName_(name) { return String(name || '').trim().split(/\s+/)[0] || 'friend'; }

function button_(label, url) {
  return '<a href="' + esc_(url) + '" style="display:inline-block;background:#ffb866;color:#320c32;font:bold 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:999px;margin-top:6px">' + esc_(label) + '</a>';
}

function sendMail_(to, subject, greeting, paragraphs) {
  var body = '<div style="background:#fbf4fb;padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eadcea">' +
    '<div style="background:#320c32;padding:18px 24px;color:#ffffff;font:bold 13px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase">The Shadrach Fellowship</div>' +
    '<div style="padding:24px;font:15px/1.6 Arial,sans-serif;color:#1a1420"><p style="margin:0 0 14px">' + esc_(greeting) + '</p>' +
    paragraphs.filter(String).map(function (p) { return /^<(div|blockquote|a|table)/.test(p) ? p : '<p style="margin:0 0 14px">' + p + '</p>'; }).join('') +
    '</div><div style="padding:14px 24px;background:#fbf4fb;font:12px Arial,sans-serif;color:#6b5a68">The HuD Group Global &middot; To inspire...totally</div></div></div>';
  var plain = String(greeting) + '\n\n' + paragraphs.join('\n\n').replace(/<[^>]+>/g, '').replace(/&middot;/g, '.').replace(/&amp;/g, '&');
  MailApp.sendEmail({ to: to, subject: subject, body: plain, htmlBody: body, name: CONFIG.SENDER_NAME, replyTo: CONFIG.NOTIFY_EMAIL });
}

function notifyTeam_(subject, message, route) {
  try {
    sendMail_(CONFIG.NOTIFY_EMAIL, '[TSF Portal] ' + subject, 'Hello team,', [para_(message), button_('Open the admin portal', CONFIG.PORTAL_URL + '#/' + route)]);
  } catch (e) { log_('', 'notify error', String(e)); }
}

/* ------------------------------------------------------------------ reminders (time triggers) */

function remindersOn_() { return String(settings_().remindersOn || 'yes') !== 'no'; }

function activeFellows_() { return readAll_('People').filter(function (p) { return p.role === 'fellow' && p.status === 'active'; }); }

function addDays_(isoDate, n) {
  var d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Runs every Thursday: tells each active fellow about tomorrow's session.
function sessionReminder() {
  MEMO = {};
  if (!remindersOn_()) return;
  var tomorrow = addDays_(today_(), 1);
  var s = readAll_('Sessions').filter(function (x) { return x.date === tomorrow && x.kind !== 'break'; })[0];
  if (!s) return;
  var set = settings_();
  activeFellows_().forEach(function (p) {
    sendMail_(p.email, 'Tomorrow: ' + s.title, 'Hello ' + firstName_(p.name) + ',',
      ['Our next session is tomorrow' + (set.sessionTime ? ' (' + esc_(set.sessionTime) + ')' : '') + ': <b>' + esc_(s.title) + '</b>.',
       s.passage ? 'Discovery Bible Study passage: <b>' + esc_(s.passage) + '</b>. Read it before we meet.' : '',
       (s.link || set.meetingLink) ? button_('Join the session', s.link || set.meetingLink) : button_('Open my portal', CONFIG.PORTAL_URL)]);
  });
}

// Runs every Saturday: nudges fellows who have not written their reflection for yesterday's session.
function reflectionNudge() {
  MEMO = {};
  if (!remindersOn_()) return;
  var yesterday = addDays_(today_(), -1);
  var s = readAll_('Sessions').filter(function (x) { return x.date === yesterday && x.kind !== 'break'; })[0];
  if (!s) return;
  var done = {}; where_('Reflections', 'sessionId', s.id).forEach(function (r) { done[r.personId] = 1; });
  activeFellows_().filter(function (p) { return !done[p.id]; }).forEach(function (p) {
    sendMail_(p.email, 'Your "I will" for this week', 'Hello ' + firstName_(p.name) + ',',
      ['What is God asking of you after yesterday\'s session, <b>' + esc_(s.title) + '</b>? Take two minutes to write your review, your "I will" statement, your Scripture and who you will share it with.',
       button_('Write my reflection', CONFIG.PORTAL_URL + '#/session/' + s.id)]);
  });
}

// Runs every Monday: a short health check for the team.
function adminDigest() {
  MEMO = {};
  var fellows = activeFellows_();
  var flags = cohortFlags_(fellows);
  var openConcerns = readAll_('Concerns').filter(function (c) { return c.status !== 'resolved'; }).length;
  var pending = readAll_('Progress').filter(function (p) { return p.status === 'submitted'; }).length;
  var reports = readAll_('Reports').filter(function (r) { return r.status === 'submitted' && !(r.evaluation && r.evaluation.released); }).length;
  var lines = [
    '<b>' + fellows.length + '</b> active fellows.',
    '<b>' + openConcerns + '</b> open concerns, <b>' + pending + '</b> assignments waiting for review, <b>' + reports + '</b> quarterly reports waiting for evaluation.'
  ];
  if (flags.length) lines.push('Fellows who may need a call this week:<br>' + flags.map(function (f) { return '&middot; ' + esc_(f.name) + ': ' + esc_(f.reasons.join(', ')); }).join('<br>'));
  else lines.push('No one is flagged this week. Thank God.');
  lines.push(button_('Open the admin portal', CONFIG.PORTAL_URL + '#/admin'));
  sendMail_(CONFIG.NOTIFY_EMAIL, '[TSF Portal] Weekly cohort check', 'Hello team,', lines);
}

function cohortFlags_(fellows) {
  var today = today_();
  var held = readAll_('Sessions').filter(function (s) { return s.date < today && s.kind !== 'break' && s.kind !== 'induction'; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var att = {}; readAll_('Attendance').forEach(function (a) { att[a.personId + '|' + a.sessionId] = a.status; });
  var refl = {}; readAll_('Reflections').forEach(function (r) { refl[r.personId + '|' + r.sessionId] = 1; });
  var out = [];
  fellows.forEach(function (f) {
    var reasons = [];
    var lastTwo = held.slice(0, 2);
    if (lastTwo.length === 2 && lastTwo.every(function (s) { return att[f.id + '|' + s.id] === 'absent'; })) reasons.push('missed the last two sessions without excuse');
    var lastThree = held.slice(0, 3);
    if (lastThree.length === 3 && lastThree.every(function (s) { return !refl[f.id + '|' + s.id]; })) reasons.push('no reflection in three weeks');
    if (reasons.length) out.push({ name: f.name, reasons: reasons });
  });
  return out;
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['sessionReminder', 'reflectionNudge', 'adminDigest'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sessionReminder').timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(10).create();
  ScriptApp.newTrigger('reflectionNudge').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(10).create();
  ScriptApp.newTrigger('adminDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('Reminders scheduled: Thursday session reminder, Saturday reflection nudge, Monday team digest.');
}

/* ------------------------------------------------------------------ setup and seed data */

// Run once from the Apps Script editor (signed in as engage@thehudgroupglobal.org).
function setup() {
  var me = Session.getEffectiveUser().getEmail();
  if (CONFIG.OWNER_EMAIL && me && me.toLowerCase() !== CONFIG.OWNER_EMAIL) {
    throw new Error('Please run setup while signed in as ' + CONFIG.OWNER_EMAIL + ' (you are signed in as ' + me + ').');
  }
  MEMO = {};
  Object.keys(SCHEMA).forEach(function (t) { sheet_(t); });
  var first = ss_().getSheetByName('Sheet1');
  if (first && ss_().getSheets().length > 1 && first.getLastRow() === 0) ss_().deleteSheet(first);
  salt_();
  rootFolder_();
  if (!readAll_('Settings').length) seedSettings_();
  if (!readAll_('Sessions').length) seedSessions_();
  if (!readAll_('Resources').length) seedResources_();
  if (!readAll_('Tasks').length) seedTasks_();
  CONFIG.FIRST_ADMINS.forEach(function (email) {
    email = email.toLowerCase();
    if (!readAll_('People').some(function (p) { return p.email === email; })) {
      save_('People', { id: uid_('P'), email: email, name: email === CONFIG.OWNER_EMAIL ? 'TSF Admin' : email, role: 'admin', status: 'active', createdAt: now_(), updatedAt: now_() });
    }
  });
  refreshViews_();
  Logger.log('Setup complete. Tabs, starter roadmap, assignments and resources are in place. Next: deploy as a web app (see README).');
}

function seedSettings_() {
  [['cohortName', 'TSF 2027'], ['programmeYear', '2027'], ['startDate', '2027-01-01'], ['endDate', '2027-12-31'],
   ['bibleStart', '2027-01-01'], ['sessionTime', 'Fridays, 7:00 PM GMT'], ['meetingLink', ''], ['whatsappGroup', ''],
   ['welcomeNote', 'Welcome to your year of formation. Everything for your journey lives here: sessions, reflections, your disciples, readings and reports.'],
   ['remindersOn', 'yes']].forEach(function (kv) { save_('Settings', { key: kv[0], value: kv[1] }); });
}

// Starter roadmap for 2027, carried over from the 2025/2026 roadmap with this year's change
// (Making Ends Meet comes after MLM and before the Discovery Bible Community review).
// Dates and passages are a draft: edit them in the portal under Admin > Roadmap.
function seedSessions_() {
  var plan = [
    ['DBS 1: Bible Discovery', 'Genesis 12:1-5'], ['DBS 2: Bible Discovery', 'Mark 4:3-20'], ['DBS 3: Bible Discovery', 'Luke 10:1-9'],
    ['Purpose Statement 1', 'Acts 2:37-47'], ['Purpose Statement 2', ''], ['Purpose Statement 3 (assessments)', 'Luke 4:14-30'],
    ['Goal Setting: introduction', 'Philippians 3:10-21'], ['Goal Sharing', ''], ['WWTD 1: God-awareness', ''],
    ['WWTD 2: God-awareness', '2 Corinthians 13:14'], ['WWTD 3: God-awareness', 'John 1:1-17'], ['DISC 1: introduction (self-awareness)', 'John 10:14-30'],
    ['Good Friday break', '', 'break'], ['DISC 2: sharing results', 'Ephesians 1'],
    ['Spiritual Gifts 1', 'Psalm 139:1-18'], ['Spiritual Gifts 2', ''], ['Disciple Ship 1', '2 Corinthians 13:1-10'],
    ['Disciple Ship 2', ''], ['Disciple Ship 3', '1 Corinthians 12:1-11'], ['Disciple Ship 4', 'Ephesians 4:1-16'],
    ['Disciple Ship 5', ''], ['Disciple Ship 6', ''], ['Disciple Ship 7', ''],
    ['Practicals: Gospel sharing and assessments', 'Luke 6:12-19'], ['EHS 1: Emotionally Healthy Spirituality', 'Acts 11:19-30'], ['EHS 2', 'Psalm 107:23-32'],
    ['Three-day intensive: EHS 3 to 5, DeepLEAD 1 to 5, Inductive Bible Study', '1 Samuel 17:26-45', 'intensive'],
    ['EHS 6', ''], ['EHS 7', 'Matthew 26:31-44'], ['EHS 8', 'Daniel 6:6-10'],
    ['DeepLEAD 6', ''], ['DeepLEAD 7', 'Acts 2:42-47'], ['DeepLEAD 8', ''],
    ['MLM 1: Millennium Leaders Mandate', ''], ['MLM 2', ''], ['MLM 3', 'Exodus 3:1-21'], ['MLM 4', 'Philippians 3:1-14'],
    ['MLM 5', 'Hebrews 11:1-20'], ['MLM 6', ''],
    ['Making Ends Meet 1 (Compass Financial Ministry)', ''], ['Making Ends Meet 2 (Compass Financial Ministry)', ''],
    ['Discovery Bible Community review', 'Luke 10:25-37'], ['Singleness and Marriage', ''], ['Marriage 101: "I Do" or "No Clue"? (Emotional Needs)', ''],
    ['A2R 1: Africa to the Rest', ''], ['A2R 2', ''], ['A2R 3', ''], ['A2R 4', ''], ['A2R 5', ''], ['A2R 6', ''], ['A2R 7', ''],
    ['Kairos overview, review and evaluation', ''], ['Graduation and next cohort launch', '', 'graduation']
  ];
  save_('Sessions', { id: 'S00', week: 0, date: '2026-12-26', title: 'Induction: purpose, journey outline and introductions', kind: 'induction', passage: '' });
  var date = '2027-01-01';
  var week = 0;
  plan.forEach(function (p) {
    var kind = p[2] || 'session';
    if (kind !== 'break') week++;
    save_('Sessions', { id: 'S' + (date.replace(/-/g, '')), week: kind === 'break' ? '' : week, date: date, title: p[0], kind: kind, passage: p[1] });
    date = addDays_(date, 7);
  });
}

function seedResources_() {
  [
    ['Disciple Ship', '', 'book', 'The primary goal of mission. Read across Q2.', 'Q2', 1, false],
    ['Ministry in the Image of God', 'Stephen Seamands', 'book', 'The Trinitarian shape of Christian service.', '', 2, false],
    ['Experiencing the Trinity', 'Darrell W. Johnson', 'book', '', '', 3, false],
    ['DISC Assessment', '', 'assessment', 'Self-awareness profile used in the March DISC sessions.', 'Q1', 4, false],
    ['Emotionally Healthy Spirituality (EHS)', 'Peter Scazzero', 'book', 'Spirituality in mission. Read across Q2 and Q3.', 'Q2', 5, false],
    ['Africa to the Rest (A2R)', '', 'book', 'From mission field to mission force. Read in Q4.', 'Q4', 6, false],
    ['Millennium Leaders Mandate (MLM)', '', 'course', 'Leadership formation course for Q3.', 'Q3', 7, false],
    ['Making Ends Meet', 'Compass Financial Ministry', 'course', 'Biblical money management coursework, after MLM.', 'Q4', 8, false],
    ['Bible in One Year', '', 'plan', 'Daily Bible reading plan for the whole year.', 'Q1', 9, false],
    ['The Emotionally Healthy Leader', 'Peter Scazzero', 'book', 'Graduation gift to the best fellows.', 'Q4', 10, true]
  ].forEach(function (r, i) {
    save_('Resources', { id: 'R' + (i + 1 < 10 ? '0' : '') + (i + 1), title: r[0], author: r[1], kind: r[2], link: r[0] === 'Bible in One Year' ? 'https://www.bibleinoneyear.org/' : '', description: r[3], quarter: r[4], order: r[5], gift: r[6] });
  });
}

function seedTasks_() {
  [
    ['bible', 'Bible in One Year', 'Read through the whole Bible this year. Tick each day as you finish it.', 'Q1', '2027-12-31', 'R09'],
    ['activity', '21-day fast', 'Join the cohort in the 21-day fast that opens the year. Write what God showed you.', 'Q1', '2027-01-22', ''],
    ['activity', 'Personal prayer calendar', 'Set up your prayer calendar for the year and share it with your facilitator.', 'Q1', '2027-01-29', ''],
    ['mentees', 'Choose your three disciples', 'Pick the three people you will disciple this year and start meeting with them.', 'Q1', '2027-01-29', ''],
    ['hi5', 'Form your Hi 5 prayer group', 'Gather your Hi 5 group and adopt an unreached people group to pray for together.', 'Q1', '2027-02-26', ''],
    ['submission', 'Personal purpose statement', 'Write and upload your personal purpose statement.', 'Q1', '2027-02-12', ''],
    ['submission', 'Goals for the year', 'Set your goals for the year and upload them before Goal Sharing.', 'Q1', '2027-02-19', ''],
    ['assessment', 'DISC assessment', 'Take the DISC assessment, record your style and upload your results.', 'Q1', '2027-03-19', 'R04'],
    ['assessment', 'Spiritual gifts assessment', 'Take the spiritual gifts assessment and record your top gifts.', 'Q2', '2027-04-09', ''],
    ['reading', 'Read: Disciple Ship', 'Read the whole book alongside the Disciple Ship sessions and write a short reflection.', 'Q2', '2027-06-04', 'R01'],
    ['activity', 'Gospel sharing practical', 'Share the Gospel with someone this month and write what happened.', 'Q2', '2027-06-11', ''],
    ['reading', 'Read: Emotionally Healthy Spirituality', 'Read EHS across the EHS sessions and write a short reflection.', 'Q3', '2027-07-23', 'R05'],
    ['course', 'DeepLEAD', 'Complete the DeepLEAD sessions and exercises.', 'Q3', '2027-08-13', ''],
    ['course', 'Millennium Leaders Mandate (MLM)', 'Complete the MLM course and its exercises.', 'Q3', '2027-09-24', 'R07'],
    ['course', 'Making Ends Meet (Compass Financial Ministry)', 'Complete the Making Ends Meet coursework.', 'Q4', '2027-10-08', 'R08'],
    ['activity', 'Discovery Bible Community review', 'Review your Discovery Bible Community and share what you are learning.', 'Q4', '2027-10-15', ''],
    ['reading', 'Read: Africa to the Rest', 'Read A2R alongside the A2R sessions and write a short reflection.', 'Q4', '2027-12-17', 'R06'],
    ['report', 'Q1 report', 'Your quarterly self report for Spiritual Formation.', 'Q1', '2027-03-31', ''],
    ['report', 'Q2 report', 'Your quarterly self report for Missional Formation.', 'Q2', '2027-06-30', ''],
    ['report', 'Q3 report', 'Your quarterly self report for Leadership Formation.', 'Q3', '2027-09-30', ''],
    ['report', 'Q4 report', 'Your quarterly self report for Communal Formation.', 'Q4', '2027-12-17', '']
  ].forEach(function (t, i) {
    save_('Tasks', { id: 'T' + (i + 1 < 10 ? '0' : '') + (i + 1), kind: t[0], title: t[1], description: t[2], quarter: t[3], due: t[4], resourceId: t[5], required: true, order: i + 1 });
  });
}

// Quick check you can run from the editor after setup.
function setupCheck() {
  var me = Session.getEffectiveUser().getEmail();
  Logger.log('Signed in as: ' + me + (me.toLowerCase() === CONFIG.OWNER_EMAIL ? ' (correct)' : ' (WRONG: use ' + CONFIG.OWNER_EMAIL + ')'));
  Logger.log('Spreadsheet: ' + ss_().getUrl());
  Logger.log('Files folder: ' + rootFolder_().getUrl());
  Logger.log('People on the roster: ' + readAll_('People').length + ', sessions: ' + readAll_('Sessions').length + ', assignments: ' + readAll_('Tasks').length);
}
