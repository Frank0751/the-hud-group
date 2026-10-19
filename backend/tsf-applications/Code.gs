/**
 * The Shadrach Fellowship 2026/2027: application receiver
 *
 * Bound to the response spreadsheet. Receives JSON posted by apply.html and:
 *   1. validates it again on the server (never trust the browser),
 *   2. saves the CV and recommendation letter to a private Drive folder,
 *   3. appends one row to the "Applications" tab,
 *   4. emails the full application to the team inbox,
 *   5. emails a confirmation to the applicant.
 *
 * Setup: see README.md in this folder.
 */

var CONFIG = {
  NOTIFY_EMAIL: 'engage@thehudgroupglobal.org',
  // Everything (sheet, Drive folder, outgoing email) must live under this account.
  // setupCheck refuses to finish if the script is authorised by any other account.
  OWNER_EMAIL: 'engage@thehudgroupglobal.org',
  SENDER_NAME: 'The Shadrach Fellowship',
  SHEET_NAME: 'Applications',
  FOLDER_NAME: 'TSF 2026-2027 Application Files',
  // Optional: paste the ID of a folder (or Shared Drive folder) you made yourself, the long code in its URL.
  // Leave empty to have the script create FOLDER_NAME in My Drive.
  FOLDER_ID: '',
  REF_PREFIX: 'TSF27-',
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_WORDS: 200,
  WORD_TOLERANCE: 10,
  MIN_AGE: 17,
  MAX_AGE: 39,
  MIN_SECONDS_ON_FORM: 8,
  MAX_TEXT_LENGTH: 6000
};

var RATING_FIELDS = [
  { key: 'professional', label: 'Professional' },
  { key: 'financial', label: 'Financial' },
  { key: 'health', label: 'Health & Wellness' },
  { key: 'emotional', label: 'Emotional' },
  { key: 'relationships', label: 'Relationships (Social Life)' },
  { key: 'bible', label: 'Bible reading/Studying' },
  { key: 'worship', label: 'Worship/Adoration' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'fellowship', label: 'Fellowship' },
  { key: 'witnessing', label: 'Witnessing/Evangelism' },
  { key: 'service', label: 'Service' },
  { key: 'christlikeness', label: 'Christ-likeness/Fruit of the Spirit' },
  { key: 'missions', label: 'National/Global Missions' }
];

