import { Router } from "express";
import { pool } from "../db/pool";
import { translateWords } from "../services/claudeService";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { translateLimiter } from "../middleware/rateLimit";
import {
  DEFINITION_UNAVAILABLE,
  MAX_WORD_LENGTH,
  MAX_WORDS_PER_REQUEST,
  TRANSLATION_UNAVAILABLE,
} from "../constants";
import { TranslateWordsRequest, TranslateWordsResponse, WordResult } from "../types";

export const wordsRouter = Router();

wordsRouter.use(requireAuth);

function validateWordsPayload(
  body: TranslateWordsRequest
): { error: string } | null {
  const { topicId, words, language } = body;
  if (!topicId || !Array.isArray(words) || words.length === 0 || !language) {
    return { error: "topicId, language and a non-empty words array are required" };
  }
  if (words.length > MAX_WORDS_PER_REQUEST) {
    return { error: `At most ${MAX_WORDS_PER_REQUEST} words per request` };
  }
  if (words.some((w) => typeof w !== "string" || w.length === 0 || w.length > MAX_WORD_LENGTH)) {
    return { error: `Each word must be 1-${MAX_WORD_LENGTH} characters` };
  }
  return null;
}

wordsRouter.post(
  "/translate",
  translateLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body as TranslateWordsRequest;
    const validationError = validateWordsPayload(body);
    if (validationError) {
      res.status(400).json(validationError);
      return;
    }
    const { topicId, words, language } = body;

    const topicResult = await pool.query(`SELECT id FROM topics WHERE id = $1 AND user_id = $2`, [
      topicId,
      req.userId,
    ]);
    if (topicResult.rows.length === 0) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }

    const translations = await translateWords(words, language);

    const results: WordResult[] = words.map((word) => {
      const entry = translations[word];
      return {
        word,
        definition: entry?.definition ?? DEFINITION_UNAVAILABLE,
        translation: entry?.translation ?? TRANSLATION_UNAVAILABLE,
      };
    });

    await Promise.all(
      results.map((r) =>
        pool.query(
          `INSERT INTO words_learned (user_id, topic_id, english_word, definition, translation, language)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.userId, topicId, r.word, r.definition, r.translation, language]
        )
      )
    );

    const response: TranslateWordsResponse = { results };
    res.json(response);
  })
);

wordsRouter.post(
  "/retry",
  translateLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body as TranslateWordsRequest;
    const validationError = validateWordsPayload(body);
    if (validationError) {
      res.status(400).json(validationError);
      return;
    }
    const { topicId, words, language } = body;

    const topicResult = await pool.query(`SELECT id FROM topics WHERE id = $1 AND user_id = $2`, [
      topicId,
      req.userId,
    ]);
    if (topicResult.rows.length === 0) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }

    const translations = await translateWords(words, language);

    const results: WordResult[] = words.map((word) => {
      const entry = translations[word];
      return {
        word,
        definition: entry?.definition ?? DEFINITION_UNAVAILABLE,
        translation: entry?.translation ?? TRANSLATION_UNAVAILABLE,
      };
    });

    await Promise.all(
      results.map((r) =>
        pool.query(
          `UPDATE words_learned SET definition = $1, translation = $2, language = $3
           WHERE user_id = $4 AND topic_id = $5 AND english_word = $6`,
          [r.definition, r.translation, language, req.userId, topicId, r.word]
        )
      )
    );

    const response: TranslateWordsResponse = { results };
    res.json(response);
  })
);
