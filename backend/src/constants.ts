// Limits enforced before content is passed to the Claude API (cost control + abuse prevention).
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_WORDS_PER_REQUEST = 40;
export const MAX_WORD_LENGTH = 100;

// Fallback text stored when Claude doesn't return a definition/translation for a word.
// Must stay in sync with frontend/src/constants.ts.
export const DEFINITION_UNAVAILABLE = "Definition not available.";
export const TRANSLATION_UNAVAILABLE = "Translation not available.";