var FILE_RULES = {
  recommendation: { label: 'Recommendation letter', noun: 'recommendation letter', ext: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
  cv: { label: 'CV', noun: 'CV', ext: ['pdf', 'doc', 'docx'] }
};

/** Column order of the response sheet. Each entry: header, value getter, kind ('text' | 'number' | 'date'). */
function columns_() {
  var cols = [
    { h: 'Timestamp', kind: 'date', get: function (c) { return c.now; } },
    { h: 'Reference', kind: 'text', get: function (c) { return c.ref; } },
    { h: 'First Name', kind: 'text', get: function (c) { return c.app.firstName; } },
    { h: 'Surname', kind: 'text', get: function (c) { return c.app.surname; } },
    { h: 'Age', kind: 'number', get: function (c) { return Number(c.app.age); } },
    { h: 'Email', kind: 'text', get: function (c) { return c.app.email; } },
    { h: 'Phone Number', kind: 'text', get: function (c) { return c.app.phone; } },
    { h: 'WhatsApp number', kind: 'text', get: function (c) { return c.app.whatsapp; } },
    { h: 'Location (City, and country)', kind: 'text', get: function (c) { return c.app.location; } },
    { h: 'Tell us your summarised life story (200 words maximum)', kind: 'text', get: function (c) { return c.app.lifeStory; } },
    { h: 'What is the most important thing you would like us to know about you (in a sentence or two)?', kind: 'text', get: function (c) { return c.app.aboutYou; } },
    { h: 'Have you ever had a formal "Discipler"?', kind: 'text', get: function (c) { return c.app.hasDiscipler; } },
    { h: 'If yes, when was that and how did that go?', kind: 'text', get: function (c) { return c.app.disciplerExperience || ''; } },
    { h: 'If no, why not? Why now/stopped?', kind: 'text', get: function (c) { return c.app.noDisciplerReason || ''; } },
    { h: 'Have you mapped out your life story and drawn insights from it?', kind: 'text', get: function (c) { return c.app.lifeStoryMapped; } },
    { h: 'Have you drawn your Genogram?', kind: 'text', get: function (c) { return c.app.genogram; } },
    { h: 'Ever taken a personality test(s)?', kind: 'text', get: function (c) { return c.app.personalityTest; } },
    { h: 'Which kind and what were the results?', kind: 'text', get: function (c) { return c.app.personalityDetails || ''; } },
    { h: 'Do you have a Personal Mission Statement?', kind: 'text', get: function (c) { return c.app.personalMission; } },
    { h: 'Do you have a Family Mission Statement?', kind: 'text', get: function (c) { return c.app.familyMission; } },
    { h: 'Have you worked through your personal values?', kind: 'text', get: function (c) { return c.app.valuesWorked; } },
    { h: 'What are they?', kind: 'text', get: function (c) { return c.app.values || ''; } },
    { h: 'What is the BIG dream you are working on right now?', kind: 'text', get: function (c) { return c.app.bigDream; } }
  ];
  RATING_FIELDS.forEach(function (r) {
    cols.push({
      h: 'Self-rating (1 to 10): ' + r.label,
      kind: 'number',
      get: function (c) { return Number(c.app.ratings[r.key]); }
    });
  });
  cols.push(
    { h: 'Describe your spiritual journey.', kind: 'text', get: function (c) { return c.app.spiritualJourney; } },
    { h: 'Recommendation Letter', kind: 'text', get: function (c) { return c.links.recommendation; } },
    { h: 'CV', kind: 'text', get: function (c) { return c.links.cv; } },
    { h: 'Why do you want to join the Shadrach Fellowship?', kind: 'text', get: function (c) { return c.app.whyJoin; } },
    { h: 'Commitment level (1 to 10)', kind: 'number', get: function (c) { return Number(c.app.commitment); } },
    { h: 'Repeat submission', kind: 'text', get: function (c) { return c.repeat ? 'Yes' : ''; } },
    { h: 'Source', kind: 'text', get: function (c) { return 'Website'; } }
  );
  return cols;
}

/* ------------------------------------------------------------------ */
/* Web app entry points                                                */
/* ------------------------------------------------------------------ */

function doGet() {
  return json_({ ok: true, service: 'The Shadrach Fellowship application receiver' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var app = parse_(e);

    // Honeypot: bots fill the hidden field. Pretend success, save nothing.
    if (app.website) {
      return json_({ ok: true, ref: CONFIG.REF_PREFIX + '000' });
    }

    var errors = validate_(app);
    if (errors.length) {
      return json_({ ok: false, error: errors[0], errors: errors });
    }

    lock.waitLock(30000);
    locked = true;

    var sheet = getSheet_();
    ensureHeaders_(sheet);

    var repeat = isRepeat_(sheet, app.email);
    var ref = CONFIG.REF_PREFIX + pad_(sheet.getLastRow(), 3); // header is row 1, so first applicant is 001
    var links = saveFiles_(app, ref);
    var now = new Date();
    var ctx = { app: app, ref: ref, links: links, now: now, repeat: repeat };

    writeRow_(sheet, ctx);
    SpreadsheetApp.flush();

    // Mail problems must never lose an application that is already saved.
    try { notifyTeam_(ctx, sheet); } catch (mailErr) { console.error('Team email failed: ' + mailErr); }
    try { confirmApplicant_(ctx); } catch (mailErr2) { console.error('Applicant email failed: ' + mailErr2); }

    return json_({ ok: true, ref: ref });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({
      ok: false,
      error: 'We could not save your application. Please try again, or email ' + CONFIG.NOTIFY_EMAIL + '.'
    });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (ignore) { } }
  }
}

/* ------------------------------------------------------------------ */
/* Parsing and validation                                              */
/* ------------------------------------------------------------------ */

function parse_(e) {
  if (!e || !e.postData || !e.postData.contents) { throw new Error('Empty request'); }
  var app = JSON.parse(e.postData.contents);
  if (!app || typeof app !== 'object') { throw new Error('Bad payload'); }
  return app;
}

function clean_(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\r\n/g, '\n').trim();
}

