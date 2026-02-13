const MODE_CHAINS = {
  safe: [
    "gemini",
    "groq",
    "mistral",
    "cerebras",
    "cohere",
    "nvidia",
    "cloudflare",
    "huggingface",
    "codestral",
    "opencode",
    "ollama",
  ],
  balanced: [
    "groq",
    "gemini",
    "mistral",
    "cerebras",
    "cohere",
    "nvidia",
    "codestral",
    "cloudflare",
    "huggingface",
    "opencode",
    "ollama",
  ],
  fast: [
    "groq",
    "cerebras",
    "nvidia",
    "gemini",
    "mistral",
    "cohere",
    "codestral",
    "ollama",
    "cloudflare",
    "huggingface",
    "opencode",
  ],
};

const PROVIDER_CONFIG = {
  groq: {
    type: "openai",
    keyEnv: "GROQ_API_KEY",
    endpointEnv: "GROQ_BASE_URL",
    defaultEndpoint: "https://api.groq.com/openai/v1/chat/completions",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  gemini: {
    type: "gemini",
    keyEnv: "GEMINI_API_KEY",
    endpointEnv: "GEMINI_BASE_URL",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
  },
  mistral: {
    type: "openai",
    keyEnv: "MISTRAL_API_KEY",
    endpointEnv: "MISTRAL_BASE_URL",
    defaultEndpoint: "https://api.mistral.ai/v1/chat/completions",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-large-latest",
  },
  cohere: {
    type: "cohere",
    keyEnv: "COHERE_API_KEY",
    endpointEnv: "COHERE_BASE_URL",
    defaultEndpoint: "https://api.cohere.com/v2/chat",
    modelEnv: "COHERE_MODEL",
    defaultModel: "command-r-plus",
  },
  codestral: {
    type: "openai",
    keyEnv: "CODESTRAL_API_KEY",
    endpointEnv: "CODESTRAL_BASE_URL",
    defaultEndpoint: "https://codestral.mistral.ai/v1/chat/completions",
    modelEnv: "CODESTRAL_MODEL",
    defaultModel: "codestral-latest",
  },
  nvidia: {
    type: "openai",
    keyEnv: "NVIDIA_NIM_API_KEY",
    endpointEnv: "NVIDIA_NIM_BASE_URL",
    defaultEndpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    modelEnv: "NVIDIA_NIM_MODEL",
    defaultModel: "meta/llama-3.1-70b-instruct",
  },
  cerebras: {
    type: "openai",
    keyEnv: "CEREBRAS_API_KEY",
    endpointEnv: "CEREBRAS_BASE_URL",
    defaultEndpoint: "https://api.cerebras.ai/v1/chat/completions",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "llama-3.3-70b",
  },
  huggingface: {
    type: "huggingface",
    keyEnv: "HUGGINGFACE_API_KEY",
    endpointEnv: "HUGGINGFACE_BASE_URL",
    defaultEndpoint: "https://api-inference.huggingface.co/models",
    modelEnv: "HUGGINGFACE_MODEL",
    defaultModel: "mistralai/Mistral-7B-Instruct-v0.3",
  },
  cloudflare: {
    type: "cloudflare",
    keyEnv: "CLOUDFLARE_API_KEY",
    accountEnv: "CLOUDFLARE_ACCOUNT_ID",
    endpointEnv: "CLOUDFLARE_BASE_URL",
    defaultEndpoint: "https://api.cloudflare.com/client/v4/accounts",
    modelEnv: "CLOUDFLARE_MODEL",
    defaultModel: "@cf/meta/llama-3.1-8b-instruct",
  },
  ollama: {
    type: "ollama",
    keyEnv: "OLLAMA_API_KEY",
    endpointEnv: "OLLAMA_BASE_URL",
    defaultEndpoint: "http://localhost:11434/api/chat",
    modelEnv: "OLLAMA_MODEL",
    defaultModel: "llama3.1",
  },
  opencode: {
    type: "openai",
    keyEnv: "OPENCODE_API_KEY",
    endpointEnv: "OPENCODE_BASE_URL",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    modelEnv: "OPENCODE_MODEL",
    defaultModel: "gpt-4o-mini",
  },
};

const STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "every",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "over",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "very",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "users",
  "user",
  "team",
  "teams",
]);

