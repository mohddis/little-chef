/**
 * LITTLE CHEF BY PISTA HOUSE — Visit Planner backend (Google Apps Script)
 *
 * What it does
 *  - Saves every booking request from www.littlechefs.in into a Google Sheet ("Visits")
 *  - Powers the team Visit Planner (planner.html), protected by a team PIN
 *  - Sends a branded confirmation email to the school when the team confirms a visit
 *  - Powers the school's confirmation page (confirmation.html) and "We confirm" button
 *  - Stores blog posts written in the planner (Blog tab) and shows them on the website
 *
 * Setup (once) — full steps are in README.md
 *  1. Open your Google Sheet > Extensions > Apps Script. Paste this whole file. Save.
 *  2. Project Settings (gear icon) > Script Properties > Add:
 *        TEAM_PIN    = a PIN only your team knows (e.g. 6–8 digits)
 *        TEAM_EMAIL  = email that should get an alert for every new request (optional)
 *     Keep the PIN here only — never write it in the GitHub copy of this file.
 *  3. Run the function "setup" once (top toolbar) and allow the permissions.
 *  4. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone > Deploy.
 *  5. Copy the Web app URL into assets/config.js (API_URL) on GitHub.
 *  After any change to this file: Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 */

var SITE_URL = 'https://www.littlechefs.in';
var FACTORY_ADDRESS = 'Pista House Factory, Shamshabad, Sayyed Guda, Hyderabad, Telangana 501218';
var PHONE = '+91 91333 08091';
var SHEET_NAME = 'Visits';

var COLS = ['id', 'ref', 'status', 'source', 'submittedAt', 'bookingFor', 'schoolName', 'contactName',
  'mobile', 'email', 'children', 'staff', 'helpers', 'classes', 'city', 'preferredDate', 'alternateDate',
  'preferredTime', 'notes', 'visitDate', 'startTime', 'endTime', 'reportingTime', 'schoolNote',
  'internalNote', 'confirmedAt', 'emailSent', 'schoolAck', 'schoolAckAt', 'updatedAt'];

var EDITABLE = ['bookingFor', 'schoolName', 'contactName', 'mobile', 'email', 'children', 'staff', 'helpers',
  'classes', 'city', 'preferredDate', 'alternateDate', 'preferredTime', 'notes', 'visitDate', 'startTime',
  'endTime', 'reportingTime', 'schoolNote', 'internalNote'];

var STATUSES = ['Requested', 'Confirmed', 'Completed', 'Cancelled'];

// Actions anyone can call. Everything else needs a team sign-in.
var PUBLIC_ACTIONS = { submit: 1, ack: 1 };

var MAX_PIN_FAILS = 10;           // wrong PINs allowed before the planner locks...
var PIN_LOCK_SECONDS = 15 * 60;   // ...for this long (run unlockPlanner to clear it sooner)
var SESSION_SECONDS = 6 * 60 * 60; // a planner sign-in lasts 6 hours of inactivity at most
var MAX_REQUESTS_PER_HOUR = 30;   // website booking requests accepted per hour, across everyone

/* ---------- entry points ---------- */

function setup() {
  getSheet_();
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TEAM_PIN')) {
    throw new Error('Add TEAM_PIN in Project Settings > Script Properties, then run setup again.');
  }
  // Touch MailApp so the email permission is requested during setup.
  MailApp.getRemainingDailyQuota();
  getBlogSheet_();
  blogFolder_(); // asks for Google Drive permission (blog photos are stored in Drive)
  Logger.log('Setup complete. Now Deploy > New deployment > Web app.');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'booking') return out_(publicView_(p.id));
    if (p.action === 'posts') return out_({ ok: true, posts: blogAll_().filter(function (x) { return x.status === 'Published'; }).map(blogStrip_) });
    return out_({ ok: true, service: 'Little Chef API' });
  } catch (err) {
    return out_(fail_(err));
  }
}

