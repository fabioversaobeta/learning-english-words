-- The app had no authentication before this migration: topics/words_learned were
-- keyed by a free-text session_id trivially forgeable by any client. There is no
-- production deployment yet, so old rows are dropped instead of migrated.
DELETE FROM words_learned;
DELETE FROM topics;

ALTER TABLE topics DROP COLUMN session_id;
ALTER TABLE words_learned DROP COLUMN session_id;

ALTER TABLE topics ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE words_learned ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_topics_user_created ON topics(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_words_user ON words_learned(user_id);
