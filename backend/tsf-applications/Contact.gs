/**
 * Website contact form (contact.html)
 *
 * Same Apps Script project and web app as the application form: contact.html posts { kind: 'contact', ... }
 * and doPost in Code.gs hands it here. Each message is saved to the "Contact Messages" tab and emailed to
 * engage@thehudgroupglobal.org with Reply-To set to the sender, so the team can answer straight from the inbox.
 *
 * No automatic reply goes to the sender: anyone can type any address into a form, and an automatic reply
 * would let strangers use this account to email people who never wrote to us.
 */

var CONTACT = {
  TAB: 'Contact Messages',
  SUBJECTS: ['General Enquiry', 'The Shadrach Fellowship (TSF)', 'Partnership Opportunities', 'HuD Consult Services',
    'Giving and Donations', 'Country Chapter Enquiry', 'Media and Press', 'Other'],
  MAX_MESSAGE: 5000,
  MAX_FIELD: 120,
  DAILY_LIMIT: 150,
  MIN_SECONDS: 3
};

var CONTACT_COLS = ['Received', 'First Name', 'Last Name', 'Email', 'Country', 'Subject', 'Message', 'Status'];

function validateContact_(m) {
  var errors = [];
  function field(key, label, required, max) {
    var v = clean_(m[key]);
    if (required && !v) { errors.push(label + ' is required.'); }
    if (v.length > max) { errors.push(label + ' is too long.'); }
    m[key] = v;
  }
  field('firstName', 'First name', true, CONTACT.MAX_FIELD);
  field('lastName', 'Last name', true, CONTACT.MAX_FIELD);
  field('email', 'Email', true, CONTACT.MAX_FIELD);
  field('country', 'Country', false, CONTACT.MAX_FIELD);
  field('message', 'Message', true, CONTACT.MAX_MESSAGE);
  if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) { errors.push('Please enter a valid email address.'); }
  m.subject = CONTACT.SUBJECTS.indexOf(clean_(m.subject)) === -1 ? 'General Enquiry' : clean_(m.subject);
  if (typeof m.elapsedMs === 'number' && m.elapsedMs < CONTACT.MIN_SECONDS * 1000) {
    errors.push('That was a little quick. Please check your message and send it again.');
  }
  return errors;
}

function handleContact_(m) {
  // Honeypot: bots fill the hidden field. Pretend success, keep nothing.
  if (m.website) { return { ok: true }; }
  var errors = validateContact_(m);
  if (errors.length) { return { ok: false, error: errors[0], errors: errors }; }

  var cache = CacheService.getScriptCache();
  var dayKey = 'contact-' + new Date().toISOString().slice(0, 10);
  var count = Number(cache.get(dayKey) || 0);
  if (count >= CONTACT.DAILY_LIMIT) {
    return { ok: false, error: 'We are receiving a lot of messages today. Please email ' + CONFIG.NOTIFY_EMAIL + ' directly.' };
  }
  var dupKey = 'contact-dup-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, m.email.toLowerCase() + '|' + m.message)).slice(0, 40);
  if (cache.get(dupKey)) { return { ok: true }; } // the same message twice in a few minutes: keep the first only
  cache.put(dupKey, '1', 600);
  cache.put(dayKey, String(count + 1), 21600);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONTACT.TAB) || ss.insertSheet(CONTACT.TAB);
    if (sheet.getLastRow() === 0) {
      var h = sheet.getRange(1, 1, 1, CONTACT_COLS.length);
      h.setValues([CONTACT_COLS]);
      h.setFontWeight('bold').setBackground('#541854').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    var row = sheet.getLastRow() + 1;
    var range = sheet.getRange(row, 1, 1, CONTACT_COLS.length);
    range.setNumberFormats([CONTACT_COLS.map(function (c) { return c === 'Received' ? 'yyyy-mm-dd hh:mm' : '@'; })]);
    range.setValues([[new Date()].concat([m.firstName, m.lastName, m.email, m.country, m.subject, m.message, 'New'].map(safeText_))]);
    range.setVerticalAlignment('top');
  } finally {
    lock.releaseLock();
  }

  try {
    var name = m.firstName + ' ' + m.lastName;
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_EMAIL,
      replyTo: m.email,
      name: 'HuD Group website',
      subject: 'Website message: ' + m.subject + ' from ' + name,
      body: 'From: ' + name + ' <' + m.email + '>\nCountry: ' + (m.country || 'not given') + '\nTopic: ' + m.subject + '\n\n' + m.message +
        '\n\nReply to this email to answer ' + m.firstName + ' directly.',
      htmlBody: '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1420;max-width:600px;line-height:1.6;font-size:15px">' +
        '<div style="background:#541854;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">' +
        '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffb866">Website message</div>' +
        '<div style="font-family:Georgia,serif;font-size:20px;margin-top:4px">' + esc_(m.subject) + '</div></div>' +
        '<div style="border:1px solid #eee;border-top:0;padding:18px 20px;border-radius:0 0 10px 10px">' +
        '<p style="margin:0 0 4px"><b>' + esc_(name) + '</b> &lt;' + esc_(m.email) + '&gt;</p>' +
        '<p style="margin:0 0 14px;color:#6b5a68">' + esc_(m.country || 'Country not given') + '</p>' +
        '<p style="margin:0 0 14px">' + para_(m.message) + '</p>' +
        '<p style="margin:0;font-size:13px;color:#6b5a68">Reply to this email to answer ' + esc_(m.firstName) + ' directly. Every message is also kept in the "' + CONTACT.TAB + '" tab.</p></div></div>'
    });
  } catch (mailErr) {
    console.error('Contact email failed: ' + mailErr); // the message is already saved in the sheet
  }
  return { ok: true };
}

if (typeof module !== 'undefined') {
  module.exports = { handleContact_: handleContact_, validateContact_: validateContact_ };
}