function doPost(e) {
  var b;
  try {
    b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return out_({ ok: false, error: 'Bad request' });
  }
  if (!b || typeof b !== 'object') return out_({ ok: false, error: 'Bad request' });
  // Team sign-in is checked before taking the lock, so wrong-PIN delays never hold up school bookings.
  try {
    if (b.action === 'login') return out_(login_(b.pin));
    if (b.action === 'logout') { endSession_(b.token); return out_({ ok: true }); }
    if (!PUBLIC_ACTIONS[b.action]) auth_(b);
  } catch (err) {
    return out_(fail_(err));
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    switch (b.action) {
      case 'submit': return out_(submit_(b.data || {}));
      case 'ack': return out_(ack_(b.id));
      case 'list': return out_({ ok: true, visits: readAll_().map(strip_) });
      case 'save': return out_(save_(b.visit || {}, !!b.sendEmail));
      case 'status': return out_(setStatus_(b.id, b.status));
      case 'delete': return out_(del_(b.id));
      case 'blogList': return out_({ ok: true, posts: blogAll_().map(blogStrip_) });
      case 'blogSave': return out_(blogSave_(b.post || {}));
      case 'blogDelete': return out_(blogDelete_(b.id));
      case 'upload': return out_(upload_(b));
      default: return out_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return out_(fail_(err));
  } finally {
    lock.releaseLock();
  }
}

/* ---------- actions ---------- */

function submit_(d) {
  if (d.company_site) return { ok: true, ref: 'LC-OK' }; // spam trap: bots fill this hidden field
  if (!underLimit_('submit', MAX_REQUESTS_PER_HOUR, 3600)) {
    return { ok: false, error: 'We are receiving a lot of requests right now. Please call or WhatsApp us on ' + PHONE + '.' };
  }
  var name = clean_(d.contactName, 80);
  var mobile = clean_(d.mobile, 20);
  if (!name || mobile.replace(/\D/g, '').length < 8) return { ok: false, error: 'Please add a name and a valid mobile number.' };
  var now = now_();
  var o = { id: Utilities.getUuid(), ref: nextRef_(), status: 'Requested', source: 'Website', submittedAt: now, updatedAt: now };
  ['bookingFor', 'schoolName', 'contactName', 'mobile', 'email', 'children', 'staff', 'classes', 'city',
    'preferredDate', 'alternateDate', 'preferredTime', 'notes'].forEach(function (k) {
    o[k] = clean_(d[k], k === 'notes' ? 1000 : 160);
  });
  if (!o.bookingFor) o.bookingFor = 'School';
  write_(o);
  notifyTeam_('New Little Chef request ' + o.ref + ': ' + (o.schoolName || o.contactName),
    [['Reference', o.ref], ['Booking for', o.bookingFor], ['School', o.schoolName], ['Contact', o.contactName],
      ['Mobile', o.mobile], ['Email', o.email], ['Children', o.children], ['Teachers / adults', o.staff],
      ['Classes / ages', o.classes], ['City', o.city], ['Preferred date', o.preferredDate + (o.alternateDate ? ' (or ' + o.alternateDate + ')' : '')],
      ['Time', o.preferredTime], ['Notes', o.notes]]);
  return { ok: true, ref: o.ref };
}

function save_(v, sendEmail) {
  var all = readAll_();
  var o = v.id ? find_(all, v.id) : null;
  if (v.id && !o) return { ok: false, error: 'Visit not found. Refresh the planner.' };
  var now = now_();
  if (!o) o = { id: Utilities.getUuid(), ref: nextRef_(), source: 'Team', submittedAt: now, status: 'Requested' };
  EDITABLE.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = clean_(v[k], /note/i.test(k) ? 1000 : 160);
  });
  if (v.status && STATUSES.indexOf(v.status) > -1) o.status = v.status;
  if (o.status === 'Confirmed' && !o.confirmedAt) o.confirmedAt = now;
  o.updatedAt = now;
  var emailed = false, emailError = '';
  if (sendEmail && o.status === 'Confirmed') {
    if (!o.email) emailError = 'No email address for this school.';
    else {
      try { sendConfirmation_(o); o.emailSent = now; emailed = true; }
      catch (err) { emailError = String(err.message || err); }
    }
  }
  write_(o);
  return { ok: true, visit: strip_(o), link: link_(o), emailed: emailed, emailError: emailError };
}

function setStatus_(id, status) {
  if (STATUSES.indexOf(status) < 0) return { ok: false, error: 'Unknown status' };
  var o = find_(readAll_(), id);
  if (!o) return { ok: false, error: 'Visit not found' };
  o.status = status;
  if (status === 'Confirmed' && !o.confirmedAt) o.confirmedAt = now_();
  o.updatedAt = now_();
  write_(o);
  return { ok: true, visit: strip_(o) };
}

function del_(id) {
  var o = find_(readAll_(), id);
  if (!o) return { ok: false, error: 'Visit not found' };
  getSheet_().deleteRow(o._row);
  return { ok: true };
}

