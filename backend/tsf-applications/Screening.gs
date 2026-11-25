/**
 * The Shadrach Fellowship: screening, interviews and decision emails
 *
 * Lives in the same Apps Script project as Code.gs (add it with File > New > Script, name it Screening).
 * Adds a "TSF Screening" menu to the response sheet:
 *
 *   Set up or refresh screening  builds the Screening, Scores, Rubric, Email Templates and Screening Settings
 *                                tabs, and pulls every applicant from the Applications tab into Screening.
 *                                Safe to run again at any time: statuses, interview details and notes are kept.
 *   Score an applicant           opens a panel where a reviewer reads the key answers and scores them 1 to 5.
 *   Send emails for new statuses sends the email that matches each applicant's Status (interview invitation,
 *                                offer, waiting list or regret), once per status. Only engage@ can send.
 *   Send me a test of each email sends every template, filled with sample details, to you only.
 *   Make the portal list         lists every selected applicant who accepted, in the format the Fellows
 *                                Portal's "Add many" box expects.
 *
 * Applicant data stays in this sheet. Never copy it to the website.
 */

var SCREEN = {
  TAB: 'Screening',
  SCORES: 'Scores',
  RUBRIC: 'Rubric',
  TEMPLATES: 'Email Templates',
  SETTINGS: 'Screening Settings',
  PORTAL: 'Portal List'
};

/** Statuses the team chooses from. `email` is the template each one sends; `track` fills {{track}} in offers. */
var STATUSES = [
  { s: 'New' },
  { s: 'Shortlisted' },
  { s: 'Interview', email: 'interview' },
  { s: 'Selected: core fellow', email: 'offer', track: 'a core fellow of The Shadrach Fellowship 2027' },
  { s: 'Selected: TSFx', email: 'offer', track: 'a TSFx 2027 mentee, walking through the same curriculum with a TSF graduate as your mentor' },
  { s: 'Selected: associate', email: 'offer', track: 'an associate of The Shadrach Fellowship 2027' },
  { s: 'Waiting list', email: 'waitlist' },
  { s: 'Not selected', email: 'regret' },
  { s: 'Withdrawn' }
];
var REPLIES = ['Accepted', 'Declined'];

/** What the panel scores. Each criterion is 1 (weak) to 5 (strong). */
var CRITERIA = [
  { key: 'walk', stage: 'Paper', label: 'Walk with God', high: 'A clear, living faith: describes regular time in the Word and prayer, and God at work in their story.', low: 'Little sign of a personal walk with God beyond attendance.' },
  { key: 'hunger', stage: 'Paper', label: 'Hunger to be discipled', high: 'Wants to be formed, not just informed; honest about gaps; open to a discipler.', low: 'Mainly wants a certificate, a network or a title.' },
  { key: 'commitment', stage: 'Paper', label: 'Commitment and Friday availability', high: 'Has counted the cost of a year of Fridays, Bible in One Year and three disciples, and can make it.', low: 'Unclear availability or many competing commitments.' },
  { key: 'leadership', stage: 'Paper', label: 'Leadership and influence', high: 'Already serving and influencing others; a BIG dream with a sense of mission.', low: 'No present sphere of service or influence.' },
  { key: 'letter', stage: 'Paper', label: 'Recommendation letter', high: 'A specific letter from someone who knows them well and vouches for their character.', low: 'Missing, generic or from someone who barely knows them.' },
  { key: 'calling', stage: 'Interview', label: 'Clarity of calling and motivation', high: 'Can say simply why now, why TSF, and what they hope God will do.', low: 'Vague or borrowed reasons.' },
  { key: 'character', stage: 'Interview', label: 'Character and teachability', high: 'Humble, honest, receives questions well, consistent with the written application.', low: 'Defensive, inconsistent or evasive.' },
  { key: 'readiness', stage: 'Interview', label: 'Readiness for the year', high: 'Work, family and church can support the commitment; a quiet place and data for Friday sessions.', low: 'Real obstacles with no plan to meet them.' }
];
var RECOMMEND = {
  Paper: ['Shortlist', 'Maybe', 'Not this time'],
  Interview: ['Select', 'Waiting list', 'Not this time']
};

var SCREEN_COLS = [
  'Reference', 'Name', 'Email', 'Age', 'Location', 'Applied on', 'Other submissions',
  'Self-rated commitment (/10)', 'Paper reviews', 'Paper score (/5)', 'Interview reviews', 'Interview score (/5)',
  'Overall (/5)', 'Rank', 'Panel leaning',
  'Status', 'Interview date and time', 'Interview link', 'Offer reply', 'Team notes', 'Last email', 'Emailed on'
];
/** Columns the team fills in. Refresh keeps them. */
var SCREEN_MANUAL = ['Status', 'Interview date and time', 'Interview link', 'Offer reply', 'Team notes', 'Last email', 'Emailed on'];

var SCORE_COLS = ['Timestamp', 'Reviewer', 'Reference', 'Applicant', 'Stage']
  .concat(CRITERIA.map(function (c) { return c.label; }))
  .concat(['Average (/5)', 'Recommendation', 'Notes']);

var DEFAULT_SETTINGS = [
  ['Interview length', '20 minutes', 'Used in the interview invitation.'],
  ['Interviewers', 'Dr. Yaw Perbi and Frank Koomson', 'Used in the interview invitation.'],
  ['Offer reply by', 'Monday 14 December 2026', 'Change to Friday 18 December 2026 before sending offers to the waiting list.'],
  ['Ceremony', 'Saturday 26 December 2026, 6:00 to 8:00 PM GMT, online', 'Graduation of TSF 2026 and induction of TSF 2027.'],
  ['Orientation', 'Tuesday 29 December 2026, 7:00 PM GMT, online (60 minutes)', ''],
  ['Week 1', 'Friday 1 January 2027', 'The first Friday session.'],
  ['Portal link', 'https://the-hud-group.vercel.app/portal', 'Where fellows sign in.'],
  ['Interview weight (%)', '40', 'Overall score = paper score and interview score, weighted. Applicants not yet interviewed use the paper score.'],
  ['Signed', 'Frank Koomson\nCoordinator, The Shadrach Fellowship', 'The sign-off at the end of every email.']
];

