const OPENER = "Where are you, and what are you trying to start?";
const CHIPS = [
  "I already run a coffee shop",
  "I'm a barista who wants my own bar",
  "I'm from a church",
  "I'm a missionary abroad",
];

const FOLLOWUPS = [
  "Who would stand behind the bar with you?",
  "What city are you thinking about?",
];

const TRACKS = [
  {
    keys: ["shop", "owner", "already run", "cafe", "café"],
    kicker: "Where you fit",
    track: "Owner track — team training",
    person: "Dani, owner coach",
    why: "The first call covers your current bar, the team you already have, and a weekly rhythm that turns regulars into relationships without burning people out.",
  },
  {
    keys: ["barista", "own bar", "open"],
    kicker: "Where you fit",
    track: "Barista track — open a shop",
    person: "Sam, startup coach",
    why: "We start with a small-shop plan: numbers, site, and a sending community so you are not inventing the business alone.",
  },
  {
    keys: ["church", "pastor", "congregation", "parish"],
    kicker: "Where you fit",
    track: "Church track — a daily door",
    person: "Leah, church partner",
    why: "The first call is a feasibility check: neighbourhood, funding, and whether a shop would serve your people or stretch them thin.",
  },
  {
    keys: ["mission", "abroad", "field", "overseas"],
    kicker: "Where you fit",
    track: "Field track — income and presence",
    person: "Jonas, field coach",
    why: "We walk through a revenue model that can sit beside support, and a shop that gives local people a normal reason to keep talking with you.",
  },
];

const FALLBACK = {
  kicker: "Where you fit",
  track: "A first conversation",
  person: "us",
  why: "Tell us a little more on the call. We will match you with the person who has sat in a similar place, rather than sending you through a form.",
};

const LIMIT = 3;

const state = {
  turns: [{ q: OPENER, a: "" }],
  draft: "",
  thinking: false,
  result: null,
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
};

function pickTrack(text) {
  const hay = text.toLowerCase();
  return TRACKS.find((t) => t.keys.some((k) => hay.includes(k))) || FALLBACK;
}

function render() {
  els.turns.innerHTML = state.turns
    .map(
      (t) =>
        `<div class="turn"><p class="q">${escapeHtml(t.q)}</p>${
          t.a ? `<p class="a">${escapeHtml(t.a)}</p>` : ""
        }</div>`
    )
    .join("");

  const asking = !state.result && !state.thinking;
  const first = state.turns.length === 1 && !state.turns[0].a;

  els.thinking.classList.toggle("hidden", !state.thinking);
  els.ask.classList.toggle("hidden", !asking);
  els.result.classList.toggle("hidden", !state.result);

  if (first) {
    els.chips.classList.remove("hidden");
    els.chips.innerHTML = CHIPS.map(
      (label) =>
        `<button type="button" class="tag tag-outline" data-chip="${escapeAttr(
          label
        )}">${escapeHtml(label)}</button>`
    ).join("");
  } else {
    els.chips.classList.add("hidden");
    els.chips.innerHTML = "";
  }

  if (state.result) {
    els.resultKicker.textContent = state.result.kicker;
    els.resultTrack.textContent = state.result.track;
    els.resultWhy.textContent = state.result.why;
    els.resultBook.textContent = "Book a call with " + state.result.person;
    els.resultBook.href =
      "mailto:hello@yglesia.com?subject=" +
      encodeURIComponent("Yglesia — book a call");
  }

  els.draft.value = state.draft;
}

function send(text) {
  const answer = (text ?? state.draft).trim();
  if (!answer || state.thinking) return;
  state.turns = state.turns.map((t, i) =>
    i === state.turns.length - 1 ? { ...t, a: answer } : t
  );
  state.draft = "";
  state.thinking = true;
  render();

  window.setTimeout(() => {
    const asked = state.turns.length;
    if (asked >= LIMIT) {
      const transcript = state.turns.map((t) => t.a).join(" ");
      state.result = pickTrack(transcript);
      state.thinking = false;
    } else {
      state.turns = [
        ...state.turns,
        { q: FOLLOWUPS[asked - 1] || FOLLOWUPS[0], a: "" },
      ];
      state.thinking = false;
    }
    render();
  }, 420);
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
  state.turns = [{ q: OPENER, a: "" }];
  state.draft = "";
  state.thinking = false;
  state.result = null;
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
