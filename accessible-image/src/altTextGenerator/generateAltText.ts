export type AIProvider = "openai" | "anthropic" | "gemini";

interface GenerateAltTextOptions {
  imageUrl: string;
  apiKey: string;
  model: string;
  provider: AIProvider;
  context?: string;
}

const SYSTEM_PROMPT = `You are an accessibility expert. Generate concise, descriptive alt text for the given image. The alt text should:
- Describe the key visual content and context
- Be concise but informative (typically 1-2 sentences)
- Not start with "Image of" or "Photo of"
- Focus on what is meaningful about the image
- Be useful for someone who cannot see the image`;

export async function generateAltText({
  imageUrl,
  apiKey,
  model,
  provider,
  context,
}: GenerateAltTextOptions): Promise<string> {
  const userPrompt = context
    ? `Generate alt text for this image. Context: ${context}`
    : "Generate alt text for this image.";

  if (provider === "anthropic") {
    return generateWithAnthropic({ imageUrl, apiKey, model, userPrompt });
  }
  if (provider === "gemini") {
    return generateWithGemini({ imageUrl, apiKey, model, userPrompt });
  }
  return generateWithOpenAI({ imageUrl, apiKey, model, userPrompt });
}

async function generateWithOpenAI({
  imageUrl,
  apiKey,
  model,
  userPrompt,
}: {
  imageUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
}): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || "";
}

async function generateWithAnthropic({
  imageUrl,
  apiKey,
  model,
  userPrompt,
}: {
  imageUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
}): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
  return textBlock?.text?.trim() || "";
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const blob = await response.blob();
  const mimeType = blob.type || "image/jpeg";
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
  );
  return { base64, mimeType };
}

async function generateWithGemini({
  imageUrl,
  apiKey,
  model,
  userPrompt,
}: {
  imageUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
}): Promise<string> {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error?.error?.message || `Gemini API error: ${response.status}`,
    );
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p: { text?: string }) => p.text || "").join("").trim();
}

export const OPENAI_MODELS = [
  { value: "gpt-4o", title: "GPT-4o" },
  { value: "gpt-4o-mini", title: "GPT-4o Mini" },
  { value: "gpt-4-turbo", title: "GPT-4 Turbo" },
];

export const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", title: "Claude Sonnet 4" },
  { value: "claude-haiku-4-5-20251001", title: "Claude Haiku 4.5" },
];

export const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", title: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", title: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash", title: "Gemini 2.0 Flash" },
];

export interface ModelOption {
  value: string;
  title: string;
}

export async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models from OpenAI");
  }

  const data = await response.json();

  const visionModels = data.data
    .filter((m: { id: string }) => {
      const id = m.id.toLowerCase();
      return (
        (id.startsWith("gpt-4o") ||
          id.startsWith("gpt-4-turbo") ||
          id === "gpt-4-vision-preview") &&
        !id.includes("audio") &&
        !id.includes("realtime") &&
        !id.includes(":ft-") &&
        !id.includes("search") &&
        !id.includes("transcribe")
      );
    })
    .map((m: { id: string }) => ({
      value: m.id,
      title: m.id.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
    }))
    .sort((a: ModelOption, b: ModelOption) => a.title.localeCompare(b.title));

  return visionModels.length > 0 ? visionModels : OPENAI_MODELS;
}