var DEFAULT_TEMPLATES = [
  ['interview', 'Interview',
    'The Shadrach Fellowship: an invitation to interview ({{ref}})',
    'Dear {{firstName}},\n\n' +
    'Thank you for applying to The Shadrach Fellowship 2026/2027. The panel has prayerfully read your application, and we would love to get to know you better in a short online interview.\n\n' +
    'When: {{interviewWhen}}\n' +
    'Where: {{interviewLink}}\n' +
    'How long: {{interviewLength}}\n' +
    'With: {{interviewers}}\n\n' +
    'Please reply to confirm that this time works for you. If it does not, reply with two or three times that do and we will do our best to find one.\n\n' +
    'There is nothing to prepare. Come as you are, somewhere quiet with a steady connection, ready to talk about your story, your walk with God and why this is the season for you.\n\n' +
    'We are praying for you.\n\n{{signed}}'],
  ['offer', 'Selected: core fellow, Selected: TSFx, Selected: associate',
    'Welcome to The Shadrach Fellowship 2027 ({{ref}})',
    'Dear {{firstName}},\n\n' +
    'Congratulations! With great joy, we are offering you a place as {{track}}.\n\n' +
    'Please reply to this email by {{replyBy}} to accept your place, or to let us know if anything stands in the way.\n\n' +
    'Once you accept, this is what comes next:\n' +
    '- You will receive an email from the TSF Fellows Portal ({{portal}}) with how to sign in. Please add a photo and a short bio.\n' +
    '- Graduation and Induction Ceremony: {{ceremony}}. You will be welcomed into the Fellowship that evening.\n' +
    '- Orientation: {{orientation}}.\n' +
    '- Week 1: {{week1}}. Sessions are on Fridays.\n\n' +
    'Between now and then, please pray for the year ahead and for your future cohort. We count it a privilege to walk this journey with you.\n\n' +
    '"Those who are wise will shine like the brightness of the heavens, and those who lead many to righteousness, like the stars for ever and ever." Daniel 12:3\n\n' +
    '{{signed}}'],
  ['waitlist', 'Waiting list',
    'The Shadrach Fellowship 2027: your application ({{ref}})',
    'Dear {{firstName}},\n\n' +
    'Thank you for your application, and for the time and honesty you put into it. We received many strong applications for a small number of places.\n\n' +
    'We have not been able to offer you a place at this stage, but we would like to keep you on our waiting list. If a place opens, we will write to you by Tuesday 15 December 2026.\n\n' +
    'Whatever happens, please know that we have prayed over your application and believe God has good things ahead for you.\n\n' +
    '{{signed}}'],
  ['regret', 'Not selected',
    'The Shadrach Fellowship 2027: your application ({{ref}})',
    'Dear {{firstName}},\n\n' +
    'Thank you for applying to The Shadrach Fellowship 2026/2027, and for the honesty and care you put into your application.\n\n' +
    'We received many more applications than we have places, and after much prayer we are not able to offer you a place in this cohort. This was not an easy decision, and it is not a judgement on your worth or your calling.\n\n' +
    'We would love you to stay connected with The HuD Group, and you are welcome to apply again when the next cohort opens. If you would like to hear when that happens, simply reply to this email.\n\n' +
    'We are praying for you as you keep following Jesus and making disciples where you are.\n\n' +
    '{{signed}}']
];

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('TSF Screening')
    .addItem('Set up or refresh screening', 'refreshScreening')
    .addItem('Score an applicant', 'openScoring')
    .addSeparator()
    .addItem('Send emails for new statuses', 'sendStatusEmails')
    .addItem('Send me a test of each email', 'sendTestEmails')
    .addSeparator()
    .addItem('Make the portal list', 'makePortalList')
    .addToUi();
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function tab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function header_(sheet, cols) {
  var r = sheet.getRange(1, 1, 1, cols.length);
  r.setValues([cols]);
  r.setFontWeight('bold').setBackground('#541854').setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
}

function readTab_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 1) { return { head: [], rows: [] }; }
  var width = sheet.getLastColumn ? sheet.getLastColumn() : 0;
  var all = sheet.getRange(1, 1, sheet.getLastRow(), width || 1).getValues();
  return { head: all[0].map(String), rows: all.slice(1) };
}

function col_(head, name) {
  var i = head.indexOf(name);
  if (i === -1) { throw new Error('Column "' + name + '" is missing. Run TSF Screening > Set up or refresh screening.'); }
  return i;
}

/** Key and value rows of the Screening Settings tab, as an object. */
function settings_() {
  var out = {};
  DEFAULT_SETTINGS.forEach(function (d) { out[d[0]] = d[1]; });
  var t = readTab_(SCREEN.SETTINGS);
  t.rows.forEach(function (r) { if (String(r[0]).trim()) { out[String(r[0]).trim()] = String(r[1]); } });
  return out;
}

/** Templates from the Email Templates tab, falling back to the defaults above. */
function templates_() {
  var out = {};
  DEFAULT_TEMPLATES.forEach(function (d) { out[d[0]] = { subject: d[2], body: d[3] }; });
  var t = readTab_(SCREEN.TEMPLATES);
  t.rows.forEach(function (r) {
    var key = String(r[0]).trim();
    if (key && String(r[2]).trim() && String(r[3]).trim()) { out[key] = { subject: String(r[2]), body: String(r[3]) }; }
  });
  return out;
}

function ensureSupportTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(SCREEN.SETTINGS)) {
    var st = tab_(SCREEN.SETTINGS);
    header_(st, ['Setting', 'Value', 'Notes']);
    st.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setNumberFormat('@').setValues(DEFAULT_SETTINGS);
    st.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setWrap(true).setVerticalAlignment('top');
    st.setColumnWidth(1, 180); st.setColumnWidth(2, 380); st.setColumnWidth(3, 420);
  }
  if (!ss.getSheetByName(SCREEN.TEMPLATES)) {
    var tt = tab_(SCREEN.TEMPLATES);
    header_(tt, ['Template', 'Sent when Status is', 'Subject', 'Body (placeholders: {{firstName}} {{fullName}} {{ref}} {{track}} {{interviewWhen}} {{interviewLink}} {{interviewLength}} {{interviewers}} {{replyBy}} {{ceremony}} {{orientation}} {{week1}} {{portal}} {{signed}})']);
    tt.getRange(2, 1, DEFAULT_TEMPLATES.length, 4).setNumberFormat('@').setValues(DEFAULT_TEMPLATES);
    tt.getRange(2, 1, DEFAULT_TEMPLATES.length, 4).setWrap(true).setVerticalAlignment('top');
    tt.setColumnWidth(1, 90); tt.setColumnWidth(2, 170); tt.setColumnWidth(3, 300); tt.setColumnWidth(4, 640);
  }
  // The rubric is always rewritten so it matches CRITERIA.
  var rb = tab_(SCREEN.RUBRIC);
  rb.clear();
  header_(rb, ['Stage', 'Criterion', 'A 5 looks like', 'A 1 looks like']);
  var rubric = CRITERIA.map(function (c) { return [c.stage, c.label, c.high, c.low]; });
  rubric.push(['', '', '', '']);
  rubric.push(['How it adds up', 'Score 1 to 5', 'Paper score = the average of every reviewer\'s paper criteria. Interview score = the same for interview criteria.', 'Overall = paper and interview, weighted by "Interview weight (%)" in Screening Settings.']);
  rb.getRange(2, 1, rubric.length, 4).setNumberFormat('@').setValues(rubric).setWrap(true).setVerticalAlignment('top');
  rb.setColumnWidth(1, 100); rb.setColumnWidth(2, 240); rb.setColumnWidth(3, 420); rb.setColumnWidth(4, 360);

  var sc = tab_(SCREEN.SCORES);
  if (sc.getLastRow() === 0) {
    header_(sc, SCORE_COLS);
    sc.setFrozenColumns(4);
  }
}

/* ------------------------------------------------------------------ */
/* Refresh                                                             */
/* ------------------------------------------------------------------ */

/** Latest application per email address, with the references of any earlier submissions. */
function applicants_() {
  var t = readTab_(CONFIG.SHEET_NAME);
  if (!t.head.length) { return []; }
  var h = t.head;
  var iRef = col_(h, 'Reference'), iFirst = col_(h, 'First Name'), iSur = col_(h, 'Surname'), iAge = col_(h, 'Age'),
    iEmail = col_(h, 'Email'), iPhone = col_(h, 'Phone Number'), iLoc = col_(h, 'Location (City, and country)'),
    iTime = col_(h, 'Timestamp'), iCommit = col_(h, 'Commitment level (1 to 10)');
  var byEmail = {}, order = [];
  t.rows.forEach(function (r) {
    var ref = String(r[iRef]).trim();
    if (!ref) { return; }
    var email = String(r[iEmail]).trim().toLowerCase();
    var a = {
      ref: ref, first: String(r[iFirst]).trim(), surname: String(r[iSur]).trim(), age: r[iAge], email: String(r[iEmail]).trim(),
      phone: String(r[iPhone]).trim(), location: String(r[iLoc]).trim(), applied: r[iTime], commitment: r[iCommit], earlier: []
    };
    var key = email || ref;
    if (byEmail[key]) { a.earlier = byEmail[key].earlier.concat([byEmail[key].ref]); order[order.indexOf(byEmail[key])] = a; }
    else { order.push(a); }
    byEmail[key] = a;
  });
  return order;
}

function avg_(list) {
  var n = list.filter(function (x) { return typeof x === 'number' && isFinite(x); });
  if (!n.length) { return ''; }
  var s = 0; n.forEach(function (x) { s += x; });
  return Math.round(s / n.length * 100) / 100;
}

/** Scores grouped by reference: { ref: { Paper: [rows], Interview: [rows] } }. */
function scoresByRef_() {
  var t = readTab_(SCREEN.SCORES);
  var out = {};
  if (!t.head.length) { return out; }
  var h = t.head, iRef = h.indexOf('Reference'), iStage = h.indexOf('Stage'), iRec = h.indexOf('Recommendation'), iRev = h.indexOf('Reviewer');
  t.rows.forEach(function (r) {
    var ref = String(r[iRef]).trim(), stage = String(r[iStage]).trim();
    if (!ref || (stage !== 'Paper' && stage !== 'Interview')) { return; }
    var vals = CRITERIA.filter(function (c) { return c.stage === stage; }).map(function (c) {
      var v = Number(r[h.indexOf(c.label)]); return v >= 1 && v <= 5 ? v : NaN;
    });
    out[ref] = out[ref] || { Paper: [], Interview: [] };
    out[ref][stage].push({ reviewer: String(r[iRev]), avg: avg_(vals), rec: String(r[iRec]).trim() });
  });
  return out;
}

function leaning_(list) {
  var counts = {};
  list.forEach(function (x) { if (x.rec) { counts[x.rec] = (counts[x.rec] || 0) + 1; } });
  return Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(', ');
}

/** Builds the Screening rows. Pure apart from reading tabs, so it can be tested. */
function screeningRows_() {
  var apps = applicants_();
  var scores = scoresByRef_();
  var weight = Math.min(100, Math.max(0, Number(settings_()['Interview weight (%)']) || 0)) / 100;
  var prev = readTab_(SCREEN.TAB);
  var keep = {};
  if (prev.head.length) {
    var iRef = prev.head.indexOf('Reference');
    prev.rows.forEach(function (r) {
      var k = {};
      SCREEN_MANUAL.forEach(function (m) { var i = prev.head.indexOf(m); k[m] = i === -1 ? '' : r[i]; });
      keep[String(r[iRef]).trim()] = k;
    });
  }
  var rows = apps.map(function (a) {
    var sc = scores[a.ref] || { Paper: [], Interview: [] };
    // Scores given against an earlier submission still count.
    a.earlier.forEach(function (e) { if (scores[e]) { sc.Paper = sc.Paper.concat(scores[e].Paper); sc.Interview = sc.Interview.concat(scores[e].Interview); } });
    var paper = avg_(sc.Paper.map(function (x) { return x.avg; }));
    var inter = avg_(sc.Interview.map(function (x) { return x.avg; }));
    var overall = paper === '' ? '' : (inter === '' ? paper : Math.round((paper * (1 - weight) + inter * weight) * 100) / 100);
    var k = keep[a.ref] || {};
    a.earlier.forEach(function (e) { if (!keep[a.ref] && keep[e]) { k = keep[e]; } });
    return {
      a: a, overall: overall,
      cells: {
        'Reference': a.ref, 'Name': (a.first + ' ' + a.surname).trim(), 'Email': a.email, 'Age': a.age, 'Location': a.location,
        'Applied on': a.applied, 'Other submissions': a.earlier.join(', '), 'Self-rated commitment (/10)': a.commitment,
        'Paper reviews': sc.Paper.length, 'Paper score (/5)': paper, 'Interview reviews': sc.Interview.length, 'Interview score (/5)': inter,
        'Overall (/5)': overall, 'Rank': '', 'Panel leaning': [leaning_(sc.Paper), leaning_(sc.Interview)].filter(String).join(' | '),
        'Status': k['Status'] || 'New', 'Interview date and time': k['Interview date and time'] || '', 'Interview link': k['Interview link'] || '',
        'Offer reply': k['Offer reply'] || '', 'Team notes': k['Team notes'] || '', 'Last email': k['Last email'] || '', 'Emailed on': k['Emailed on'] || ''
      }
    };
  });
  var ranked = rows.filter(function (r) { return r.overall !== '' && r.cells.Status !== 'Withdrawn'; })
    .sort(function (x, y) { return y.overall - x.overall; });
  ranked.forEach(function (r, i) { r.cells.Rank = (i > 0 && ranked[i - 1].overall === r.overall) ? ranked[i - 1].cells.Rank : i + 1; });
  return rows.map(function (r) { return SCREEN_COLS.map(function (c) { var v = r.cells[c]; return typeof v === 'string' ? safeText_(v) : v; }); });
}