function ack_(id) {
  var o = find_(readAll_(), id);
  if (!o || o.status !== 'Confirmed') return { ok: false, error: 'This booking is not open for confirmation.' };
  if (!o.schoolAck) {
    o.schoolAck = 'Yes';
    o.schoolAckAt = now_();
    o.updatedAt = o.schoolAckAt;
    write_(o);
    notifyTeam_('School confirmed: ' + (o.schoolName || o.contactName) + ' — ' + o.visitDate,
      [['Reference', o.ref], ['School', o.schoolName], ['Visit date', o.visitDate], ['Confirmed by school at', o.schoolAckAt]]);
  }
  return { ok: true, booking: publicFields_(o) };
}

function publicView_(id) {
  var o = find_(readAll_(), id);
  if (!o) return { ok: false, error: 'Booking not found' };
  return { ok: true, booking: publicFields_(o) };
}


/* ---------- blog ---------- */

var BLOG_SHEET = 'Blog';
var BLOG_COLS = ['id', 'slug', 'status', 'date', 'title', 'category', 'author', 'cover', 'excerpt', 'body', 'updatedAt'];

function getBlogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(BLOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(BLOG_SHEET);
    sh.getRange(1, 1, 1, BLOG_COLS.length).setValues([BLOG_COLS]).setFontWeight('bold').setBackground('#C2F9FF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function blogAll_() {
  var sh = getBlogSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, BLOG_COLS.length).getDisplayValues();
  var out = [];
  vals.forEach(function (r, i) {
    if (!r[0]) return;
    var o = { _row: i + 2 };
    BLOG_COLS.forEach(function (c, j) { o[c] = r[j]; });
    out.push(o);
  });
  return out;
}

function blogStrip_(o) {
  var c = {};
  BLOG_COLS.forEach(function (k) { c[k] = o[k] == null ? '' : o[k]; });
  return c;
}

function slugify_(t) {
  return String(t || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'post';
}

function blogSave_(p) {
  var all = blogAll_();
  var o = null;
  if (p.id) { for (var i = 0; i < all.length; i++) if (all[i].id === p.id) o = all[i]; }
  if (p.id && !o) return { ok: false, error: 'Post not found. Refresh the planner.' };
  if (!clean_(p.title, 160)) return { ok: false, error: 'Please add a title.' };
  if (!o) o = { id: Utilities.getUuid() };
  ['title', 'category', 'author', 'cover', 'excerpt', 'date'].forEach(function (k) { if (k in p) o[k] = clean_(p[k], k === 'excerpt' ? 400 : 300); });
  if ('body' in p) o.body = String(p.body || '').slice(0, 45000);
  if (o.cover && !/^(https:\/\/|assets\/)/.test(o.cover)) o.cover = ''; // only web (https) or site images
  o.status = p.status === 'Published' ? 'Published' : 'Draft';
  if (!o.date) o.date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  if (!o.slug) {
    var base = slugify_(o.title), slug = base, n = 2;
    var taken = function (s) { return all.some(function (x) { return x.slug === s && x.id !== o.id; }); };
    while (taken(slug)) slug = base + '-' + (n++);
    o.slug = slug;
  }
  o.updatedAt = now_();
  var sh = getBlogSheet_();
  var row = o._row || sh.getLastRow() + 1;
  var vals = BLOG_COLS.map(function (c) { var v = o[c] == null ? '' : String(o[c]); return /^[=+\-@]/.test(v) ? "'" + v : v; });
  sh.getRange(row, 1, 1, BLOG_COLS.length).setNumberFormat('@').setValues([vals]);
  o._row = row;
  return { ok: true, post: blogStrip_(o) };
}

function blogDelete_(id) {
  var all = blogAll_();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) { getBlogSheet_().deleteRow(all[i]._row); return { ok: true }; }
  return { ok: false, error: 'Post not found' };
}

