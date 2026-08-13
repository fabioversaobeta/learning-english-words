import type { WordResult } from "./types";

// Must stay in sync with the fallback text in backend/src/routes/words.ts
export const DEFINITION_UNAVAILABLE = "Definition not available.";
export const TRANSLATION_UNAVAILABLE = "Translation not available.";

export function isMissingResult(result: WordResult): boolean {
  return (
    result.definition === DEFINITION_UNAVAILABLE || result.translation === TRANSLATION_UNAVAILABLE
  );
}