function refreshScreening() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSupportTabs_();
    var rows = screeningRows_();
    var sheet = tab_(SCREEN.TAB);
    sheet.clear();
    header_(sheet, SCREEN_COLS);
    sheet.setFrozenColumns(2);
    if (rows.length) {
      var range = sheet.getRange(2, 1, rows.length, SCREEN_COLS.length);
      // Text format on applicant columns so nothing they typed can run as a formula.
      range.setNumberFormats(rows.map(function () {
        return SCREEN_COLS.map(function (c) {
          if (c === 'Applied on' || c === 'Emailed on') { return 'yyyy-mm-dd hh:mm'; }
          if (/score|Overall/.test(c)) { return '0.00'; }
          if (/^(Age|Paper reviews|Interview reviews|Rank|Self-rated)/.test(c)) { return '0'; }
          return '@';
        });
      }));
      range.setValues(rows).setVerticalAlignment('top');
      var statusCol = SCREEN_COLS.indexOf('Status') + 1;
      sheet.getRange(2, statusCol, rows.length, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(STATUSES.map(function (x) { return x.s; }), true).setAllowInvalid(false).build());
      var replyCol = SCREEN_COLS.indexOf('Offer reply') + 1;
      sheet.getRange(2, replyCol, rows.length, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(REPLIES, true).setAllowInvalid(false).build());
      var manualStart = SCREEN_COLS.indexOf('Status') + 1;
      sheet.getRange(1, manualStart, rows.length + 1, SCREEN_MANUAL.length).setBackground('#fff3e5');
      sheet.getRange(1, manualStart, 1, SCREEN_MANUAL.length).setBackground('#df6e0c');
    }
    sheet.setColumnWidth(2, 180); sheet.setColumnWidth(3, 220); sheet.setColumnWidth(15, 200);
    sheet.setColumnWidth(16, 170); sheet.setColumnWidth(17, 170); sheet.setColumnWidth(18, 220); sheet.setColumnWidth(20, 260);
    SpreadsheetApp.flush();
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Scoring panel                                                       */
/* ------------------------------------------------------------------ */

function openScoring() {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCREEN.TAB)) { refreshScreening(); }
  var html = HtmlService.createHtmlOutput(SCORING_HTML_).setWidth(980).setHeight(720).setTitle('Score an applicant');
  SpreadsheetApp.getUi().showModelessDialog(html, 'Score an applicant');
}