function wordCount_(text) {
  var t = clean_(text);
  return t ? t.split(/\s+/).length : 0;
}

function extOf_(name) {
  var m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

function approxBytes_(b64) {
  var s = String(b64 || '');
  var pad = (s.match(/=+$/) || [''])[0].length;
  return Math.floor(s.length * 3 / 4) - pad;
}

function validate_(app) {
  var errors = [];
  var yesNo = ['Yes', 'No'];

  function req(key, label) {
    var v = clean_(app[key]);
    if (!v) { errors.push(label + ' is required.'); return ''; }
    if (v.length > CONFIG.MAX_TEXT_LENGTH) { errors.push(label + ' is too long.'); }
    app[key] = v;
    return v;
  }
  function reqYesNo(key, label) {
    var v = clean_(app[key]);
    if (yesNo.indexOf(v) === -1) { errors.push('Please answer: ' + label); }
    app[key] = v;
    return v;
  }

  req('firstName', 'First name');
  req('surname', 'Surname');
  req('location', 'Location');
  req('aboutYou', 'The most important thing we should know about you');
  req('bigDream', 'Your BIG dream');
  req('spiritualJourney', 'Your spiritual journey');
  req('whyJoin', 'Your motivation for joining');

  var age = Number(clean_(app.age));
  if (!isFinite(age) || age % 1 !== 0 || age < CONFIG.MIN_AGE || age > CONFIG.MAX_AGE) {
    errors.push('Applicants must be between ' + CONFIG.MIN_AGE + ' and ' + CONFIG.MAX_AGE + ' years old.');
  }
  app.age = age;

  var email = clean_(app.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { errors.push('Please enter a valid email address.'); }
  app.email = email;

  ['phone', 'whatsapp'].forEach(function (k) {
    var v = clean_(app[k]);
    var digits = v.replace(/\D/g, '');
    if (!/^[0-9+()\-\s.]+$/.test(v) || digits.length < 7 || digits.length > 16) {
      errors.push('Please enter a valid ' + (k === 'phone' ? 'phone' : 'WhatsApp') + ' number.');
    }
    app[k] = v;
  });

  var story = req('lifeStory', 'Your life story');
  if (story && wordCount_(story) > CONFIG.MAX_WORDS + CONFIG.WORD_TOLERANCE) {
    errors.push('Your life story must be ' + CONFIG.MAX_WORDS + ' words or fewer.');
  }

  if (reqYesNo('hasDiscipler', 'Have you ever had a formal Discipler?') === 'Yes') {
    req('disciplerExperience', 'When was that and how did it go');
    app.noDisciplerReason = '';
  } else if (app.hasDiscipler === 'No') {
    req('noDisciplerReason', 'Why not, and why now');
    app.disciplerExperience = '';
  }

  reqYesNo('lifeStoryMapped', 'Have you mapped out your life story?');
  reqYesNo('genogram', 'Have you drawn your Genogram?');
  if (reqYesNo('personalityTest', 'Have you taken a personality test?') === 'Yes') {
    req('personalityDetails', 'Which personality test and what were the results');
  } else { app.personalityDetails = ''; }
  reqYesNo('personalMission', 'Do you have a Personal Mission Statement?');
  reqYesNo('familyMission', 'Do you have a Family Mission Statement?');
  if (reqYesNo('valuesWorked', 'Have you worked through your personal values?') === 'Yes') {
    req('values', 'Your personal values');
  } else { app.values = ''; }

  var ratings = app.ratings && typeof app.ratings === 'object' ? app.ratings : {};
  RATING_FIELDS.forEach(function (r) {
    var n = Number(ratings[r.key]);
    if (!isFinite(n) || n % 1 !== 0 || n < 1 || n > 10) { errors.push('Please rate: ' + r.label); }
    ratings[r.key] = n;
  });
  app.ratings = ratings;

  var commit = Number(app.commitment);
  if (!isFinite(commit) || commit % 1 !== 0 || commit < 1 || commit > 10) {
    errors.push('Please rate your level of commitment from 1 to 10.');
  }
  app.commitment = commit;

  if (app.consent !== true) { errors.push('Please confirm the declaration before submitting.'); }

  var files = app.files && typeof app.files === 'object' ? app.files : {};
  Object.keys(FILE_RULES).forEach(function (k) {
    var f = files[k];
    var rule = FILE_RULES[k];
    if (!f || !f.data || !f.name) { errors.push('Please upload your ' + rule.noun + '.'); return; }
    if (rule.ext.indexOf(extOf_(f.name)) === -1) {
      errors.push('The ' + rule.noun + ' must be a ' + rule.ext.join(', ').toUpperCase() + ' file.');
    }
    if (approxBytes_(f.data) > CONFIG.MAX_FILE_BYTES) {
      errors.push('The ' + rule.noun + ' must be smaller than ' + Math.round(CONFIG.MAX_FILE_BYTES / 1048576) + ' MB.');
    }
  });

  // Anti-bot: a human cannot complete this form in a few seconds.
  if (typeof app.elapsedMs === 'number' && app.elapsedMs < CONFIG.MIN_SECONDS_ON_FORM * 1000) {
    errors.push('That was a little quick. Please review your answers and submit again.');
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (sheet) { return sheet; }
  var first = ss.getSheets()[0];
  // Reuse an untouched default tab, otherwise add a dedicated one.
  if (first && first.getLastRow() === 0) {
    first.setName(CONFIG.SHEET_NAME);
    return first;
  }
  return ss.insertSheet(CONFIG.SHEET_NAME);
}

function ensureHeaders_(sheet) {
  var cols = columns_();
  if (sheet.getLastRow() > 0) { return; }
  var range = sheet.getRange(1, 1, 1, cols.length);
  range.setValues([cols.map(function (c) { return c.h; })]);
  range.setFontWeight('bold').setBackground('#541854').setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
}

function isRepeat_(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) { return false; }
  var emailCol = 6;
  var values = sheet.getRange(2, emailCol, last - 1, 1).getValues();
  var target = String(email).toLowerCase();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === target) { return true; }
  }
  return false;
}