function blogFolder_() {
  var name = 'Little Chef Blog Images';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function upload_(b) {
  var mime = String(b.mime || '');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { ok: false, error: 'Please upload a JPG, PNG or WebP image.' };
  var data = String(b.data || '');
  if (data.length > 6 * 1024 * 1024) return { ok: false, error: 'Image is too large (max 4 MB).' };
  var bytes = Utilities.base64Decode(data);
  if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: 'Image is too large (max 4 MB).' };
  var file = blogFolder_().createFile(Utilities.newBlob(bytes, mime, clean_(b.name, 80) || 'blog-image'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://lh3.googleusercontent.com/d/' + file.getId() };
}

/* ---------- email ---------- */

function sendConfirmation_(o) {
  var who = o.schoolName || o.contactName;
  var rows = [
    ['Date', dateLong_(o.visitDate)],
    ['Time', range_(o.startTime, o.endTime)],
    ['Students', o.children],
    ['Teachers / adults', o.staff],
    ['Classes', o.classes],
    ['Venue', FACTORY_ADDRESS]
  ].filter(function (r) { return r[1]; });
  var table = rows.map(function (r) {
    return '<tr><td style="padding:8px 12px;color:#3D56A6;font-weight:700;white-space:nowrap">' + esc_(r[0]) +
      '</td><td style="padding:8px 12px;color:#1336A3;font-weight:700">' + esc_(r[1]) + '</td></tr>';
  }).join('');
  var link = link_(o);
  var html =
    '<div style="background:#C2F9FF;padding:24px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;background:#FFF5E1;border:3px solid #1336A3;border-radius:22px;overflow:hidden">' +
    '<div style="background:#1336A3;color:#fff;padding:20px 24px"><div style="font-size:13px;color:#E2FF88;font-weight:700">LITTLE CHEF BY PISTA HOUSE</div>' +
    '<div style="font-size:24px;font-weight:800;margin-top:4px">Your visit is confirmed! &#127850;</div></div>' +
    '<div style="padding:22px 24px;color:#1336A3;font-size:15px;line-height:1.55">' +
    '<p style="margin:0 0 14px">Dear ' + esc_(o.contactName || 'Coordinator') + ',</p>' +
    '<p style="margin:0 0 16px">We are delighted to confirm the Little Chef Factory Experience for <b>' + esc_(who) + '</b>.</p>' +
    '<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:14px">' + table + '</table>' +
    (o.schoolNote ? '<p style="margin:16px 0 0;padding:12px 14px;background:#E2FF88;border-radius:12px"><b>Note from our team:</b> ' + esc_(o.schoolNote) + '</p>' : '') +
    '<p style="margin:20px 0 8px">Please tap below to view your booking and confirm your attendance:</p>' +
    '<p style="margin:0 0 18px"><a href="' + link + '" style="display:inline-block;background:#1336A3;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:999px">View &amp; confirm booking</a></p>' +
    '<p style="margin:0">For any help, call or WhatsApp us on <b>' + PHONE + '</b>.</p>' +
    '<p style="margin:18px 0 0">Bake &bull; Learn &bull; Smile<br><b>Team Little Chef by Pista House</b></p>' +
    '</div></div></div>';
  var opts = { to: o.email, subject: 'Confirmed: Little Chef Factory Experience on ' + dateShort_(o.visitDate), htmlBody: html, name: 'Little Chef by Pista House' };
  var team = PropertiesService.getScriptProperties().getProperty('TEAM_EMAIL');
  if (team) opts.replyTo = team;
  MailApp.sendEmail(opts);
}

function notifyTeam_(subject, rows) {
  var team = PropertiesService.getScriptProperties().getProperty('TEAM_EMAIL');
  if (!team) return;
  var body = rows.filter(function (r) { return r[1]; }).map(function (r) {
    return '<tr><td style="padding:4px 10px;color:#555">' + esc_(r[0]) + '</td><td style="padding:4px 10px"><b>' + esc_(r[1]) + '</b></td></tr>';
  }).join('');
  try {
    MailApp.sendEmail({ to: team, subject: subject, name: 'Little Chef Website',
      htmlBody: '<table style="font-family:Arial;font-size:14px">' + body + '</table><p><a href="' + SITE_URL + '/planner.html">Open the Visit Planner</a></p>' });
  } catch (err) { /* never block a booking because of email */ }
}

/* ---------- sheet helpers ---------- */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#E2FF88');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, COLS.length).getDisplayValues();
  var out = [];
  vals.forEach(function (r, i) {
    if (!r[0]) return;
    var o = { _row: i + 2 };
    COLS.forEach(function (c, j) { o[c] = r[j]; });
    out.push(o);
  });
  return out;
}

function write_(o) {
  var sh = getSheet_();
  var row = o._row || sh.getLastRow() + 1;
  var vals = COLS.map(function (c) {
    var v = o[c] == null ? '' : String(o[c]);
    return /^[=+\-@]/.test(v) ? "'" + v : v;
  });
  sh.getRange(row, 1, 1, COLS.length).setNumberFormat('@').setValues([vals]);
  o._row = row;
}

function find_(all, id) {
  if (!id) return null;
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}

function strip_(o) {
  var c = {};
  COLS.forEach(function (k) { c[k] = o[k] == null ? '' : o[k]; });
  return c;
}

function publicFields_(o) {
  return {
    ref: o.ref, status: o.status, bookingFor: o.bookingFor, schoolName: o.schoolName,
    contactName: String(o.contactName || '').split(' ')[0], visitDate: o.visitDate || o.preferredDate,
    startTime: o.startTime, endTime: o.endTime, students: o.children, teachers: o.staff,
    classes: o.classes, schoolNote: o.schoolNote, schoolAck: o.schoolAck, schoolAckAt: o.schoolAckAt
  };
}

/* ---------- team sign-in ---------- */

// Accepts a session token from login_ (preferred) or the team PIN itself (older planner pages).
function auth_(b) {
  if (b.token && sessionValid_(b.token)) return;
  if (b.token && !b.pin) {
    var e = new Error('Your planner session has ended. Please enter the team PIN again.'); e.code = 'AUTH'; throw e;
  }
  checkPin_(b.pin);
}

function checkPin_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty('TEAM_PIN');
  if (!real) { var e1 = new Error('TEAM_PIN is not set in Script Properties.'); e1.code = 'SETUP'; throw e1; }
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pinFails') || 0);
  if (fails >= MAX_PIN_FAILS) {
    var e3 = new Error('Too many wrong PINs. The planner is locked for 15 minutes. Please try again later.'); e3.code = 'LOCKED'; throw e3;
  }
  if (!sameText_(String(pin || ''), String(real))) {
    cache.put('pinFails', String(fails + 1), PIN_LOCK_SECONDS);
    Utilities.sleep(1000);
    var e2 = new Error('Wrong PIN'); e2.code = 'AUTH'; throw e2;
  }
  cache.remove('pinFails');
}

