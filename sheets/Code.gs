/**
 * Yglesia intake logger
 *
 * Writes to https://docs.google.com/spreadsheets/d/1zvz1KUXJ2atFsACpeVZIByk3dXGDYaUDeU_e-LhDIXE
 * 1. Open that spreadsheet. Extensions → Apps Script. Paste this file.
 * 2. Set SHEETS_SECRET to the same value as SHEETS_SECRET in Vercel / .env.local
 * 3. Deploy → New deployment (or Manage deployments → New version)
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web app URL into SHEETS_WEBHOOK_URL on Vercel.
 */

const SHEETS_SECRET = "CHANGE_ME";
const SHEET_ID = "1zvz1KUXJ2atFsACpeVZIByk3dXGDYaUDeU_e-LhDIXE";

function doGet() {
  return json({ ok: true, service: "yglesia-intake", sheet: SHEET_ID });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    Logger.log(
      "doPost type=" +
        (data.type || "turn") +
        " session=" +
        (data.sessionId || "") +
        " speaker=" +
        (data.speaker || "")
    );
    if (!SHEETS_SECRET || SHEETS_SECRET === "CHANGE_ME") {
      Logger.log("reject: SHEETS_SECRET is still CHANGE_ME");
      return json({ ok: false, error: "secret not set in Apps Script" });
    }
    if (data.secret !== SHEETS_SECRET) {
      Logger.log("reject: unauthorized");
      return json({ ok: false, error: "unauthorized" });
    }
    const ss = SpreadsheetApp.openById(SHEET_ID);
    if (data.type === "lead") {
      appendRow(ss, "Leads", [
        [
          "Timestamp",
          "Session",
          "Persona",
          "Name",
          "Email",
          "Phone",
          "Story",
          "Track",
          "Conversation",
        ],
        [
          data.timestamp || new Date().toISOString(),
          data.sessionId || "",
          data.persona || "",
          data.name || "",
          data.email || "",
          data.phone || "",
          data.story || "",
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
          "Email",
        ],
        [
          data.timestamp || new Date().toISOString(),
          data.sessionId || "",
          data.speaker || "",
          data.question || "",
          data.text || "",
          data.name || "",
          data.email || "",
        ],
      ]);
    }
    Logger.log("wrote " + (data.type === "lead" ? "Leads" : "Conversations"));
    return json({ ok: true });
  } catch (err) {
    Logger.log("error " + String(err));
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
