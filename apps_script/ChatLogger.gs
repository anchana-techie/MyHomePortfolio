/**
 * ChatLogger.gs - saves every portfolio chat exchange to a Google Sheet.
 *
 * The Render backend (main.py) POSTs one JSON object per exchange:
 *   { secret, ip_address, timestamp, message, response }
 * and this web app appends it as a row in the "ChatLogs" tab.
 *
 * Setup (about 5 minutes):
 *  1. Create a Google Sheet, e.g. "Portfolio Chat Logs".
 *  2. Extensions -> Apps Script. Delete the sample code and paste this file.
 *  3. Project Settings (gear icon) -> Script properties -> add two:
 *       LOG_SECRET = <any long random text>
 *       SHEET_ID   = <the sheet's ID: the part of its address between
 *                     /d/ and /edit>
 *  4. Deploy -> New deployment -> type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *     Click Deploy, allow access, and copy the Web app URL.
 *  5. In Render -> your service -> Environment, add:
 *       LOG_SHEET_WEBHOOK_URL = <the Web app URL>
 *       LOG_SHEET_SECRET      = <the same text as LOG_SECRET>
 *     Save; Render redeploys and logging starts.
 *
 * "Anyone" access only lets someone *send* rows if they know the secret;
 * nobody can read the sheet unless you share it.
 */

var SHEET_NAME = 'ChatLogs';
var HEADERS = ['Timestamp (UTC)', 'IP address', 'Question', 'Answer'];

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'bad json' });
  }

  var expected = PropertiesService.getScriptProperties().getProperty('LOG_SECRET');
  if (!expected || data.secret !== expected) {
    return reply_({ ok: false, error: 'forbidden' });
  }

  var sheet = getSheet_();
  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.ip_address || '',
    clip_(data.message),
    clip_(data.response)
  ]);
  return reply_({ ok: true });
}

// Lets you open the Web app URL in a browser to check it is deployed.
function doGet() {
  return reply_({ ok: true, service: 'portfolio chat logger' });
}

function getSheet_() {
  // SHEET_ID (Script property) = the long ID in the sheet's address bar,
  // between /d/ and /edit. If it isn't set, use the sheet this script was
  // opened from (Extensions -> Apps Script).
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = sheetId ? SpreadsheetApp.openById(sheetId.trim())
                   : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Set the SHEET_ID script property to your Google Sheet ID.');
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

// A single cell holds at most 50,000 characters.
function clip_(value) {
  var text = String(value == null ? '' : value);
  // A leading "=" would be run as a formula; prefix it so it stays text.
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text.length > 45000 ? text.slice(0, 45000) + '…' : text;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
