import type { Topic, TopicDetail, TopicSummary, WordResult } from "../types";
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

  const getTopics = () => apiRequest<{ topics: TopicSummary[] }>("/api/topics");

  const getTopicDetail = (topicId: string) => apiRequest<TopicDetail>(`/api/topics/${topicId}`);

  return { createTopic, translateWords, retryWords, getTopics, getTopicDetail };
}
