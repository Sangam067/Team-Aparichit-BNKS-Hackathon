import { GoogleGenAI } from "@google/genai";

export function getGeminiAI() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

export function cleanAndParseJSON(rawText) {
  if (!rawText) throw new Error("Empty response from AI");

  let text = String(rawText).trim();

  // Strip markdown code fences
  if (text.includes("```")) {
    text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
  }

  // 1. Direct parse
  try {
    return JSON.parse(text);
  } catch {
    // 2. Extract outer object
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const extracted = text.substring(start, end + 1);
      try {
        return JSON.parse(extracted);
      } catch {
        // 3. Fix unescaped backslashes commonly caused by LaTeX (\alpha, \theta, \Delta, \sqrt)
        // Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
        const fixedSlashes = extracted.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        try {
          return JSON.parse(fixedSlashes);
        } catch {
          // 4. Fix unescaped control characters/newlines
          const sanitized = fixedSlashes.replace(/[\x00-\x1F\x7F-\x9F]/g, " ");
          return JSON.parse(sanitized);
        }
      }
    }
    throw new Error("Invalid JSON structure in AI response");
  }
}

export async function generateWithFallback({ contents, config = {} }) {
  const ai = getGeminiAI();
  const models = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          ...config,
        },
      });

      if (response && response.text) {
        return response;
      }
    } catch (err) {
      console.warn(`Gemini model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to respond.");
}

const defaultAI = {
  get models() {
    return getGeminiAI().models;
  },
};

export default defaultAI;