function reviewerName_() {
  var saved = PropertiesService.getUserProperties().getProperty('tsfReviewer');
  if (saved) { return saved; }
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

/** Called from the panel: the applicant list, criteria and the reviewer's saved name. */
function scoringData() {
  var t = readTab_(SCREEN.TAB);
  var list = [];
  if (t.head.length) {
    var iRef = t.head.indexOf('Reference'), iName = t.head.indexOf('Name'), iStatus = t.head.indexOf('Status');
    list = t.rows.filter(function (r) { return String(r[iRef]).trim(); })
      .map(function (r) { return { ref: String(r[iRef]), name: String(r[iName]), status: String(r[iStatus]) }; });
  }
  return { applicants: list, criteria: CRITERIA, recommend: RECOMMEND, reviewer: reviewerName_() };
}

/** Called from the panel: the answers a reviewer needs, plus their own earlier scores for this applicant. */
function applicantDetail(ref, reviewer) {
  ref = String(ref || '');
  var t = readTab_(CONFIG.SHEET_NAME);
  var h = t.head, iRef = h.indexOf('Reference');
  var row = null;
  t.rows.forEach(function (r) { if (String(r[iRef]) === ref) { row = r; } });
  if (!row) { throw new Error('No application with reference ' + ref); }
  function v(name) { var i = h.indexOf(name); return i === -1 ? '' : String(row[i] === undefined ? '' : row[i]); }
  var link = function (u) { return /^https:\/\/(drive|docs)\.google\.com\//.test(u) ? u : ''; };
  var ratings = RATING_FIELDS.map(function (r) { return { label: r.label, value: v('Self-rating (1 to 10): ' + r.label) }; });
  var detail = {
    ref: ref, name: v('First Name') + ' ' + v('Surname'), age: v('Age'), location: v('Location (City, and country)'),
    commitment: v('Commitment level (1 to 10)'), cv: link(v('CV')), letter: link(v('Recommendation Letter')), ratings: ratings,
    answers: [
      ['Why join the Fellowship', v('Why do you want to join the Shadrach Fellowship?')],
      ['Spiritual journey', v('Describe your spiritual journey.')],
      ['Life story', v('Tell us your summarised life story (200 words maximum)')],
      ['The most important thing to know', v('What is the most important thing you would like us to know about you (in a sentence or two)?')],
      ['The BIG dream', v('What is the BIG dream you are working on right now?')],
      ['Formal Discipler', [v('Have you ever had a formal "Discipler"?'), v('If yes, when was that and how did that go?'), v('If no, why not? Why now/stopped?')].filter(String).join('. ')],
      ['Self-awareness', 'Life story mapped: ' + v('Have you mapped out your life story and drawn insights from it?') + '. Genogram: ' + v('Have you drawn your Genogram?') +
        '. Personality test: ' + [v('Ever taken a personality test(s)?'), v('Which kind and what were the results?')].filter(String).join(', ') +
        '. Personal mission statement: ' + v('Do you have a Personal Mission Statement?') + '. Family mission statement: ' + v('Do you have a Family Mission Statement?') +
        '. Values: ' + [v('Have you worked through your personal values?'), v('What are they?')].filter(String).join(', ')]
    ],
    mine: {}
  };
  var s = readTab_(SCREEN.SCORES);
  if (s.head.length && reviewer) {
    s.rows.forEach(function (r) {
      if (String(r[s.head.indexOf('Reference')]) === ref && String(r[s.head.indexOf('Reviewer')]).toLowerCase() === String(reviewer).toLowerCase()) {
        var stage = String(r[s.head.indexOf('Stage')]);
        var o = { rec: String(r[s.head.indexOf('Recommendation')]), notes: String(r[s.head.indexOf('Notes')]) };
        CRITERIA.forEach(function (c) { o[c.key] = r[s.head.indexOf(c.label)]; });
        detail.mine[stage] = o;
      }
    });
  }
  return detail;
}

/** Called from the panel. One row per reviewer, applicant and stage: saving again updates that row. */
function saveScore(form) {
  form = form || {};
  var reviewer = String(form.reviewer || '').trim().slice(0, 80);
  var ref = String(form.ref || '').trim();
  var stage = form.stage === 'Interview' ? 'Interview' : 'Paper';
  if (!reviewer) { throw new Error('Please type your name so your scores are labelled.'); }
  var apps = applicants_();
  var match = null;
  apps.forEach(function (a) { if (a.ref === ref || a.earlier.indexOf(ref) !== -1) { match = a; } });
  if (!match) { throw new Error('Unknown applicant ' + ref); }
  var crit = CRITERIA.filter(function (c) { return c.stage === stage; });
  var vals = {};
  crit.forEach(function (c) {
    var n = Number(form[c.key]);
    if (!(n >= 1 && n <= 5 && n % 1 === 0)) { throw new Error('Please give a score from 1 to 5 for "' + c.label + '".'); }
    vals[c.key] = n;
  });
  var rec = String(form.rec || '');
  if (RECOMMEND[stage].indexOf(rec) === -1) { throw new Error('Please choose a recommendation.'); }
  var notes = String(form.notes || '').slice(0, 3000);

  PropertiesService.getUserProperties().setProperty('tsfReviewer', reviewer);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSupportTabs_();
    var sheet = tab_(SCREEN.SCORES);
    var t = readTab_(SCREEN.SCORES);
    var h = t.head;
    var rowIndex = -1;
    t.rows.forEach(function (r, i) {
      if (String(r[h.indexOf('Reference')]) === match.ref && String(r[h.indexOf('Stage')]) === stage &&
        String(r[h.indexOf('Reviewer')]).toLowerCase() === reviewer.toLowerCase()) { rowIndex = i + 2; }
    });
    var cells = SCORE_COLS.map(function (c) {
      if (c === 'Timestamp') { return new Date(); }
      if (c === 'Reviewer') { return reviewer; }
      if (c === 'Reference') { return match.ref; }
      if (c === 'Applicant') { return (match.first + ' ' + match.surname).trim(); }
      if (c === 'Stage') { return stage; }
      if (c === 'Average (/5)') { return avg_(crit.map(function (x) { return vals[x.key]; })); }
      if (c === 'Recommendation') { return rec; }
      if (c === 'Notes') { return notes; }
      var cr = crit.filter(function (x) { return x.label === c; })[0];
      return cr ? vals[cr.key] : '';
    });
    var target = rowIndex > 0 ? rowIndex : sheet.getLastRow() + 1;
    var range = sheet.getRange(target, 1, 1, SCORE_COLS.length);
    range.setNumberFormats([SCORE_COLS.map(function (c) {
      return c === 'Timestamp' ? 'yyyy-mm-dd hh:mm' : (c === 'Average (/5)' ? '0.00' : (CRITERIA.some(function (x) { return x.label === c; }) ? '0' : '@'));
    })]);
    range.setValues([cells.map(function (v) { return typeof v === 'string' ? safeText_(v) : v; })]).setVerticalAlignment('top');
  } finally {
    lock.releaseLock();
  }
  refreshScreening();
  return { ok: true, updated: true };
}

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

function fill_(text, data) {
  return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return data[k] === undefined ? m : String(data[k]); });
}

function formatWhen_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, 'GMT', "EEEE d MMMM yyyy, h:mm a 'GMT'");
  }
  return String(v || '').trim();
}

