const OPENER = "Which of these is closest to you?";
const CHIPS = [
  "I'm a barista who needs support",
  "I'm a barista who needs prayer",
  "I'm a barista who wants to start a coffee shop",
  "I own a coffee shop and want it to become a mission",
  "I'm from a church that wants a coffee shop",
  "I'm with a mission that wants to open a coffee shop",
  "I want to empower missionaries",
];

function newSession() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "s-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

const state = {
  sessionId: newSession(),
  turns: [{ q: OPENER, a: "" }],
  draft: "",
  thinking: false,
  result: null,
  failed: false,
  chips: CHIPS,
  chipsOnly: true,
  phase: "category",
};

const els = {
  turns: document.getElementById("turns"),
  thinking: document.getElementById("thinking"),
  ask: document.getElementById("ask"),
  askRow: document.querySelector(".ask-row"),
  chips: document.getElementById("chips"),
  draft: document.getElementById("draft"),
  result: document.getElementById("result"),
  resultKicker: document.getElementById("result-kicker"),
  resultTrack: document.getElementById("result-track"),
  resultWhy: document.getElementById("result-why"),
  resultBook: document.getElementById("book"),
  fail: document.getElementById("fail"),
};

function placeholderFor() {
  if (state.phase === "story") return "Tell us what’s going on";
  if (state.phase === "contact") return "Type your answer";
  return "Type your answer";
}

function render() {
  els.turns.innerHTML = state.turns
    .map(
      (t) =>
        `<div class="turn"><p class="q">${escapeHtml(t.q)}</p>${
          t.a
            ? `<p class="a"><span class="a-who">You</span> ${escapeHtml(t.a)}</p>`
            : ""
        }</div>`
    )
    .join("");

  const asking = !state.result && !state.thinking && !state.failed;
  const chips = state.chips;

  els.thinking.classList.toggle("hidden", !state.thinking);
  els.ask.classList.toggle("hidden", !asking);
  els.result.classList.toggle("hidden", !state.result);
  els.fail.classList.toggle("hidden", !state.failed);

  const showInput = asking && !state.chipsOnly;
  els.askRow.classList.toggle("hidden", !showInput);
  els.draft.placeholder = placeholderFor();
  els.draft.classList.toggle("story-box", state.phase === "story");

  if (asking && chips && chips.length) {
    els.chips.classList.remove("hidden");
    els.chips.innerHTML = chips
      .map(
        (label) =>
          `<button type="button" class="tag tag-outline" data-chip="${escapeAttr(
            label
          )}">${escapeHtml(label)}</button>`
      )
      .join("");
  } else {
    els.chips.classList.add("hidden");
    els.chips.innerHTML = "";
  }

  if (state.result) {
    els.resultKicker.textContent = state.result.kicker;
    els.resultTrack.textContent = state.result.track;
    els.resultWhy.textContent = state.result.why;
    els.resultBook.textContent = "Book a call with " + state.result.person;
    const subject = "Yglesia — book a call";
    els.resultBook.href =
      "mailto:hello@yglesia.org?subject=" + encodeURIComponent(subject);
  }

  els.draft.value = state.draft;
  if (showInput) els.draft.focus();
}

async function send(text) {
  const answer = (text ?? (state.draft || els.draft.value)).trim();
  if (!answer || state.thinking) return;
  state.turns = state.turns.map((t, i) =>
    i === state.turns.length - 1 ? { ...t, a: answer } : t
  );
  state.draft = "";
  state.thinking = true;
  state.failed = false;
  state.chips = null;
  state.chipsOnly = false;
  render();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        turns: state.turns,
      }),
      signal: AbortSignal.timeout(28000),
    });
    const data = await res.json().catch(() => ({}));
    console.log("[yglesia] chat", {
      status: res.status,
      phase: data.phase,
      done: data.done,
      sheets: data.sheets,
      question: data.question || null,
    });
    if (data.sheets && data.sheets.writes) {
      for (const write of data.sheets.writes) {
        if (write.ok) console.log("[yglesia] sheet saved", write);
        else console.warn("[yglesia] sheet write failed", write);
      }
    } else {
      console.warn("[yglesia] no sheets status on this reply");
    }
    if (!res.ok) throw new Error(data.error || "request failed");
    if (data.done && data.result) {
      state.result = data.result;
      state.phase = "done";
    } else if (data.question) {
      state.turns = [...state.turns, { q: data.question, a: "" }];
      state.chips = Array.isArray(data.chips) ? data.chips : null;
      state.chipsOnly = Boolean(data.chipsOnly);
      state.phase = data.phase || "story";
    } else {
      throw new Error("empty reply");
    }
  } catch (err) {
    console.error("[yglesia] chat failed", err);
    state.failed = true;
  }
  state.thinking = false;
  render();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

document.getElementById("send").addEventListener("click", () => send());
els.draft.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
els.draft.addEventListener("input", (e) => {
  state.draft = e.target.value;
});
els.chips.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chip]");
  if (btn) send(btn.getAttribute("data-chip"));
});
document.getElementById("reset").addEventListener("click", () => {
  state.sessionId = newSession();
  state.turns = [{ q: OPENER, a: "" }];
  state.draft = "";
  state.thinking = false;
  state.result = null;
  state.failed = false;
  state.chips = CHIPS;
  state.chipsOnly = true;
  state.phase = "category";
  render();
});

const video = document.getElementById("hero-video");
if (video) {
  video.muted = true;
  video.playsInline = true;
  const tryPlay = () => video.play().catch(() => {});
  if (video.readyState >= 2) tryPlay();
  else video.addEventListener("canplay", tryPlay, { once: true });
}

fetch("/api/chat")
  .then((res) => res.json())
  .then((data) => {
    console.log("[yglesia] api", data);
    if (!data.sheets) {
      console.warn(
        "[yglesia] sheets: SHEETS_WEBHOOK_URL or SHEETS_SECRET is missing on the server"
      );
    }
  })
  .catch((err) => console.error("[yglesia] api check failed", err));

render();
