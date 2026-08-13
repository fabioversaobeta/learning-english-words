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