/** Plain text template to a branded HTML email. Lines starting with "- " become a list; bare https links become links. */
function emailHtml_(subject, text) {
  var linkify = function (s) { return s.replace(/(https:\/\/[^\s<()]*[^\s<().,;:!?])/g, '<a href="$1" style="color:#7a297a">$1</a>'); };
  var body = String(text).split(/\n{2,}/).map(function (p) {
    var lines = p.split('\n');
    if (lines.every(function (l) { return /^- /.test(l); })) {
      return '<ul style="margin:0 0 14px;padding-left:20px">' + lines.map(function (l) { return '<li style="margin-bottom:6px">' + linkify(esc_(l.slice(2))) + '</li>'; }).join('') + '</ul>';
    }
    var first = lines[0];
    if (lines.length > 1 && lines.slice(1).every(function (l) { return /^- /.test(l); })) {
      return '<p style="margin:0 0 6px">' + linkify(esc_(first)) + '</p><ul style="margin:0 0 14px;padding-left:20px">' +
        lines.slice(1).map(function (l) { return '<li style="margin-bottom:6px">' + linkify(esc_(l.slice(2))) + '</li>'; }).join('') + '</ul>';
    }
    return '<p style="margin:0 0 14px">' + linkify(esc_(p)).replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1420;max-width:580px;line-height:1.65;font-size:15px">' +
    '<div style="background:#541854;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffb866">The Shadrach Fellowship</div>' +
    '<div style="font-family:Georgia,serif;font-size:21px;margin-top:4px">' + esc_(subject.replace(/\s*\(TSF[^)]*\)\s*$/, '')) + '</div></div>' +
    '<div style="border:1px solid #eee;border-top:0;padding:22px 24px;border-radius:0 0 10px 10px">' + body +
    '<p style="margin:18px 0 0;font-size:12px;color:#6b5a68">The HuD Group Global &middot; ' + esc_(CONFIG.NOTIFY_EMAIL) + '</p></div></div>';
}

function mailData_(cells, set, status) {
  var st = STATUSES.filter(function (x) { return x.s === status; })[0] || {};
  var name = String(cells['Name'] || '').trim();
  return {
    firstName: name.split(/\s+/)[0] || 'friend', fullName: name, ref: cells['Reference'], track: st.track || '',
    interviewWhen: formatWhen_(cells['Interview date and time']), interviewLink: String(cells['Interview link'] || '').trim(),
    interviewLength: set['Interview length'], interviewers: set['Interviewers'], replyBy: set['Offer reply by'],
    ceremony: set['Ceremony'], orientation: set['Orientation'], week1: set['Week 1'], portal: set['Portal link'], signed: set['Signed']
  };
}

/** Which emails are due. Pure apart from reading tabs, so it can be tested. */
function pendingEmails_() {
  var t = readTab_(SCREEN.TAB);
  if (!t.head.length) { return { send: [], skipped: [] }; }
  var set = settings_(), tpl = templates_();
  var send = [], skipped = [];
  t.rows.forEach(function (r, i) {
    var cells = {};
    t.head.forEach(function (h, j) { cells[h] = r[j]; });
    var status = String(cells['Status'] || '').trim();
    var st = STATUSES.filter(function (x) { return x.s === status; })[0];
    if (!st || !st.email) { return; }
    var key = st.email === 'offer' ? 'offer: ' + status.replace(/^Selected:\s*/, '') : st.email;
    if (String(cells['Last email'] || '').trim() === key) { return; }
    var email = String(cells['Email'] || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { skipped.push(cells['Reference'] + ': no valid email address'); return; }
    if (st.email === 'interview' && (!String(cells['Interview date and time'] || '').trim() || !/^https:\/\//.test(String(cells['Interview link'] || '').trim()))) {
      skipped.push(cells['Reference'] + ' (' + cells['Name'] + '): add the interview date and time and an https:// link first'); return;
    }
    var data = mailData_(cells, set, status);
    var t2 = tpl[st.email];
    send.push({ row: i + 2, to: email, key: key, subject: fill_(t2.subject, data), text: fill_(t2.body, data), ref: cells['Reference'], name: cells['Name'] });
  });
  return { send: send, skipped: skipped };
}

function requireOwner_() {
  var who = ownerEmail_().toLowerCase();
  if (who !== CONFIG.OWNER_EMAIL.toLowerCase()) {
    throw new Error('Emails to applicants go out from ' + CONFIG.OWNER_EMAIL + ' only. You are signed in as ' + (who || 'another account') +
      '. Open this sheet while signed in as ' + CONFIG.OWNER_EMAIL + ' to send them.');
  }
}

function sendStatusEmails() {
  var ui = SpreadsheetApp.getUi();
  requireOwner_();
  refreshScreening();
  var p = pendingEmails_();
  if (!p.send.length) {
    ui.alert('Nothing to send', 'No applicant has a new status that needs an email.' + (p.skipped.length ? '\n\nWaiting for details:\n' + p.skipped.join('\n') : ''), ui.ButtonSet.OK);
    return 0;
  }
  var counts = {};
  p.send.forEach(function (m) { counts[m.key] = (counts[m.key] || 0) + 1; });
  var summary = Object.keys(counts).map(function (k) { return counts[k] + ' x ' + k; }).join('\n');
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < p.send.length) {
    ui.alert('Daily email limit', 'Google allows ' + quota + ' more emails today, and ' + p.send.length + ' are waiting. Try again tomorrow, or change some statuses back for now.', ui.ButtonSet.OK);
    return 0;
  }
  var ok = ui.alert('Send ' + p.send.length + ' email' + (p.send.length === 1 ? '' : 's') + '?',
    summary + '\n\nTo:\n' + p.send.map(function (m) { return m.name + ' (' + m.ref + ')'; }).join('\n') +
    (p.skipped.length ? '\n\nNot sent yet:\n' + p.skipped.join('\n') : '') + '\n\nThese go out now from ' + CONFIG.OWNER_EMAIL + '.',
    ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) { return 0; }
  var sheet = tab_(SCREEN.TAB);
  var cLast = SCREEN_COLS.indexOf('Last email') + 1, cOn = SCREEN_COLS.indexOf('Emailed on') + 1;
  var sent = 0, failed = [];
  p.send.forEach(function (m) {
    try {
      MailApp.sendEmail({ to: m.to, replyTo: CONFIG.NOTIFY_EMAIL, name: CONFIG.SENDER_NAME, subject: m.subject, body: m.text, htmlBody: emailHtml_(m.subject, m.text) });
      sheet.getRange(m.row, cLast, 1, 2).setValues([[m.key, new Date()]]);
      sent++;
    } catch (err) {
      failed.push(m.name + ': ' + err);
    }
  });
  SpreadsheetApp.flush();
  ui.alert('Done', sent + ' sent.' + (failed.length ? '\n\nNot sent:\n' + failed.join('\n') : ''), ui.ButtonSet.OK);
  return sent;
}

function sendTestEmails() {
  var me = ownerEmail_();
  if (!me) { throw new Error('Could not tell which account you are using.'); }
  var set = settings_(), tpl = templates_();
  var sample = { 'Name': 'Ama Mensah', 'Reference': CONFIG.REF_PREFIX + '000', 'Interview date and time': 'Wednesday 2 December 2026, 6:00 PM GMT', 'Interview link': 'https://zoom.us/j/0000000000' };
  var list = [['interview', 'Interview'], ['offer', 'Selected: core fellow'], ['waitlist', 'Waiting list'], ['regret', 'Not selected']];
  list.forEach(function (x) {
    var data = mailData_(sample, set, x[1]);
    var subject = '[TEST] ' + fill_(tpl[x[0]].subject, data);
    var text = fill_(tpl[x[0]].body, data);
    MailApp.sendEmail({ to: me, name: CONFIG.SENDER_NAME, subject: subject, body: text, htmlBody: emailHtml_(subject.replace('[TEST] ', ''), text) });
  });
  try { SpreadsheetApp.getUi().alert('Sent', 'Four test emails are on their way to ' + me + '.', SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { }
  return list.length;
}

/* ------------------------------------------------------------------ */
/* Portal list                                                         */
/* ------------------------------------------------------------------ */

/** Lines for the portal's "Add many" box: Full name, email, country, city, phone. */
function portalLines_() {
  var t = readTab_(SCREEN.TAB);
  if (!t.head.length) { return []; }
  var apps = {};
  applicants_().forEach(function (a) { apps[a.ref] = a; });
  var groups = {};
  t.rows.forEach(function (r) {
    var cells = {};
    t.head.forEach(function (h, j) { cells[h] = r[j]; });
    var status = String(cells['Status']);
    if (status.indexOf('Selected') !== 0 || String(cells['Offer reply']) !== 'Accepted') { return; }
    var a = apps[String(cells['Reference'])];
    if (!a) { return; }
    var clean = function (s) { return String(s || '').replace(/[,\n\r]+/g, ' ').replace(/\s+/g, ' ').trim(); };
    var parts = a.location.split(',').map(function (s) { return s.trim(); }).filter(String);
    var country = parts.length ? parts[parts.length - 1] : '';
    var city = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    var line = [clean(a.first + ' ' + a.surname), clean(a.email), clean(country), clean(city), clean(a.phone)].join(', ').replace(/(, )+$/, '');
    (groups[status] = groups[status] || []).push(line);
  });
  var out = [];
  STATUSES.forEach(function (s) {
    if (groups[s.s]) { out.push({ group: s.s, lines: groups[s.s] }); }
  });
  return out;
}

function makePortalList() {
  var groups = portalLines_();
  var sheet = tab_(SCREEN.PORTAL);
  sheet.clear();
  header_(sheet, ['Copy the lines under each heading into the Fellows Portal: Roster > Add many. Then use Send welcome emails there.']);
  var rows = [];
  if (!groups.length) { rows.push(['No one yet. A person appears here when their Status starts with "Selected" and their Offer reply is "Accepted".']); }
  groups.forEach(function (g) {
    rows.push([g.group + ' (' + g.lines.length + ')']);
    g.lines.forEach(function (l) { rows.push([l]); });
    rows.push(['']);
  });
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat('@').setValues(rows.map(function (r) { return [safeText_(r[0])]; }));
  sheet.setColumnWidth(1, 760);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  return groups.reduce(function (n, g) { return n + g.lines.length; }, 0);
}

/* ------------------------------------------------------------------ */
/* The scoring panel page                                              */
/* ------------------------------------------------------------------ */

var SCORING_HTML_ = '<!doctype html><html><head><base target="_top"><meta charset="utf-8"><style>' +
  '*{box-sizing:border-box}body{margin:0;font:14px/1.55 Arial,Helvetica,sans-serif;color:#1a1420;background:#faf7fa}' +
  '.wrap{display:grid;grid-template-columns:1.15fr 1fr;height:100vh}' +
  '.read{overflow:auto;height:100vh;min-height:0;padding:18px 22px;background:#fff;border-right:1px solid #eadfea}' +
  '.form{overflow:auto;height:100vh;min-height:0;padding:18px 22px}' +
  'h1{font:600 19px Georgia,serif;color:#541854;margin:0 0 2px}h2{font:600 13px Arial;letter-spacing:.08em;text-transform:uppercase;color:#df6e0c;margin:18px 0 4px}' +
  '.meta{color:#6b5a68;font-size:13px}.ans{white-space:pre-wrap;margin:0}' +
  'label.k{display:block;font-weight:700;font-size:13px;margin:12px 0 4px}' +
  'select,input[type=text],textarea{width:100%;font:inherit;padding:8px 10px;border:1px solid #d9c8d9;border-radius:8px;background:#fff}' +
  'textarea{min-height:90px;resize:vertical}' +
  '.crit{background:#fff;border:1px solid #eadfea;border-radius:10px;padding:10px 12px;margin-top:10px}' +
  '.crit b{display:block}.crit small{color:#6b5a68;display:block;margin:2px 0 6px}' +
  '.dots{display:flex;gap:6px}.dots label{flex:1;position:relative}.dots input{position:absolute;opacity:0;left:50%;bottom:0;width:1px;height:1px}' +
  '.dots span{display:block;text-align:center;padding:6px 0;border:1px solid #d9c8d9;border-radius:8px;cursor:pointer;font-weight:700}' +
  '.dots input:checked+span{background:#541854;border-color:#541854;color:#fff}.dots input:focus-visible+span{outline:2px solid #fc9018}' +
  '.seg{display:flex;gap:6px;margin-top:6px}.seg label{flex:1;position:relative}.seg input{position:absolute;opacity:0;left:50%;bottom:0;width:1px;height:1px}' +
  '.seg span{display:block;text-align:center;padding:7px 4px;border:1px solid #d9c8d9;border-radius:8px;cursor:pointer;font-size:13px}' +
  '.seg input:checked+span{background:#fc9018;border-color:#fc9018;color:#1a1420;font-weight:700}' +
  'button{margin-top:16px;width:100%;padding:11px;border:0;border-radius:999px;background:#541854;color:#fff;font:700 15px Arial;cursor:pointer}' +
  'button:disabled{opacity:.6}.msg{margin-top:10px;font-weight:700}.ok{color:#2e7d32}.err{color:#b3261e}' +
  '.rates{display:grid;grid-template-columns:1fr auto;gap:2px 12px;font-size:13px}.links a{color:#7a297a;margin-right:14px;font-weight:700}' +
  '.empty{color:#6b5a68;margin-top:40px;text-align:center}' +
  '@media(max-width:760px){.wrap{grid-template-columns:1fr;height:auto}.read,.form{height:auto}.read{border-right:0;border-bottom:1px solid #eadfea}}' +
  '</style></head><body><div class="wrap"><div class="read" id="read"><p class="empty">Choose an applicant to read their application.</p></div>' +
  '<div class="form"><form id="f">' +
  '<label class="k" for="reviewer">Your name</label><input type="text" id="reviewer" name="reviewer" maxlength="80" required>' +
  '<label class="k" for="ref">Applicant</label><select id="ref" name="ref" required><option value="">Loading...</option></select>' +
  '<label class="k">Stage</label><div class="seg" id="stage"><label><input type="radio" name="stage" value="Paper" checked><span>Paper review</span></label><label><input type="radio" name="stage" value="Interview"><span>Interview</span></label></div>' +
  '<div id="crits"></div>' +
  '<label class="k">Your recommendation</label><div class="seg" id="rec"></div>' +
  '<label class="k" for="notes">Notes for the panel</label><textarea id="notes" name="notes" maxlength="3000"></textarea>' +
  '<button type="submit" id="save">Save score</button><div class="msg" id="msg" role="status"></div></form></div></div>' +
  '<script>' +
  'var D=null,cur=null;function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}' +
  'function stage(){return document.querySelector("input[name=stage]:checked").value}' +
  'function msg(t,c){var m=document.getElementById("msg");m.textContent=t;m.className="msg "+(c||"")}' +
  'function drawForm(){var s=stage(),box=document.getElementById("crits");box.innerHTML="";var mine=cur&&cur.mine&&cur.mine[s]||{};' +
  'D.criteria.filter(function(c){return c.stage===s}).forEach(function(c){var d=el("div","crit");d.appendChild(el("b",null,c.label));d.appendChild(el("small",null,"5: "+c.high));' +
  'var dots=el("div","dots");for(var i=1;i<=5;i++){var l=el("label");var r=document.createElement("input");r.type="radio";r.name=c.key;r.value=i;r.required=true;r.setAttribute("aria-label",c.label+" "+i);if(Number(mine[c.key])===i)r.checked=true;l.appendChild(r);l.appendChild(el("span",null,String(i)));dots.appendChild(l)}' +
  'd.appendChild(dots);box.appendChild(d)});var rec=document.getElementById("rec");rec.innerHTML="";D.recommend[s].forEach(function(o){var l=el("label");var r=document.createElement("input");r.type="radio";r.name="rec";r.value=o;r.required=true;if(mine.rec===o)r.checked=true;l.appendChild(r);l.appendChild(el("span",null,o));rec.appendChild(l)});' +
  'document.getElementById("notes").value=mine.notes||""}' +
  'function drawRead(d){var R=document.getElementById("read");R.innerHTML="";R.scrollTop=0;R.appendChild(el("h1",null,d.name));' +
  'R.appendChild(el("div","meta",d.ref+" · Age "+d.age+" · "+d.location+" · Commitment "+d.commitment+"/10"));' +
  'var L=el("div","links");L.style.marginTop="8px";[["CV",d.cv],["recommendation letter",d.letter]].forEach(function(x){if(x[1]){var a=el("a",null,"Open "+x[0]);a.href=x[1];a.target="_blank";a.rel="noopener";L.appendChild(a)}else{L.appendChild(el("span","meta",x[0]+": none  "))}});R.appendChild(L);' +
  'd.answers.forEach(function(a){if(!a[1])return;R.appendChild(el("h2",null,a[0]));R.appendChild(el("p","ans",a[1]))});' +
  'R.appendChild(el("h2",null,"Self-ratings (out of 10)"));var g=el("div","rates");d.ratings.forEach(function(r){g.appendChild(el("span",null,r.label));g.appendChild(el("b",null,r.value))});R.appendChild(g)}' +
  'function load(){var ref=document.getElementById("ref").value;if(!ref){cur=null;drawForm();return}msg("Loading...");' +
  'google.script.run.withSuccessHandler(function(d){cur=d;drawRead(d);drawForm();msg(d.mine[stage()]?"You scored this before: saving again updates it.":"")}).withFailureHandler(function(e){msg(e.message,"err")}).applicantDetail(ref,document.getElementById("reviewer").value)}' +
  'google.script.run.withSuccessHandler(function(d){D=d;document.getElementById("reviewer").value=d.reviewer||"";var s=document.getElementById("ref");s.innerHTML="";s.appendChild(el("option",null,"Choose an applicant"));s.firstChild.value="";' +
  'd.applicants.forEach(function(a){var o=el("option",null,a.ref+"  "+a.name+(a.status&&a.status!=="New"?"  ("+a.status+")":""));o.value=a.ref;s.appendChild(o)});drawForm()}).withFailureHandler(function(e){msg(e.message,"err")}).scoringData();' +
  'document.getElementById("ref").addEventListener("change",load);function touched(){return !!(document.querySelector("#crits input:checked,#rec input:checked")||document.getElementById("notes").value)}document.getElementById("reviewer").addEventListener("change",function(){if(!cur)return;var ref=cur.ref;google.script.run.withSuccessHandler(function(d){if(!cur||cur.ref!==ref)return;cur.mine=d.mine;if(!touched()){drawForm();msg(d.mine[stage()]?"You scored this before: saving again updates it.":"")}}).applicantDetail(ref,document.getElementById("reviewer").value)});' +
  'Array.prototype.forEach.call(document.querySelectorAll("input[name=stage]"),function(r){r.addEventListener("change",function(){drawForm()})});' +
  'document.getElementById("f").addEventListener("submit",function(e){e.preventDefault();var f=e.target,o={reviewer:f.reviewer.value,ref:f.ref.value,stage:stage(),notes:f.notes.value};' +
  'var r=f.querySelector("input[name=rec]:checked");o.rec=r?r.value:"";D.criteria.forEach(function(c){var x=f.querySelector("input[name="+c.key+"]:checked");if(x)o[c.key]=x.value});' +
  'var b=document.getElementById("save");b.disabled=true;msg("Saving...");google.script.run.withSuccessHandler(function(){b.disabled=false;msg("Saved. Choose the next applicant.","ok");cur.mine[o.stage]=o})' +
  '.withFailureHandler(function(err){b.disabled=false;msg(err.message,"err")}).saveScore(o)});' +
  '</script></body></html>';

if (typeof module !== 'undefined') {
  module.exports = { screeningRows_: screeningRows_, pendingEmails_: pendingEmails_, portalLines_: portalLines_, saveScore: saveScore, refreshScreening: refreshScreening };
}
