import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";

/**
 * Gemini Vision API client for multimodal analysis
 * Uses Gemini 2.5 Flash Preview for all vision tasks
 */

const VISION_MODEL = process.env.VISION_MODEL || "gemini-2.5-flash-preview-05-20";

let genAI: GoogleGenerativeAI | null = null;

/**
 * Get the Gemini AI instance (singleton)
 */
function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Get the vision model instance
 */
export function getVisionModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: VISION_MODEL,
    generationConfig: {
      temperature: 0.2, // Lower temperature for more deterministic outputs
      topP: 0.8,
      topK: 40,
    },
  });
}

/**
 * Convert an image buffer to a Gemini-compatible inline data part
 */
export function bufferToImagePart(buffer: Buffer, mimeType: string = "image/png"): Part {
  return {
    inlineData: {
      mimeType,
      data: buffer.toString("base64"),
    },
  };
}

/**
 * Parse JSON from Gemini response, handling markdown code blocks
 */
export function parseJsonFromResponse<T>(text: string): T {
  // Remove markdown code blocks if present
  let cleaned = text.trim();

  // Handle ```json ... ``` blocks
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  // Try to find JSON object or array
  const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON from Gemini response: ${text.substring(0, 200)}...`);
  }
}

export type { Part };
