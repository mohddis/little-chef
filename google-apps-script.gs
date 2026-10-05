/**
 * Little Chef booking requests -> Google Sheet
 *
 * 1. Create a new Google Sheet (e.g. "Little Chef Booking Requests").
 * 2. In the sheet: Extensions > Apps Script. Delete any code there and paste this file.
 * 3. Click Deploy > New deployment > Select type: Web app.
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Click Deploy, allow access, and copy the Web app URL.
 * 5. Paste that URL into index.html:  var FORM_ENDPOINT = "PASTE_URL_HERE";
 *
 * Every request from the website now appears as a new row, newest at the bottom.
 * Share the Google Sheet with your team so everyone can see the requests.
 */
var HEADERS = ['Submitted at','Booking for','School name','Contact name','Mobile','Email',
  'Children','Teachers / adults','Classes / ages','City','Preferred date','Second choice date',
  'Preferred time','Notes','Status','Page'];
var KEYS = ['submittedAt','bookingFor','schoolName','contactName','mobile','email',
  'children','staff','classes','city','preferredDate','alternateDate',
  'preferredTime','notes','','page'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#E2FF88');
      sheet.setFrozenRows(1);
    }
    var p = (e && e.parameter) || {};
    var row = KEYS.map(function (k) {
      if (k === '') return 'New request';
      var v = String(p[k] || '').slice(0, 1000);
      return /^[=+\-@]/.test(v) ? "'" + v : v;   // stop formula injection
    });
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