function writeRow_(sheet, ctx) {
  var cols = columns_();
  var row = sheet.getLastRow() + 1;
  var range = sheet.getRange(row, 1, 1, cols.length);
  // Plain-text format on text columns stops anything starting with = + - @ being read as a formula.
  range.setNumberFormats([cols.map(function (c) {
    return c.kind === 'text' ? '@' : (c.kind === 'date' ? 'yyyy-mm-dd hh:mm' : '0');
  })]);
  range.setValues([cols.map(function (c) { return c.get(ctx); })]);
  range.setVerticalAlignment('top');
}

/* ------------------------------------------------------------------ */
/* Drive                                                               */
/* ------------------------------------------------------------------ */

function getFolder_() {
  if (CONFIG.FOLDER_ID) { return DriveApp.getFolderById(CONFIG.FOLDER_ID); }
  var it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.FOLDER_NAME);
}

function safeName_(s) {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

function mimeFor_(ext) {
  var map = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
  };
  return map[ext] || 'application/octet-stream';
}

function saveFiles_(app, ref) {
  var folder = getFolder_();
  var links = {};
  Object.keys(FILE_RULES).forEach(function (k) {
    var f = app.files[k];
    var ext = extOf_(f.name);
    var fileName = [ref, safeName_(app.surname), safeName_(app.firstName), k].join('_') + '.' + ext;
    var blob = Utilities.newBlob(Utilities.base64Decode(f.data), mimeFor_(ext), fileName);
    links[k] = folder.createFile(blob).getUrl();
  });
  return links;
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function para_(s) {
  return esc_(s).replace(/\n/g, '<br>');
}

function renderTeamEmail_(ctx, sheetUrl) {
  var a = ctx.app;
  function row(label, value) {
    return '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b5a68;width:34%;vertical-align:top;font-size:13px">' + esc_(label) +
      '</td><td style="padding:8px 12px;border-bottom:1px solid #eee;vertical-align:top;font-size:14px">' + value + '</td></tr>';
  }
  function heading(t) {
    return '<h3 style="font-family:Georgia,serif;color:#541854;margin:26px 0 6px;font-size:17px">' + esc_(t) + '</h3>';
  }
  var ratings = RATING_FIELDS.map(function (r) { return row(r.label, esc_(a.ratings[r.key]) + ' / 10'); }).join('');
  var sum = 0; RATING_FIELDS.forEach(function (r) { sum += Number(a.ratings[r.key]); });
  var avg = (sum / RATING_FIELDS.length).toFixed(1);

  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1420;max-width:720px">' +
    '<div style="background:#541854;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffb866">The Shadrach Fellowship 2026/2027</div>' +
    '<div style="font-family:Georgia,serif;font-size:22px;margin-top:4px">New application: ' + esc_(a.firstName + ' ' + a.surname) + '</div>' +
    '<div style="font-size:13px;margin-top:4px;opacity:.85">Reference ' + esc_(ctx.ref) + (ctx.repeat ? ' &middot; <b style="color:#ffb866">Repeat submission from this email</b>' : '') + '</div></div>' +
    '<table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-top:0">' +
    heading('About the applicant') +
    row('Name', esc_(a.firstName + ' ' + a.surname)) + row('Age', esc_(a.age)) +
    row('Email', '<a href="mailto:' + esc_(a.email) + '">' + esc_(a.email) + '</a>') +
    row('Phone', esc_(a.phone)) + row('WhatsApp', esc_(a.whatsapp)) + row('Location', esc_(a.location)) +
    heading('Documents') +
    row('Recommendation letter', '<a href="' + esc_(ctx.links.recommendation) + '">Open file</a>') +
    row('CV', '<a href="' + esc_(ctx.links.cv) + '">Open file</a>') +
    heading('Commitment') +
    row('Commitment level', '<b>' + esc_(a.commitment) + ' / 10</b>') +
    row('Average self-rating', '<b>' + avg + ' / 10</b>') +
    '</table>' +
    heading('Life story') + '<p style="font-size:14px;line-height:1.6">' + para_(a.lifeStory) + '</p>' +
    heading('The most important thing to know') + '<p style="font-size:14px;line-height:1.6">' + para_(a.aboutYou) + '</p>' +
    heading('Discipleship and self-awareness') +
    '<table style="width:100%;border-collapse:collapse;border:1px solid #eee">' +
    row('Formal Discipler', esc_(a.hasDiscipler)) +
    (a.disciplerExperience ? row('When, and how it went', para_(a.disciplerExperience)) : '') +
    (a.noDisciplerReason ? row('Why not, and why now', para_(a.noDisciplerReason)) : '') +
    row('Mapped life story', esc_(a.lifeStoryMapped)) + row('Genogram drawn', esc_(a.genogram)) +
    row('Personality test taken', esc_(a.personalityTest)) +
    (a.personalityDetails ? row('Kind and results', para_(a.personalityDetails)) : '') +
    row('Personal Mission Statement', esc_(a.personalMission)) + row('Family Mission Statement', esc_(a.familyMission)) +
    row('Worked through values', esc_(a.valuesWorked)) +
    (a.values ? row('Values', para_(a.values)) : '') +
    '</table>' +
    heading('The BIG dream') + '<p style="font-size:14px;line-height:1.6">' + para_(a.bigDream) + '</p>' +
    heading('Life areas, self-rated out of 10') +
    '<table style="width:100%;border-collapse:collapse;border:1px solid #eee">' + ratings + '</table>' +
    heading('Spiritual journey') + '<p style="font-size:14px;line-height:1.6">' + para_(a.spiritualJourney) + '</p>' +
    heading('Why join the Fellowship') + '<p style="font-size:14px;line-height:1.6">' + para_(a.whyJoin) + '</p>' +
    '<p style="margin-top:28px;font-size:13px;color:#6b5a68">All responses are also in the <a href="' + esc_(sheetUrl) + '">response sheet</a>. ' +
    'Reply to this email to write directly to the applicant.</p>' +
    '<p style="font-size:12px;color:#9a8e98">Stored under ' + esc_(ownerEmail_()) + '. Files are in the Drive folder "' + esc_(CONFIG.FOLDER_NAME) + '".</p></div>';
}

function notifyTeam_(ctx, sheet) {
  var a = ctx.app;
  var sheetUrl = sheet.getParent().getUrl();
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    replyTo: a.email,
    name: CONFIG.SENDER_NAME,
    subject: 'New TSF 2026/2027 application: ' + a.firstName + ' ' + a.surname + ' (' + ctx.ref + ')' + (ctx.repeat ? ' [repeat]' : ''),
    htmlBody: renderTeamEmail_(ctx, sheetUrl),
    body: 'New application from ' + a.firstName + ' ' + a.surname + ' (' + ctx.ref + '). Open the response sheet to read it: ' + sheetUrl
  });
}

