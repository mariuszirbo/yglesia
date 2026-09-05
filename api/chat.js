import { handleChat } from "../lib/intake.js";

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = await req.json();
    const data = await handleChat(body);
    return json(200, data);
  } catch (err) {
    console.error("chat failed", err);
    return json(err.status || 500, {
      error: "That didn't go through.",
    });
  }
}
