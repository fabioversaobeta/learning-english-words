import { Router } from "express";
import { pool } from "../db/pool";
import { generateTopicContent } from "../services/claudeService";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { topicCreationLimiter } from "../middleware/rateLimit";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from "../constants";
import {
  CreateTopicRequest,
  CreateTopicResponse,
  TopicDetailResponse,
  TopicSummary,
} from "../types";

export const topicsRouter = Router();

topicsRouter.use(requireAuth);

topicsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, title, created_at FROM topics
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    const topics: TopicSummary[] = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
    }));

    res.json({ topics });
  })
);

topicsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const topicResult = await pool.query(
      `SELECT id, title, description, content, created_at FROM topics
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (topicResult.rows.length === 0) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }

    const wordsResult = await pool.query(
      `SELECT english_word, definition, translation FROM words_learned
       WHERE topic_id = $1 AND user_id = $2
       ORDER BY learned_at ASC`,
      [id, req.userId]
    );

    const topic = topicResult.rows[0];
    const response: TopicDetailResponse = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      content: topic.content,
      createdAt: topic.created_at,
      words: wordsResult.rows.map((row) => ({
        word: row.english_word,
        definition: row.definition,
        translation: row.translation,
      })),
    };

    res.json(response);
  })
);

topicsRouter.post(
  "/",
  topicCreationLimiter,
  asyncHandler(async (req, res) => {
    const { title, description } = req.body as CreateTopicRequest;

    if (!title || !description) {
      res.status(400).json({ error: "title and description are required" });
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      res.status(400).json({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` });
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      res
        .status(400)
        .json({ error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
      return;
    }

    // "Day" = UTC calendar day, for simplicity and because it doesn't depend on the
    // user's local timezone. This assumes the Postgres server timezone is UTC,
    // which holds for both the local Docker Postgres image and Supabase defaults.
    //
    // The count check + reservation insert below run inside a per-user advisory
    // lock so two concurrent requests can't both pass the check and reserve 2
    // slots. The (slow, paid) Claude call happens *after* that short transaction
    // is committed, so it never holds a DB connection/lock.
    const client = await pool.connect();
    let topicId: string;
    let resolvedTitle: string;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [req.userId]);

      const countResult = await client.query(
        `SELECT COUNT(*) FROM topics WHERE user_id = $1 AND created_at >= date_trunc('day', now())`,
        [req.userId]
      );
      if (Number(countResult.rows[0].count) >= 1) {
        await client.query("ROLLBACK");
        const resetAt = new Date();
        resetAt.setUTCHours(24, 0, 0, 0);
        res.status(429).json({
          error: "You already created a topic today. Try again after it resets.",
          resetAt: resetAt.toISOString(),
        });
        return;
      }

      const insertResult = await client.query(
        `INSERT INTO topics (user_id, title, description, content)
         VALUES ($1, $2, $3, '')
         RETURNING id, title`,
        [req.userId, title, description]
      );
      await client.query("COMMIT");
      topicId = insertResult.rows[0].id;
      resolvedTitle = insertResult.rows[0].title;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    try {
      const content = await generateTopicContent(title, description);
      await pool.query(`UPDATE topics SET content = $1 WHERE id = $2`, [content, topicId]);

      const response: CreateTopicResponse = { topicId, title: resolvedTitle, content };
      res.json(response);
    } catch (err) {
      // Don't leave the user's daily slot consumed by a topic that has no content.
      await pool.query(`DELETE FROM topics WHERE id = $1`, [topicId]);
      throw err;
    }
  })
);
