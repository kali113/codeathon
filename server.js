"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { buildContextSystem } = require("./src/context-system");
const { ModelRouter, NoProviderConfiguredError } = require("./src/model-router");

const ROOT_DIR = __dirname;
const MAX_BODY_BYTES = 1024 * 1024;
const PORT = Number(process.env.PORT || 3000);

loadEnvFile(path.join(ROOT_DIR, ".env.local"));
loadEnvFile(path.join(ROOT_DIR, ".env"));

const modelRouter = new ModelRouter(process.env);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) return;
    if (process.env[key] !== undefined && process.env[key] !== "") return;
    process.env[key] = value;
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(text);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }
  const bodyText = Buffer.concat(chunks).toString("utf8").trim();
  if (!bodyText) return {};
  return JSON.parse(bodyText);
}

function sanitizeSignalLines(input) {
  if (Array.isArray(input)) {
    return input
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .slice(0, 300);
  }
  return [];
}

function configuredProviderStatus() {
  const names = Array.from(
    new Set([
      ...modelRouter.getProviderChain("safe"),
      ...modelRouter.getProviderChain("balanced"),
      ...modelRouter.getProviderChain("fast"),
    ]),
  );
  return names
    .map((name) => modelRouter.buildProviderRuntime(name))
    .filter(Boolean)
    .map((provider) => ({
      name: provider.name,
      model: provider.model,
      type: provider.type,
    }));
}

async function handleRecommend(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: "Invalid JSON payload: " + error.message,
    });
    return;
  }

  const question = String(body.question || "What should we build next?").trim();
  const mode = String(body.mode || "balanced").trim();
  const signals = sanitizeSignalLines(body.signals);
  const history = Array.isArray(body.history) ? body.history.slice(0, 5) : [];

  if (!signals.length) {
    sendJson(res, 400, {
      ok: false,
      error: "At least one signal line is required.",
    });
    return;
  }

  const context = buildContextSystem({
    question,
    mode,
    signals,
    history,
  });

  try {
    const routed = await modelRouter.generateRecommendation({
      mode,
      context,
    });
    sendJson(res, 200, {
      ok: true,
      provider: routed.provider,
      model: routed.model,
      mode: routed.mode,
      recommendation: routed.recommendation,
      context: {
        signalCount: context.signals.length,
        themes: context.themes,
        sourceBreakdown: context.sourceBreakdown,
      },
    });
  } catch (error) {
    if (error instanceof NoProviderConfiguredError) {
      sendJson(res, 503, {
        ok: false,
        code: error.code,
        error: error.message,
      });
      return;
    }
    sendJson(res, 502, {
      ok: false,
      code: error.code || "ROUTER_FAILED",
      error: error.message || "Model router failed.",
    });
  }
}

function safeStaticPath(urlPath) {
  const rawPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const normalized = rawPath === "/" ? "/index.html" : rawPath;
  const absolute = path.resolve(ROOT_DIR, "." + normalized);
  if (!absolute.startsWith(ROOT_DIR)) return null;
  if (!fs.existsSync(absolute)) return null;
  if (fs.statSync(absolute).isDirectory()) return null;
  return absolute;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "cursor-pm-router",
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/router/status") {
    sendJson(res, 200, {
      ok: true,
      configuredProviders: configuredProviderStatus(),
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/recommend") {
    await handleRecommend(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }

  const filePath = safeStaticPath(req.url || "/");
  if (!filePath) {
    sendText(res, 404, "Not found");
    return;
  }

  const contentType = contentTypeFor(filePath);
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    "content-type": contentType,
    "access-control-allow-origin": "*",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(content);
});

server.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
  console.log("Configured providers: " + configuredProviderStatus().map((p) => p.name).join(", "));
});