const SEVERITY_TERMS = [
  "incident",
  "error",
  "crash",
  "block",
  "failure",
  "urgent",
  "drop",
  "churn",
  "latency",
  "slow",
  "risk",
];

const rateLimitState = new Map();

class NoProviderConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = "NoProviderConfiguredError";
    this.code = "NO_PROVIDER_CONFIGURED";
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function inferSource(signalLine) {
  const lower = normalizeText(signalLine).toLowerCase();
  if (lower.startsWith("interview:")) return "interview";
  if (lower.startsWith("usage:")) return "usage";
  if (lower.startsWith("market:")) return "market";
  if (/\.json:\s|\.csv:\s|\.txt:\s|\.md:\s/.test(lower)) return "upload";
  return "other";
}

function countTerms(signalLine, terms) {
  const lower = normalizeText(signalLine).toLowerCase();
  return terms.reduce((count, term) => (lower.includes(term) ? count + 1 : count), 0);
}

function extractThemes(signals, limit) {
  const counts = new Map();
  signals.forEach((signal) => {
    tokenize(signal).forEach((token) => {
      counts.set(token, (counts.get(token) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function summarizeHistory(historyItems) {
  const items = Array.isArray(historyItems) ? historyItems : [];
  return items
    .slice(0, 3)
    .map((item, idx) => {
      const topName = normalizeText(item && item.topName) || "unknown";
      const when = normalizeText(item && item.timestamp) || "recent";
      return idx + 1 + ". " + topName + " (" + when + ")";
    });
}

function buildContextSystem(input) {
  const question = normalizeText(input && input.question) || "What should we build next?";
  const mode = normalizeText(input && input.mode) || "balanced";
  const signalLines = (Array.isArray(input && input.signals) ? input.signals : [])
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, 240);
  const themes = extractThemes(signalLines, 8);

  const sourceBreakdown = {
    interview: 0,
    usage: 0,
    market: 0,
    upload: 0,
    other: 0,
  };
  signalLines.forEach((line) => {
    const source = inferSource(line);
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });

  const severityScoredSignals = signalLines.map((line) => ({
    line,
    severity: countTerms(line, SEVERITY_TERMS) + (/\d+%/.test(line) ? 1 : 0),
  }));
  const topSignals = severityScoredSignals
    .slice()
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 12)
    .map((item) => item.line);
  const historyHighlights = summarizeHistory(input && input.history);
  const severitySignalCount = severityScoredSignals.filter((item) => item.severity > 0).length;

  const systemPrompt = [
    "You are a senior AI product strategist for Cursor for Product Managers.",
    "Return STRICT JSON only with this schema:",
    "{",
    '  "name": "string",',
    '  "problem": "string",',
    '  "ui": ["string"],',
    '  "data": ["string"],',
    '  "workflow": ["string"],',
    '  "tasks": ["string"],',
    '  "evidence": ["string"],',
    '  "themes": ["string"],',
    '  "confidence": 0-100',
    "}",
    "Requirements:",
    "- Ground output in the provided signals.",
    "- Keep recommendations implementation-ready.",
    "- Ensure arrays are non-empty.",
  ].join("\n");

  const userPrompt = [
    "Question: " + question,
    "Mode: " + mode,
    "Signal count: " + signalLines.length,
    "Source breakdown: " + JSON.stringify(sourceBreakdown),
    "Severity-tagged signal count: " + severitySignalCount,
    "Top themes: " + (themes.length ? themes.join(", ") : "n/a"),
    "Recent run highlights: " + (historyHighlights.length ? historyHighlights.join(" | ") : "n/a"),
    "Signals:",
    ...topSignals.map((line, idx) => idx + 1 + ". " + line),
  ].join("\n");

  return {
    question,
    mode,
    signals: signalLines,
    themes,
    sourceBreakdown,
    topSignals,
    systemPrompt,
    userPrompt,
  };
}

function toArray(value, fallback) {
  if (!Array.isArray(value)) return fallback.slice(0);
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function extractJsonText(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return null;
  if (raw.startsWith("{") && raw.endsWith("}")) return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return null;
}

function sanitizeRecommendation(raw, context) {
  const fallbackThemes = Array.isArray(context && context.themes) ? context.themes : [];
  const fallbackEvidence = Array.isArray(context && context.topSignals)
    ? context.topSignals.slice(0, 8)
    : [];
  const obj = raw && typeof raw === "object" ? raw : {};

  const name = String(obj.name || "").trim() || "Signal-Driven Recommendation";
  const problem =
    String(obj.problem || "").trim() ||
    "Based on current signals, users have unresolved friction that should be prioritized.";
  const ui = toArray(obj.ui, ["Improve the primary user flow for the highest-friction moments."]);
  const data = toArray(obj.data, ["Add tracking for recommendation impact and outcome changes."]);
  const workflow = toArray(obj.workflow, [
    "Define iteration goals -> implement update -> measure behavioral change.",
  ]);
  const tasks = toArray(obj.tasks, [
    "Draft implementation scope and acceptance criteria.",
    "Implement targeted UX and workflow updates.",
    "Instrument impact metrics and validate behavior shift.",
  ]);
  const evidence = toArray(obj.evidence, fallbackEvidence);
  const themes = toArray(obj.themes, fallbackThemes);

  const confidenceRaw = Number(obj.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? clampNumber(Math.round(confidenceRaw), 1, 99)
    : null;

  const scoreRaw = Number(obj.score);
  const score = Number.isFinite(scoreRaw) ? clampNumber(Math.round(scoreRaw), 1, 100) : null;

  return {
    name,
    problem,
    ui,
    data,
    workflow,
    tasks,
    evidence,
    themes,
    confidence,
    score,
  };
}

function parseEnv(env, key, fallback) {
  const raw = env && env[key];
  if (raw === undefined || raw === null || raw === "") return fallback || "";
  return String(raw).trim();
}

function buildHttpError(providerName, status, bodyText) {
  const message =
    "[" + providerName + "] " + status + " - " + String(bodyText || "request failed");
  const error = new Error(message);
  error.status = status;
  error.bodyText = String(bodyText || "");
  error.providerName = providerName;
  return error;
}

function isRateLimitError(error) {
  if (!error) return false;
  if (Number(error.status) === 429) return true;
  const text = (String(error.message || "") + " " + String(error.bodyText || "")).toLowerCase();
  return /rate.?limit|quota|too many requests/.test(text);
}

class WorkerModelRouter {
  constructor(env) {
    this.env = env || {};
  }

  getProviderChain(mode) {
    const requested = MODE_CHAINS[mode] ? mode : parseEnv(this.env, "DEFAULT_MODE", "balanced");
    return MODE_CHAINS[requested] || MODE_CHAINS.balanced;
  }

  buildProviderRuntime(name) {
    const config = PROVIDER_CONFIG[name];
    if (!config) return null;

    const endpoint = parseEnv(this.env, config.endpointEnv, config.defaultEndpoint);
    const model = parseEnv(this.env, config.modelEnv, config.defaultModel);
    const apiKey = parseEnv(this.env, config.keyEnv, "");
    const accountId = config.accountEnv ? parseEnv(this.env, config.accountEnv, "") : "";

    const ollamaEnabled = parseEnv(this.env, "OLLAMA_ENABLED", "").toLowerCase();
    const hasExplicitOllamaConfig =
      ollamaEnabled === "true" ||
      Boolean(parseEnv(this.env, "OLLAMA_BASE_URL", "")) ||
      Boolean(apiKey);

    if (!endpoint || !model) return null;
    if (config.type === "ollama" && !hasExplicitOllamaConfig) return null;
    if (config.type === "ollama" && ollamaEnabled === "false") return null;
    if (config.type !== "ollama" && !apiKey) return null;
    if (config.type === "cloudflare" && !accountId) return null;

    return {
      name,
      type: config.type,
      endpoint,
      model,
      apiKey,
      accountId,
    };
  }

  isTemporarilyRateLimited(providerName) {
    const state = rateLimitState.get(providerName);
    if (!state) return false;
    return Date.now() < state.until;
  }

  markRateLimited(providerName) {
    const current = rateLimitState.get(providerName) || { strikes: 0, until: 0 };
    const strikes = current.strikes + 1;
    const waitSeconds = Math.min(20 * Math.pow(2, strikes - 1), 300);
    rateLimitState.set(providerName, {
      strikes,
      until: Date.now() + waitSeconds * 1000,
    });
  }

  clearRateLimit(providerName) {
    rateLimitState.delete(providerName);
  }

  buildMessages(context) {
    return [
      { role: "system", content: context.systemPrompt },
      { role: "user", content: context.userPrompt },
    ];
  }

  async fetchJson(providerName, url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_error) {
      data = null;
    }
    if (!response.ok) {
      const bodyText = data && data.error ? JSON.stringify(data.error) : text;
      throw buildHttpError(providerName, response.status, bodyText);
    }
    return data;
  }

  parseRecommendation(providerName, rawText, context) {
    const jsonText = extractJsonText(rawText);
    if (!jsonText) throw new Error("[" + providerName + "] model response did not contain JSON");
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error("[" + providerName + "] invalid JSON response: " + error.message);
    }
    return sanitizeRecommendation(parsed, context);
  }

  async callOpenAICompat(provider, context) {
    const json = await this.fetchJson(provider.name, provider.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 1200,
        messages: this.buildMessages(context),
      }),
    });
    const rawText =
      json &&
      json.choices &&
      json.choices[0] &&
      json.choices[0].message &&
      json.choices[0].message.content;
    if (!rawText) throw new Error("[" + provider.name + "] empty model output");
    return this.parseRecommendation(provider.name, rawText, context);
  }

  async callGemini(provider, context) {
    const base = provider.endpoint.replace(/\/+$/, "");
    const url =
      base +
      "/" +
      encodeURIComponent(provider.model) +
      ":generateContent?key=" +
      encodeURIComponent(provider.apiKey);
    const promptText = context.systemPrompt + "\n\n" + context.userPrompt;
    const json = await this.fetchJson(provider.name, url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
        },
      }),
    });
    const parts =
      json &&
      json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts;
    const rawText = Array.isArray(parts)
      ? parts.map((part) => String((part && part.text) || "")).join("\n")
      : "";
    if (!rawText.trim()) throw new Error("[" + provider.name + "] empty model output");
    return this.parseRecommendation(provider.name, rawText, context);
  }

  async callCohere(provider, context) {
    const json = await this.fetchJson(provider.name, provider.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages: this.buildMessages(context),
      }),
    });
    let rawText = "";
    if (json && typeof json.text === "string") rawText = json.text;
    if (!rawText && json && json.message && Array.isArray(json.message.content)) {
      rawText = json.message.content
        .map((item) => (item && typeof item.text === "string" ? item.text : ""))
        .join("\n");
    }
    if (!rawText.trim()) throw new Error("[" + provider.name + "] empty model output");
    return this.parseRecommendation(provider.name, rawText, context);
  }

  async callCloudflare(provider, context) {
    const base = provider.endpoint.replace(/\/+$/, "");
    const url =
      base +
      "/" +
      encodeURIComponent(provider.accountId) +
      "/ai/run/" +
      encodeURIComponent(provider.model);
    const json = await this.fetchJson(provider.name, url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
      body: JSON.stringify({
        messages: this.buildMessages(context),
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });
    const result = json && json.result ? json.result : null;
    const rawText =
      (result && typeof result.response === "string" && result.response) ||
      (result && typeof result.result === "string" && result.result) ||
      (typeof result === "string" ? result : "");
    if (!rawText.trim()) throw new Error("[" + provider.name + "] empty model output");
    return this.parseRecommendation(provider.name, rawText, context);
  }

  async callHuggingFace(provider, context) {
    const base = provider.endpoint.replace(/\/+$/, "");
    const url = base + "/" + provider.model;
    const promptText = context.systemPrompt + "\n\n" + context.userPrompt;
    const json = await this.fetchJson(provider.name, url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + provider.apiKey,
      },
      body: JSON.stringify({
        inputs: promptText,
        parameters: {
          temperature: 0.2,
          max_new_tokens: 1200,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,
        },
      }),
    });
    let rawText = "";
    if (Array.isArray(json) && json[0] && typeof json[0].generated_text === "string") {
      rawText = json[0].generated_text;
    } else if (json && typeof json.generated_text === "string") {
      rawText = json.generated_text;
    }
    if (!rawText.trim()) throw new Error("[" + provider.name + "] empty model output");
    return this.parseRecommendation(provider.name, rawText, context);
  }

  async callOllama(provider, context) {
    const headers = {
      "content-type": "application/json",
    };
    if (provider.apiKey) {
      headers.authorization = "Bearer " + provider.apiKey;
    }
    const json = await this.fetchJson(provider.name, provider.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        stream: false,
        messages: this.buildMessages(context),
        options: { temperature: 0.2 },
      }),
    });
    const rawText = json && json.message && typeof json.message.content === "string"
      ? json.message.content
      : "";
    if (!rawText.trim()) throw new Error("[" + provider.name + "] empty model output");
    return this.parseRecommendation(provider.name, rawText, context);
  }

  async callProvider(provider, context) {
    switch (provider.type) {
      case "openai":
        return this.callOpenAICompat(provider, context);
      case "gemini":
        return this.callGemini(provider, context);
      case "cohere":
        return this.callCohere(provider, context);
      case "cloudflare":
        return this.callCloudflare(provider, context);
      case "huggingface":
        return this.callHuggingFace(provider, context);
      case "ollama":
        return this.callOllama(provider, context);
      default:
        throw new Error("Unsupported provider type: " + provider.type);
    }
  }

  async generateRecommendation(input) {
    const mode = normalizeText(input && input.mode) || "balanced";
    const context = input && input.context ? input.context : {};
    const configured = this.getProviderChain(mode)
      .map((name) => this.buildProviderRuntime(name))
      .filter(Boolean);

    if (!configured.length) {
      throw new NoProviderConfiguredError(
        "No configured providers found. Set Worker secrets with wrangler secret put.",
      );
    }

    const errors = [];
    for (const provider of configured) {
      if (this.isTemporarilyRateLimited(provider.name)) {
        errors.push("[" + provider.name + "] skipped due to recent rate limit");
        continue;
      }
      try {
        const recommendation = await this.callProvider(provider, context);
        this.clearRateLimit(provider.name);
        return {
          provider: provider.name,
          model: provider.model,
          mode,
          recommendation,
        };
      } catch (error) {
        if (isRateLimitError(error)) this.markRateLimited(provider.name);
        errors.push("[" + provider.name + "] " + (error.message || "provider failure"));
      }
    }

    const err = new Error("All providers failed. " + errors.join(" | "));
    err.code = "ALL_PROVIDERS_FAILED";
    throw err;
  }

  configuredProviders() {
    const names = Array.from(
      new Set([
        ...this.getProviderChain("safe"),
        ...this.getProviderChain("balanced"),
        ...this.getProviderChain("fast"),
      ]),
    );
    return names
      .map((name) => this.buildProviderRuntime(name))
      .filter(Boolean)
      .map((provider) => ({
        name: provider.name,
        model: provider.model,
        type: provider.type,
      }));
  }
}

