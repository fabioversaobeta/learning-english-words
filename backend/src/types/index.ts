export interface CreateTopicRequest {
  title: string;
  description: string;
}

export interface CreateTopicResponse {
  topicId: string;
  title: string;
  content: string;
}

export interface TranslateWordsRequest {
  topicId: string;
  words: string[];
  language: string;
}

export interface WordResult {
  word: string;
  definition: string;
  translation: string;
}

export interface TranslateWordsResponse {
  results: WordResult[];
}

export interface TopicSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface TopicDetailResponse extends TopicSummary {
  description: string;
  content: string;
  words: WordResult[];
}
