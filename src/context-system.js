"use strict";

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

function normalize(text) {
  return String(text || "").trim();
}

function tokenize(text) {
  return normalize(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function inferSource(signalLine) {
  const lower = normalize(signalLine).toLowerCase();
  if (lower.startsWith("interview:")) return "interview";
  if (lower.startsWith("usage:")) return "usage";
  if (lower.startsWith("market:")) return "market";
  if (/\.json:\s|\.csv:\s|\.txt:\s|\.md:\s/.test(lower)) return "upload";
  return "other";
}

function countTerms(signalLine, terms) {
  const lower = normalize(signalLine).toLowerCase();
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
      const topName = normalize(item && item.topName) || "unknown";
      const when = normalize(item && item.timestamp) || "recent";
      return idx + 1 + ". " + topName + " (" + when + ")";
    });
}

function buildContextSystem(input) {
  const question = normalize(input && input.question) || "What should we build next?";
  const mode = normalize(input && input.mode) || "balanced";
  const signalLines = (Array.isArray(input && input.signals) ? input.signals : [])
    .map((line) => normalize(line))
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
    "You are a senior AI product strategist for a tool called Cursor for Product Managers.",
    "Goal: convert raw customer/usage/market signals into a concrete feature recommendation.",
    "You must return STRICT JSON only (no markdown, no prose around JSON).",
    "JSON schema:",
    "{",
    '  "name": "string",',
    '  "problem": "string",',
    '  "ui": ["string", "..."],',
    '  "data": ["string", "..."],',
    '  "workflow": ["string", "..."],',
    '  "tasks": ["string", "..."],',
    '  "evidence": ["string", "..."],',
    '  "themes": ["string", "..."],',
    '  "confidence": 0-100 number',
    "}",
    "Requirements:",
    "- Ground the output in provided signals.",
    "- Keep recommendations implementation-ready and specific.",
    "- Keep UI/data/workflow/task arrays non-empty.",
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
    severitySignalCount,
    historyHighlights,
    systemPrompt,
    userPrompt,
  };
}

module.exports = {
  buildContextSystem,
};
