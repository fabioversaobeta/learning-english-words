import { Router } from "express";
import { pool } from "../db/pool";
import { generateExamples, translateWords } from "../services/claudeService";
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
        example: entry?.example ?? "",
      };
    });

    await Promise.all(
      results.map((r) =>
        pool.query(
          `INSERT INTO words_learned (user_id, topic_id, english_word, definition, translation, example, language)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.userId, topicId, r.word, r.definition, r.translation, r.example, language]
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
        example: entry?.example ?? "",
      };
    });

    await Promise.all(
      results.map((r) =>
        pool.query(
          `UPDATE words_learned SET definition = $1, translation = $2, example = $3, language = $4
           WHERE user_id = $5 AND topic_id = $6 AND english_word = $7`,
          [r.definition, r.translation, r.example, language, req.userId, topicId, r.word]
        )
      )
    );

    const response: TranslateWordsResponse = { results };
    res.json(response);
  })
);

wordsRouter.get(
  "/missing-examples",
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM words_learned WHERE user_id = $1 AND example = ''`,
      [req.userId]
    );
    res.json({ count: result.rows[0].count });
  })
);

// Fills the example sentence of every word the user has without one.
wordsRouter.post(
  "/fill-examples",
  translateLimiter,
  asyncHandler(async (req, res) => {
    const wordsResult = await pool.query(
      `SELECT DISTINCT english_word FROM words_learned WHERE user_id = $1 AND example = ''`,
      [req.userId]
    );
    const words: string[] = wordsResult.rows.map((r) => r.english_word);

    for (let i = 0; i < words.length; i += MAX_WORDS_PER_REQUEST) {
      const chunk = words.slice(i, i + MAX_WORDS_PER_REQUEST);
      const examples = await generateExamples(chunk);
      await Promise.all(
        chunk
          .filter((w) => typeof examples[w] === "string" && examples[w].trim() !== "")
          .map((w) =>
            pool.query(
              `UPDATE words_learned SET example = $1
               WHERE user_id = $2 AND english_word = $3 AND example = ''`,
              [examples[w].trim(), req.userId, w]
            )
          )
      );
    }

    const remaining = await pool.query(
      `SELECT COUNT(*)::int AS count FROM words_learned WHERE user_id = $1 AND example = ''`,
      [req.userId]
    );
    res.json({ remaining: remaining.rows[0].count });
  })
);