function renderConfirmation_(ctx) {
  var a = ctx.app;
  var text =
    'Dear ' + a.firstName + ',\n\n' +
    'Thank you for applying to The Shadrach Fellowship 2026/2027. We have received your application.\n\n' +
    'Your reference number is ' + ctx.ref + '. Please quote it if you write to us.\n\n' +
    'What happens next:\n' +
    '1. Your application is screened against the eligibility criteria.\n' +
    '2. Shortlisted applicants are contacted by email or WhatsApp.\n' +
    '3. Shortlisted applicants are interviewed by Dr. Yaw Perbi and Frank Koomson.\n' +
    '4. Final selections are communicated to every applicant.\n\n' +
    'Applications close on 20 November 2026. If you need to correct anything, simply reply to this email.\n\n' +
    'We are praying with you as you wait.\n\n' +
    'The Shadrach Fellowship Team\nThe HuD Group Global\n' + CONFIG.NOTIFY_EMAIL;
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1420;max-width:560px;line-height:1.65;font-size:15px">' +
    '<div style="background:#541854;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffb866">The Shadrach Fellowship 2026/2027</div>' +
    '<div style="font-family:Georgia,serif;font-size:22px;margin-top:4px">Application received</div></div>' +
    '<div style="border:1px solid #eee;border-top:0;padding:22px 24px;border-radius:0 0 10px 10px">' +
    text.split('\n\n').map(function (p) {
      if (p.indexOf('What happens next:') === 0) {
        var lines = p.split('\n');
        return '<p style="margin:0 0 6px"><b>' + esc_(lines[0]) + '</b></p><ol style="margin:0 0 14px;padding-left:20px">' +
          lines.slice(1).map(function (l) { return '<li>' + esc_(l.replace(/^\d+\.\s*/, '')) + '</li>'; }).join('') + '</ol>';
      }
      return '<p style="margin:0 0 14px">' + para_(p) + '</p>';
    }).join('') + '</div></div>';
  return { text: text, html: html };
}

