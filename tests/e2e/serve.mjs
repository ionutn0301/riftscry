// Minimal foreground static server for dist/ — Playwright's webServer needs a
// process that stays attached (astro 7's `preview` daemonizes).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("../../dist", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = 4321;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([\\/])+/, "");
    if (path.includes("..")) throw new Error("bad path");
    let file = join(ROOT, path);
    // Patch ids look like extensions ("/patch/26.16" → ".16") — only a
    // known asset extension means "this is a file".
    if (!TYPES[extname(file)]) file = join(file, "index.html");
    let body;
    try {
      body = await readFile(file);
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(await readFile(join(ROOT, "404.html")).catch(() => "Not found"));
      return;
    }
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    // Compress text like any real host would (parity for perf audits).
    const compressible = /^(text\/|application\/(json|xml|javascript))/.test(type);
    if (compressible && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      res.writeHead(200, { "Content-Type": type, "Content-Encoding": "gzip" });
      res.end(gzipSync(body));
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(body);
  } catch {
    res.writeHead(400);
    res.end("bad request");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`serving dist/ on http://127.0.0.1:${PORT}`);
});
