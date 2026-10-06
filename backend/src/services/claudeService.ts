import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-haiku-4-5-20251001";

function extractText(message: Anthropic.Messages.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function generateTopicContent(
  title: string,
  description: string
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Write an educational text in English about "${title}".
Context/description: ${description}

Audience: an intermediate English learner who also wants to learn about this subject.
Make it clear and well-structured (use short paragraphs), technically accurate, and natural English.
Return PLAIN TEXT ONLY: no markdown (no #, **, backticks, bullet lists, or code fences), just
paragraphs separated by blank lines. If you need to show code, describe it in prose instead.
Return only the text, no preamble.`,
      },
    ],
  });
  return extractText(message);
}

interface WordEntry {
  definition: string;
  translation: string;
  example?: string;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  "pt-BR": "Portuguese (Brazil)",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Simplified Chinese",
};

export async function translateWords(
  words: string[],
  language: string
): Promise<Record<string, WordEntry>> {
  if (words.length === 0) return {};

  const languageName = LANGUAGE_NAMES[language] ?? language;

  let message: Anthropic.Messages.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `For each English word or expression below, provide:
1. "definition": a dictionary-style definition in English.
2. "translation": the ${languageName} translation.
3. "example": one natural English sentence using the word/expression, showing how it is used in context (keep it short and clear, suitable for an intermediate learner).

Words: ${words.join(", ")}

Respond with ONLY a JSON object, no markdown fences, no extra text, in this exact shape:
{ "word": { "definition": "...", "translation": "...", "example": "..." }, ... }
Use the exact same word/casing as given as the key.`,
        },
      ],
    });
  } catch (err) {
    console.error("translateWords: Claude API call failed", err);
    return {};
  }

  const text = extractText(message);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("translateWords: no JSON object found in Claude response:", text);
    return {};
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("translateWords: failed to parse JSON from Claude response:", text, err);
    return {};
  }
}
