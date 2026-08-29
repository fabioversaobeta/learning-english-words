export interface Topic {
  topicId: string;
  title: string;
  content: string;
}

export interface WordResult {
  word: string;
  definition: string;
  translation: string;
}

export interface TopicSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface TopicDetail extends TopicSummary {
  description: string;
  content: string;
  words: WordResult[];
}

export type FlashcardRating = "known" | "doubt" | "unknown";

export interface Flashcard {
  id: string;
  word: string;
  definition: string;
  translation: string;
  retentionLevel: number;
}

export interface ReviewFlashcardResult {
  id: string;
  retentionLevel: number;
  nextReviewAt: string | null;
}

export interface FlashcardStats {
  total: number;
  due: number;
  mastered: number;
}
