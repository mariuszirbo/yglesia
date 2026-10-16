const MAX_ANSWER = 400;

const PERSONAS = [
  {
    id: "owner",
    chip: "I already run a coffee shop",
    keys: /coffee shop|cafe|café|owner/,
    needsOrg: false,
    track: "Coffee shop owners",
    person: "us",
    why: "You already have the shop. We turn it into a mission.",
  },
  {
    id: "barista",
    chip: "I'm a barista who wants my own bar",
    keys: /barista/,
    needsOrg: false,
    track: "Baristas",
    person: "us",
    why: "You have the craft, so making coffee — vocation and profession — becomes your ministry.",
  },
  {
    id: "church",
    chip: "I'm from a church",
    keys: /church|pastor/,
    needsOrg: true,
    track: "Churches",
    person: "us",
    why: "A shop is a door your city already walks through, open every day of the week.",
  },
  {
    id: "missionary",
    chip: "I'm a missionary abroad",
    keys: /missionar|on the field|abroad/,
    needsOrg: true,
    track: "Missionaries",
    person: "us",
    why: "Income that funds the work, and a reason to belong where you’ve been sent.",
  },
];

const AREAS = [
  "Training people behind the bar",
  "Opening or setting up a shop",
  "Running the business",
  "Work on the mission field",
  "Something else",
];

const TOPICS = {
  persona: {
    id: "persona",
    ask: "Which of these is you: shop owner, barista, church, or missionary?",
    chips: PERSONAS.map((p) => p.chip),
    chipsOnly: true,
  },
  name: {
    id: "name",
    ask: "What name should we use when we write to you?",
  },
  country: {
    id: "country",
    ask: "Which country are you in?",
  },
  organisation: {
    id: "organisation",
    ask: "Which church or organisation are you with?",
  },
  area: {
    id: "area",
    ask: "In what area do you need help?",
    chips: AREAS,
  },
  help: {
    id: "help",
    ask: "What help do you consider you need?",
  },
};

function env(name) {
  return (process.env[name] || "").trim();
}

function clipAnswer(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ANSWER);
}

function sanitizeTurns(turns) {
  return (Array.isArray(turns) ? turns : []).slice(0, 12).map((t) => ({
    q: clipAnswer(t?.q).slice(0, 160),
    a: clipAnswer(t?.a),
  }));
}

function transcript(turns) {
  return turns
    .filter((t) => t && t.q)
    .map((t) => "Q: " + t.q + (t.a ? "\nA: " + t.a : ""))
    .join("\n\n");
}

function answerTo(turns, topic) {
  const hit = [...turns].reverse().find((t) => t.a && t.q === topic.ask);
  return hit ? hit.a : "";
}

function matchPersona(text) {
  const raw = String(text || "").trim();
  const byChip = PERSONAS.find((p) => p.chip === raw);
  if (byChip) return byChip;
  const lower = raw.toLowerCase();
  return PERSONAS.find((p) => p.keys.test(lower)) || null;
}

function fieldsFrom(turns) {
  const persona = matchPersona(answerTo(turns, TOPICS.persona));
  return {
    persona,
    name: answerTo(turns, TOPICS.name),
    country: answerTo(turns, TOPICS.country),
    organisation: answerTo(turns, TOPICS.organisation),
    area: answerTo(turns, TOPICS.area),
    help: answerTo(turns, TOPICS.help),
  };
}

function nextTopic(fields) {
  if (!fields.persona) return TOPICS.persona;
  if (!fields.name) return TOPICS.name;
  if (!fields.country) return TOPICS.country;
  if (fields.persona.needsOrg && !fields.organisation) return TOPICS.organisation;
  if (!fields.area) return TOPICS.area;
  if (!fields.help) return TOPICS.help;
  return null;
}

async function logSheet(payload) {
  const url = env("SHEETS_WEBHOOK_URL");
  if (!url) return { ok: false, skipped: true };
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(4000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env("SHEETS_SECRET"),
      ...payload,
    }),
  });
  const body = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error("Sheets HTTP " + res.status + " " + body.slice(0, 200));
  }
  if (!/^\s*\{/.test(body)) {
    throw new Error("Sheets returned a login page instead of JSON");
  }
  let data = {};
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Sheets returned non-JSON");
  }
  if (!data.ok) {
    throw new Error("Sheets rejected write: " + (data.error || "unknown"));
  }
  return { ok: true };
}

function logSheetSafe(payload) {
  return logSheet(payload).catch((err) => {
    console.error("sheet log failed", err);
    return { ok: false };
  });
}

export async function handleChat(body) {
  const sessionId = String(body.sessionId || "").slice(0, 80);
  const turns = sanitizeTurns(body.turns);
  if (!sessionId || !turns.length) {
    throw Object.assign(new Error("Missing session"), { status: 400 });
  }

  const last = turns[turns.length - 1];
  if (!last?.a) {
    throw Object.assign(new Error("Missing answer"), { status: 400 });
  }

  const fields = fieldsFrom(turns);
  if (last.q === TOPICS.persona.ask && !fields.persona) {
    return {
      question: TOPICS.persona.ask,
      chips: TOPICS.persona.chips,
      chipsOnly: true,
      done: false,
      result: null,
    };
  }

  const topic = nextTopic(fields);
  const done = !topic;
  const now = new Date().toISOString();
  const contact = {
    name: fields.name,
    country: fields.country,
    organisation: fields.organisation,
    area: fields.area,
    help: fields.help,
    persona: fields.persona?.track || "",
  };

  const sheetJobs = [
    logSheetSafe({
      type: "turn",
      sessionId,
      timestamp: now,
      speaker: "visitor",
      question: last.q || "",
      text: last.a,
      name: contact.name,
      country: contact.country,
      email: "",
    }),
  ];

  if (!done) {
    sheetJobs.push(
      logSheetSafe({
        type: "turn",
        sessionId,
        timestamp: now,
        speaker: "yglesia",
        question: "",
        text: topic.ask,
        name: contact.name,
        country: contact.country,
        email: "",
      })
    );
  } else {
    sheetJobs.push(
      logSheetSafe({
        type: "lead",
        sessionId,
        timestamp: now,
        name: contact.name,
        country: contact.country,
        organisation: contact.organisation,
        area: contact.area,
        help: contact.help,
        track: fields.persona.track,
        person: fields.persona.person,
        persona: fields.persona.chip,
        why: contact.area + " — " + contact.help,
        transcript: transcript(turns),
        phone: "",
        email: "",
        model: "",
      })
    );
  }

  await Promise.race([
    Promise.all(sheetJobs),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);

  return {
    question: done ? null : topic.ask,
    chips: done ? null : topic.chips || null,
    chipsOnly: Boolean(!done && topic.chipsOnly),
    name: contact.name || null,
    country: contact.country || null,
    organisation: contact.organisation || null,
    area: contact.area || null,
    help: contact.help || null,
    done,
    result: done
      ? {
          kicker: "Where you fit",
          track: fields.persona.track,
          person: fields.persona.person,
          why: fields.persona.why,
        }
      : null,
  };
}
