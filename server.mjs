import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/chat.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

const BLOCKED = new Set([
  ".env",
  ".env.local",
  ".env.example",
  ".gitignore",
  ".git",
  "server.mjs",
  "package.json",
  "vercel.json",
]);

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "/index.html" : decoded;
  const base = path.basename(rel);
  if (base.startsWith(".env") || BLOCKED.has(base) || rel.includes("/.") || rel.startsWith("/api/") || rel.startsWith("/lib/") || rel.startsWith("/sheets/")) {
    return null;
  }
  const abs = path.normalize(path.join(root, rel));
  if (!abs.startsWith(root)) return null;
  return abs;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.split("?")[0] === "/api/chat") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const webReq = new Request("http://127.0.0.1/api/chat", {
        method: req.method,
        headers: { "content-type": "application/json" },
        body: ["POST", "PUT", "PATCH"].includes(req.method)
          ? Buffer.concat(chunks)
          : undefined,
      });
      const webRes = await handler(webReq);
      const buf = Buffer.from(await webRes.arrayBuffer());
      send(
        res,
        webRes.status,
        { "Content-Type": webRes.headers.get("Content-Type") || "application/json" },
        buf
      );
      return;
    }

    const file = safeFile(req.url);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      send(res, 404, { "Content-Type": "text/plain" }, "Not found");
      return;
    }
    const ext = path.extname(file);
    send(res, 200, { "Content-Type": TYPES[ext] || "application/octet-stream" }, fs.readFileSync(file));
  } catch (err) {
    console.error(err);
    send(res, 500, { "Content-Type": "text/plain" }, "Server error");
  }
});

server.listen(port, () => {
  console.log("Yglesia local site at http://127.0.0.1:" + port);
});