function sanitizeSignalLines(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, 300);
}

async function handleRecommend(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid JSON payload: " + error.message,
    });
  }

  const question = normalizeText(body.question) || "What should we build next?";
  const mode = normalizeText(body.mode) || "balanced";
  const signals = sanitizeSignalLines(body.signals);
  const history = Array.isArray(body.history) ? body.history.slice(0, 5) : [];
  if (!signals.length) {
    return jsonResponse(400, {
      ok: false,
      error: "At least one signal line is required.",
    });
  }

  const context = buildContextSystem({
    question,
    mode,
    signals,
    history,
  });

  const router = new WorkerModelRouter(env);
  try {
    const routed = await router.generateRecommendation({
      mode,
      context,
    });
    return jsonResponse(200, {
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
      return jsonResponse(503, {
        ok: false,
        code: error.code,
        error: error.message,
      });
    }
    return jsonResponse(502, {
      ok: false,
      code: error.code || "ROUTER_FAILED",
      error: error.message || "Model router failed.",
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(200, {
        ok: true,
        service: "cloudflare-worker-router",
      });
    }

    if (request.method === "GET" && url.pathname === "/api/router/status") {
      const router = new WorkerModelRouter(env);
      return jsonResponse(200, {
        ok: true,
        configuredProviders: router.configuredProviders(),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/recommend") {
      return handleRecommend(request, env);
    }

    return jsonResponse(404, {
      ok: false,
      error: "Not found",
    });
  },
};
