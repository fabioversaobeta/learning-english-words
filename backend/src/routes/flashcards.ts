import { Router } from "express";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { DEFINITION_UNAVAILABLE, TRANSLATION_UNAVAILABLE } from "../constants";
import {
  FlashcardQueueResponse,
  FlashcardRating,
  FlashcardStatsResponse,
  ReviewFlashcardResponse,
} from "../types";

export const flashcardsRouter = Router();

flashcardsRouter.use(requireAuth);

const DEFAULT_QUEUE_LIMIT = 20;
const MAX_QUEUE_LIMIT = 50;
const MAX_LEVEL = 5;

// How many days until a card is due again, keyed by the level it lands on after
// a "known" answer. Higher level => the word is shown less often.
const REVIEW_INTERVALS_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };

const VALID_RATINGS: FlashcardRating[] = ["known", "doubt", "unknown"];

function parseLanguage(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// GET /api/flashcards/queue?language=pt-BR&limit=20
// Returns the words that are due for review, one row per distinct word.
flashcardsRouter.get(
  "/queue",
  asyncHandler(async (req, res) => {
    const language = parseLanguage(req.query.language);
    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_QUEUE_LIMIT)
        : DEFAULT_QUEUE_LIMIT;

    const result = await pool.query(
      `SELECT id, word, definition, translation, retention_level
       FROM (
         SELECT DISTINCT ON (lower(english_word))
           id,
           english_word AS word,
           definition,
           translation,
           retention_level
         FROM words_learned
         WHERE user_id = $1
           AND ($2::text IS NULL OR language = $2)
           AND definition <> $3
           AND translation <> $4
           AND (next_review_at IS NULL OR next_review_at <= now())
         ORDER BY lower(english_word), next_review_at ASC NULLS FIRST, retention_level ASC
       ) due
       ORDER BY retention_level ASC, random()
       LIMIT $5`,
      [req.userId, language, DEFINITION_UNAVAILABLE, TRANSLATION_UNAVAILABLE, limit]
    );

    const response: FlashcardQueueResponse = {
      cards: result.rows.map((row) => ({
        id: row.id,
        word: row.word,
        definition: row.definition,
        translation: row.translation,
        retentionLevel: row.retention_level,
      })),
    };
    res.json(response);
  })
);

// GET /api/flashcards/stats?language=pt-BR
flashcardsRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const language = parseLanguage(req.query.language);

    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE next_review_at IS NULL OR next_review_at <= now())::int AS due,
         COUNT(*) FILTER (WHERE retention_level >= $2)::int AS mastered
       FROM (
         SELECT DISTINCT ON (lower(english_word)) retention_level, next_review_at
         FROM words_learned
         WHERE user_id = $1
           AND ($3::text IS NULL OR language = $3)
           AND definition <> $4
           AND translation <> $5
         ORDER BY lower(english_word), next_review_at ASC NULLS FIRST, retention_level ASC
       ) w`,
      [req.userId, MAX_LEVEL, language, DEFINITION_UNAVAILABLE, TRANSLATION_UNAVAILABLE]
    );

    const row = result.rows[0];
    const response: FlashcardStatsResponse = {
      total: row.total,
      due: row.due,
      mastered: row.mastered,
    };
    res.json(response);
  })
);

// POST /api/flashcards/:id/review  { rating: "known" | "doubt" | "unknown" }
flashcardsRouter.post(
  "/:id/review",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating } = req.body as { rating?: string };

    if (!rating || !VALID_RATINGS.includes(rating as FlashcardRating)) {
      res.status(400).json({ error: `rating must be one of: ${VALID_RATINGS.join(", ")}` });
      return;
    }

    const existing = await pool.query(
      `SELECT retention_level FROM words_learned WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "Flashcard not found" });
      return;
    }

    const currentLevel = existing.rows[0].retention_level as number;

    let newLevel: number;
    let nextReviewExpr: string;
    if (rating === "known") {
      newLevel = Math.min(currentLevel + 1, MAX_LEVEL);
      const days = REVIEW_INTERVALS_DAYS[Math.max(newLevel, 1)] ?? 1;
      nextReviewExpr = `now() + interval '${days} days'`;
    } else if (rating === "doubt") {
      // Intermediate status: keep it in heavy rotation (back tomorrow).
      newLevel = 1;
      nextReviewExpr = `now() + interval '1 day'`;
    } else {
      // "unknown": reset and make it due again immediately. The current study
      // session also re-queues the card client-side so it reappears right away.
      newLevel = 0;
      nextReviewExpr = `now()`;
    }

    const updated = await pool.query(
      `UPDATE words_learned
       SET retention_level = $1,
           review_count = review_count + 1,
           last_reviewed_at = now(),
           next_review_at = ${nextReviewExpr}
       WHERE id = $2 AND user_id = $3
       RETURNING id, retention_level, next_review_at`,
      [newLevel, id, req.userId]
    );

    const response: ReviewFlashcardResponse = {
      id: updated.rows[0].id,
      retentionLevel: updated.rows[0].retention_level,
      nextReviewAt: updated.rows[0].next_review_at,
    };
    res.json(response);
  })
);
