const MAX_AI_RESULTS = 8;

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

export function hasOpenAiReferenceProvider() {
  const provider = process.env.DEFAULT_AI_PROVIDER || "openai";
  return provider === "openai" && Boolean(process.env.OPENAI_API_KEY);
}

export async function discoverOpenAiReferences(query) {
  if (!hasOpenAiReferenceProvider()) {
    return [];
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
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
                "You find Hebrew Bible / Tanakh references for scripture search.",
                "Return references only. Do not quote scripture text.",
                "Prefer canonical book names and OSHB/Masoretic chapter numbering.",
                "Treat the user's words as possibly coming from any common English translation, including KJV, NKJV, ESV, NIV, NASB, or paraphrased memory.",
                "Use web search to identify references for remembered wording that differs from the local JPS wording.",
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
      tools: [{ type: "web_search", search_context_size: "low" }],
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
    return [];
  }

  const payload = await response.json();
  const text = extractResponseText(payload);
  const parsed = JSON.parse(text);

  return parsed.results ?? [];
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
