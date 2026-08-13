CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS words_learned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  english_word TEXT NOT NULL,
  definition TEXT NOT NULL,
  pt_br_translation TEXT NOT NULL,
  learned_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_session ON topics(session_id);
CREATE INDEX IF NOT EXISTS idx_words_session ON words_learned(session_id);
