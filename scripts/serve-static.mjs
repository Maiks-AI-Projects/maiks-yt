import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const [rootArgument, portArgument] = process.argv.slice(2);

if (!rootArgument || !portArgument) {
  throw new Error("Usage: node scripts/serve-static.mjs <root> <port>");
}

const root = resolve(rootArgument);
const port = Number.parseInt(portArgument, 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Static server port must be between 1 and 65535.");
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"]
]);

const isFile = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath.replace(/^\/+/, "");
    const candidate = resolve(root, relativePath || "index.html");
    const insideRoot = candidate === root || candidate.startsWith(`${root}${sep}`);

    if (!insideRoot) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const filePath = await isFile(candidate) ? candidate : resolve(root, "index.html");

    if (!await isFile(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = extname(filePath).toLowerCase();
    const isHtml = extension === ".html";
    response.writeHead(200, {
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving ${root} on port ${port}`);
});
