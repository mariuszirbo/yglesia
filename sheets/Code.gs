/**
 * Yglesia intake logger
 *
 * 1. Create a Google Sheet (or open yours).
 * 2. Extensions → Apps Script. Delete the starter code. Paste this file.
 * 3. Set SHEETS_SECRET below to the same value as SHEETS_SECRET in Vercel / .env.local
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL into SHEETS_WEBHOOK_URL.
 */

const SHEETS_SECRET = "CHANGE_ME";

function doGet() {
  return json({ ok: true, service: "yglesia-intake" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    if (!SHEETS_SECRET || data.secret !== SHEETS_SECRET) {
      return json({ ok: false, error: "unauthorized" });
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (data.type === "lead") {
      appendRow(ss, "Leads", [
        [
          "Timestamp",
          "Session",
          "Persona",
          "Name",
          "Country",
          "Organisation",
          "Area",
          "Help",
          "Track",
          "Conversation",
        ],
        [
          data.timestamp || new Date().toISOString(),
          data.sessionId || "",
          data.persona || "",
          data.name || "",
          data.country || "",
          data.organisation || "",
          data.area || "",
          data.help || "",
          data.track || "",
          data.transcript || "",
        ],
      ]);
    } else {
      appendRow(ss, "Conversations", [
        [
          "Timestamp",
          "Session",
          "Speaker",
          "Question",
          "Text",
          "Name",
          "Country",
        ],
        [
          data.timestamp || new Date().toISOString(),
          data.sessionId || "",
          data.speaker || "",
          data.question || "",
          data.text || "",
          data.name || "",
          data.country || "",
        ],
      ]);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function appendRow(ss, title, pair) {
  const [headers, values] = pair;
  let sheet = ss.getSheetByName(title);
  if (!sheet) {
    sheet = ss.insertSheet(title);
    sheet.appendRow(headers);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  sheet.appendRow(values);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
