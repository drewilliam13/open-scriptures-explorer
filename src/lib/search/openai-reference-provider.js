const MAX_AI_RESULTS = 8;
const DEFAULT_AI_TIMEOUT_MS = 8000;

const AI_REFERENCE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reference: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["reference", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

export class OpenAiReferenceProviderError extends Error {
  constructor(message, { status = null, code = null, type = null } = {}) {
    super(message);
    this.name = "OpenAiReferenceProviderError";
    this.status = status;
    this.code = code;
    this.type = type;
  }
}

export function hasOpenAiReferenceProvider() {
  const provider = process.env.DEFAULT_AI_PROVIDER || "openai";
  return provider === "openai" && Boolean(process.env.OPENAI_API_KEY);
}

export async function discoverOpenAiReferences(query) {
  if (!hasOpenAiReferenceProvider()) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getOpenAiTimeoutMs());

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You identify Hebrew Bible / Tanakh references from user queries using your trained knowledge of Bible wording, references, and common translations.",
                  "Return references only. Do not quote scripture text. Do not provide commentary or explanations.",
                  "Prefer canonical book names and OSHB/Masoretic chapter numbering.",
                  "Treat the user's words as possibly coming from any common English translation, including KJV, NKJV, ESV, NIV, NASB, JPS, or paraphrased memory.",
                  "Set confidence based on your trained recognition of how strongly the user query identifies this reference, including remembered wording from common translations, paraphrases, and exact references.",
                  "Do not lower confidence merely because the matching translation text is not available locally.",
                  "When the query looks like a partial quotation, prioritize exact or near-exact cross-translation quotation matches over topical similarity.",
                  "For example, wording like 'to the law and to the testimony if they speak not according to this word' should resolve to Isaiah 8:20.",
                  "Return only high-confidence candidate references; omit topical guesses.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Find up to ${MAX_AI_RESULTS} likely Tanakh references for this query: ${query}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ScriptureReferenceResults",
            strict: true,
            schema: AI_REFERENCE_SCHEMA,
          },
        },
        store: false,
      }),
    });

    if (!response.ok) {
      throw await createOpenAiResponseError(response);
    }

    const payload = await response.json();
    const text = extractResponseText(payload);
    const parsed = JSON.parse(text);

    return parsed.results ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

async function createOpenAiResponseError(response) {
  const fallbackMessage = `OpenAI reference discovery failed with HTTP ${response.status}.`;

  try {
    const payload = await response.json();
    return new OpenAiReferenceProviderError(payload.error?.message ?? fallbackMessage, {
      status: response.status,
      code: payload.error?.code ?? null,
      type: payload.error?.type ?? null,
    });
  } catch {
    return new OpenAiReferenceProviderError(fallbackMessage, { status: response.status });
  }
}

function getOpenAiTimeoutMs() {
  const parsed = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_AI_TIMEOUT_MS;
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const textParts = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n");
}
