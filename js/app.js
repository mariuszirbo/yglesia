const OPENER = "Where are you, and what are you trying to start?";
const CHIPS = [
  "I already run a coffee shop",
  "I'm a barista who wants my own bar",
  "I'm from a church",
  "I'm a missionary abroad",
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
};

const els = {
  turns: document.getElementById("turns"),
  thinking: document.getElementById("thinking"),
  ask: document.getElementById("ask"),
  chips: document.getElementById("chips"),
  draft: document.getElementById("draft"),
  result: document.getElementById("result"),
  resultKicker: document.getElementById("result-kicker"),
  resultTrack: document.getElementById("result-track"),
  resultWhy: document.getElementById("result-why"),
  resultBook: document.getElementById("book"),
  fail: document.getElementById("fail"),
};

function render() {
  els.turns.innerHTML = state.turns
    .map(
      (t) =>
        `<div class="turn"><p class="q">${escapeHtml(t.q)}</p>${
          t.a ? `<p class="a">${escapeHtml(t.a)}</p>` : ""
        }</div>`
    )
    .join("");

  const asking = !state.result && !state.thinking && !state.failed;
  const first = state.turns.length === 1 && !state.turns[0].a;
  const chips = first ? CHIPS : state.chips;

  els.thinking.classList.toggle("hidden", !state.thinking);
  els.ask.classList.toggle("hidden", !asking);
  els.result.classList.toggle("hidden", !state.result);
  els.fail.classList.toggle("hidden", !state.failed);

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
      "mailto:hello@yglesia.com?subject=" + encodeURIComponent(subject);
  }

  els.draft.value = state.draft;
}

async function send(text) {
  const answer = (text ?? state.draft).trim();
  if (!answer || state.thinking) return;
  state.turns = state.turns.map((t, i) =>
    i === state.turns.length - 1 ? { ...t, a: answer } : t
  );
  state.draft = "";
  state.thinking = true;
  state.failed = false;
  state.chips = null;
  render();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        turns: state.turns,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "request failed");
    if (data.done && data.result) {
      state.result = data.result;
    } else if (data.question) {
      state.turns = [...state.turns, { q: data.question, a: "" }];
      state.chips = Array.isArray(data.chips) ? data.chips : null;
    } else {
      throw new Error("empty reply");
    }
  } catch (err) {
    console.error(err);
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
  if (e.key === "Enter") {
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
  render();
  els.draft.focus();
});

const video = document.getElementById("hero-video");
if (video) {
  video.muted = true;
  video.playsInline = true;
  const tryPlay = () => video.play().catch(() => {});
  if (video.readyState >= 2) tryPlay();
  else video.addEventListener("canplay", tryPlay, { once: true });
}

render();