function confirmApplicant_(ctx) {
  var mail = renderConfirmation_(ctx);
  MailApp.sendEmail({
    to: ctx.app.email,
    replyTo: CONFIG.NOTIFY_EMAIL,
    name: CONFIG.SENDER_NAME,
    subject: 'We have received your application (' + ctx.ref + ')',
    body: mail.text,
    htmlBody: mail.html
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function pad_(n, width) {
  var s = String(n);
  while (s.length < width) { s = '0' + s; }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ownerEmail_() {
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; }
}

/**
 * Run once from the editor. It refuses to finish unless the script is running as CONFIG.OWNER_EMAIL,
 * so the sheet, Drive folder and emails cannot end up in someone's personal account by mistake.
 */
function setupCheck() {
  var who = ownerEmail_().toLowerCase();
  if (who !== CONFIG.OWNER_EMAIL.toLowerCase()) {
    throw new Error('Wrong account. This script is running as ' + (who || 'an unknown account') + ' but must run as ' +
      CONFIG.OWNER_EMAIL + '. Sign in to Google as ' + CONFIG.OWNER_EMAIL + ', open the response sheet there, and set it up again.');
  }
  var sheet = getSheet_();
  ensureHeaders_(sheet);
  var folder = getFolder_();
  Logger.log('Account: ' + who + ' | Sheet tab: ' + sheet.getName() + ' | Drive folder: ' + folder.getUrl());
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'TSF application form: setup check', 'The application receiver is authorised and can send email.');
}

if (typeof module !== 'undefined') {
  module.exports = { validate_: validate_, setupCheck: setupCheck, columns_: columns_, wordCount_: wordCount_, CONFIG: CONFIG, RATING_FIELDS: RATING_FIELDS };
}