function login_(pin) {
  checkPin_(pin);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('session:' + token, '1', SESSION_SECONDS);
  return { ok: true, token: token };
}

function sessionValid_(token) {
  token = String(token || '');
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  var cache = CacheService.getScriptCache();
  if (!cache.get('session:' + token)) return false;
  cache.put('session:' + token, '1', SESSION_SECONDS); // keep an active session alive
  return true;
}

function endSession_(token) {
  token = String(token || '');
  if (/^[0-9a-f]{64}$/.test(token)) CacheService.getScriptCache().remove('session:' + token);
}

// Run this from the Apps Script editor to unlock the planner after too many wrong PINs.
function unlockPlanner() {
  CacheService.getScriptCache().remove('pinFails');
  Logger.log('Planner unlocked.');
}

// Compares two strings in constant time, so response timing does not reveal the PIN.
function sameText_(a, b) {
  var x = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, a, Utilities.Charset.UTF_8);
  var y = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b, Utilities.Charset.UTF_8);
  var diff = 0;
  for (var i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Counts calls per time window; returns false once the window's limit is used up.
function underLimit_(key, max, seconds) {
  var cache = CacheService.getScriptCache();
  var bucket = 'rate:' + key + ':' + Math.floor(Date.now() / (seconds * 1000));
  var n = Number(cache.get(bucket) || 0) + 1;
  cache.put(bucket, String(n), seconds + 60);
  return n <= max;
}

// Errors we raise on purpose (with a code) are shown as they are; anything unexpected
// is logged for the owner and returned as a plain message, so internals are never exposed.
function fail_(err) {
  if (err && err.code) return { ok: false, error: String(err.message), code: err.code };
  console.error(err && err.stack ? err.stack : err);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

function nextRef_() {
  var p = PropertiesService.getScriptProperties();
  var n = Number(p.getProperty('SEQ') || 0) + 1;
  p.setProperty('SEQ', String(n));
  return 'LC-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMM') + '-' + ('000' + n).slice(-3);
}

function link_(o) { return SITE_URL + '/confirmation.html?id=' + encodeURIComponent(o.id); }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm'); }
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function parseDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}
function dateLong_(s) { var d = parseDate_(s); return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE, d MMMM yyyy') : s; }
function dateShort_(s) { var d = parseDate_(s); return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'd MMM yyyy') : s; }
function time12_(t) {
  var m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return t || '';
  var h = Number(m[1]), ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m[2] + ' ' + ap;
}
function range_(a, b) { return a ? time12_(a) + (b ? ' to ' + time12_(b) : '') : ''; }
