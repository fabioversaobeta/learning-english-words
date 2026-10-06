import type {
  Flashcard,
  FlashcardRating,
  FlashcardStats,
  ReviewFlashcardResult,
  Topic,
  TopicDetail,
  TopicSummary,
  WordResult,
} from "../types";
import { apiRequest } from "../api/client";

function post<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function useApi() {
  const createTopic = (title: string, description: string) =>
    post<Topic>("/api/topics", { title, description });

  const translateWords = (topicId: string, words: string[], language: string) =>
    post<{ results: WordResult[] }>("/api/words/translate", { topicId, words, language });

  const retryWords = (topicId: string, words: string[], language: string) =>
    post<{ results: WordResult[] }>("/api/words/retry", { topicId, words, language });

  const getMissingExamplesCount = () =>
    apiRequest<{ count: number }>("/api/words/missing-examples");

  const fillMissingExamples = () => post<{ remaining: number }>("/api/words/fill-examples", {});

  const getTopics = () => apiRequest<{ topics: TopicSummary[] }>("/api/topics");

  const getTopicDetail = (topicId: string) => apiRequest<TopicDetail>(`/api/topics/${topicId}`);

  const getFlashcardQueue = (language: string, limit = 20) =>
    apiRequest<{ cards: Flashcard[] }>(
      `/api/flashcards/queue?language=${encodeURIComponent(language)}&limit=${limit}`
    );

  const getFlashcardStats = (language: string) =>
    apiRequest<FlashcardStats>(`/api/flashcards/stats?language=${encodeURIComponent(language)}`);

  const reviewFlashcard = (id: string, rating: FlashcardRating) =>
    post<ReviewFlashcardResult>(`/api/flashcards/${id}/review`, { rating });

  return {
    createTopic,
    translateWords,
    retryWords,
    getMissingExamplesCount,
    fillMissingExamples,
    getTopics,
    getTopicDetail,
    getFlashcardQueue,
    getFlashcardStats,
    reviewFlashcard,
  };
}
