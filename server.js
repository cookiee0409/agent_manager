const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, {
        ok: true,
        providers: {
          google: Boolean(getGoogleKey()),
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY)
        }
      });
    }

    if (req.method === "POST" && url.pathname === "/api/run-agent") {
      const body = await readJson(req);
      const result = await runAgent(body);
      return sendJson(res, 200, result);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    await serveStatic(url.pathname, req, res);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message || "Unexpected server error"
    });
  }
});

server.listen(port, host, () => {
  console.log(`Agent Office server: http://${host}:${port}/`);
});

async function serveStatic(urlPath, req, res) {
  const decoded = decodeURIComponent(urlPath);
  const requestedPath = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    return sendJson(res, 403, { ok: false, error: "Forbidden" });
  }

  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats) {
    return sendJson(res, 404, { ok: false, error: "Not found" });
  }

  if (stats.isDirectory()) {
    const files = await fs.readdir(filePath);
    const html = renderDirectoryListing(requestedPath, files);
    res.writeHead(200, { "content-type": mimeTypes[".html"] });
    return res.end(html);
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
    "cache-control": "no-store"
  });

  if (req.method === "HEAD") return res.end();
  const content = await fs.readFile(filePath);
  res.end(content);
}

function renderDirectoryListing(urlPath, files) {
  const base = urlPath.endsWith("/") ? urlPath : `${urlPath}/`;
  const links = files
    .map((file) => `<li><a href="${encodeURI(`${base}${file}`)}">${escapeHtml(file)}</a></li>`)
    .join("");
  return `<!doctype html><html><body><h1>Directory listing</h1><ul>${links}</ul></body></html>`;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

async function runAgent(body) {
  const agent = body.agent || {};
  const task = body.task || {};
  const provider = resolveProvider(body.provider);
  const system = buildSystemPrompt(agent);
  const prompt = buildUserPrompt(task, agent);

  if (provider === "google") {
    const output = await callGoogle(system, prompt);
    return { ok: true, provider, output };
  }

  if (provider === "anthropic") {
    const output = await callAnthropic(system, prompt);
    return { ok: true, provider, output };
  }

  throw new Error("Google AI 또는 Anthropic API 키가 서버 환경변수에 설정되어 있지 않습니다.");
}

function resolveProvider(provider) {
  if (provider === "google") {
    if (!getGoogleKey()) throw new Error("GOOGLE_API_KEY 또는 GEMINI_API_KEY가 설정되어 있지 않습니다.");
    return "google";
  }

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다.");
    return "anthropic";
  }

  if (getGoogleKey()) return "google";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "";
}

function buildSystemPrompt(agent) {
  return [
    `당신은 Agent Office의 에이전트 "${agent.name || "에이전트"}"입니다.`,
    `역할: ${agent.role || "역할 미지정"}`,
    `업무 지침: ${agent.capability || "명확하고 실무적인 답변을 제공합니다."}`,
    "사용자의 요청을 한국어로 처리하고, 결과는 실행 가능한 요약과 다음 행동으로 정리하세요."
  ].join("\n");
}

function buildUserPrompt(task, agent) {
  return [
    `작업 제목: ${task.title || "제목 없음"}`,
    `작업 설명: ${task.detail || ""}`,
    `우선순위: ${task.priority || "보통"}`,
    `담당 에이전트: ${agent.name || ""}`,
    "결과를 간결하지만 충분히 구체적으로 작성하세요."
  ].join("\n");
}

function getGoogleKey() {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
}

async function callGoogle(system, prompt) {
  const model = getGoogleModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(getGoogleKey())}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1600 }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Google AI 요청 실패 (${response.status})`);
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim() || "응답 텍스트가 비어 있습니다.";
}

function getGoogleModel() {
  const configured = process.env.GOOGLE_MODEL || process.env.GEMINI_MODEL || "";
  const model = configured.replace(/^models\//, "");

  // Gemini 1.5 models are no longer served by the Gemini API.
  if (!model || model === "gemini-1.5-flash" || model === "gemini-1.5-flash-latest") {
    return "gemini-2.5-flash";
  }

  return model;
}

async function callAnthropic(system, prompt) {
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Anthropic 요청 실패 (${response.status})`);
  const parts = data.content || [];
  return parts.map((part) => part.text || "").join("\n").trim() || "응답 텍스트가 비어 있습니다.";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
