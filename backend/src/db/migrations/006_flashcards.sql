-- Flashcards: spaced-repetition review of words the user already marked.
--
-- retention_level = current knowledge level of the word:
--   0 = not known / must be reviewed now (also the state of every brand new word)
--   1 = seen but unsure ("Tenho dúvida") — comes back after ~1 day
--   2..5 = increasing confidence; each level pushes the next review further out
-- A NULL next_review_at means "never reviewed yet" and is treated as due now.
ALTER TABLE words_learned
  ADD COLUMN IF NOT EXISTS retention_level SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

-- Supports the "which cards are due?" query, scoped per user + language.
CREATE INDEX IF NOT EXISTS idx_words_due
  ON words_learned (user_id, language, next_review_at);
