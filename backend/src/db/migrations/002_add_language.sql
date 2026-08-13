ALTER TABLE words_learned RENAME COLUMN pt_br_translation TO translation;
ALTER TABLE words_learned ADD COLUMN language TEXT NOT NULL DEFAULT 'pt-BR';
