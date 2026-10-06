import { useEffect, useMemo, useState } from "react";
import { useApi } from "../hooks/useApi";
import type { TopicDetail, TopicSummary } from "../types";
import { SpeakButton } from "./SpeakButton";
import { ContentDisplay } from "./ContentDisplay";
import { WordList } from "./WordList";
import { useWordSelection } from "../hooks/useWordSelection";
import { isMissingResult } from "../constants";

interface HistoryViewProps {
  language: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function HistoryView({ language }: HistoryViewProps) {
  const { getTopics, getTopicDetail, translateWords, retryWords } = useApi();
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  const [detail, setDetail] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { selectedWords, toggleWord, removeWord, reset } = useWordSelection();

  useEffect(() => {
    setError(null);
    getTopics()
      .then((data) => setTopics(data.topics))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"));
  }, []);

  const knownWords = useMemo(() => detail?.words.map((w) => w.word) ?? [], [detail]);

  const openTopic = async (topicId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTopicDetail(topicId);
      reset();
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topic");
    } finally {
      setLoading(false);
    }
  };

  const closeTopic = () => {
    setDetail(null);
    reset();
  };

  const missingWords = useMemo(
    () => (detail?.words.filter(isMissingResult).map((w) => w.word) ?? []),
    [detail]
  );

  const handleRetryMissing = async () => {
    if (!detail || missingWords.length === 0) return;
    setRetrying(true);
    setError(null);
    try {
      const { results } = await retryWords(detail.id, missingWords, language);
      const retriedByWord = new Map(results.map((r) => [r.word, r]));
      setDetail((prev) =>
        prev ? { ...prev, words: prev.words.map((w) => retriedByWord.get(w.word) ?? w) } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry lookup");
    } finally {
      setRetrying(false);
    }
  };

  const handleTranslateNewWords = async () => {
    if (!detail || selectedWords.length === 0) return;
    setTranslating(true);
    setError(null);
    try {
      const { results } = await translateWords(detail.id, selectedWords, language);
      setDetail((prev) => (prev ? { ...prev, words: [...prev.words, ...results] } : prev));
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate words");
    } finally {
      setTranslating(false);
    }
  };

  if (detail) {
    return (
      <div className="history-detail">
        <button type="button" className="back-link" onClick={closeTopic}>
          ← Back to history
        </button>
        <p className="hint">{formatDate(detail.createdAt)}</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="content-step">
          <ContentDisplay
            title={detail.title}
            content={detail.content}
            selectedWords={selectedWords}
            knownWords={knownWords}
            onToggleWord={toggleWord}
          />
          <WordList
            words={selectedWords}
            onRemove={removeWord}
            onTranslate={handleTranslateNewWords}
            loading={translating}
          />
        </div>

        <h3>Marked words ({detail.words.length})</h3>
        {detail.words.length === 0 && <p className="hint">No words marked in this topic yet.</p>}
        {missingWords.length > 0 && (
          <div className="retry-banner">
            <span>
              {missingWords.length === 1
                ? "1 word is missing a definition/translation."
                : `${missingWords.length} words are missing a definition/translation.`}
            </span>
            <button type="button" onClick={handleRetryMissing} disabled={retrying}>
              {retrying ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}
        <div className="results-list">
          {detail.words.map((w) => (
            <div
              className={`result-card${isMissingResult(w) ? " result-card--missing" : ""}`}
              key={w.word}
            >
              <h3>
                {w.word}
                <SpeakButton word={w.word} />
              </h3>
              <p>
                <strong>Definition:</strong> {w.definition}
              </p>
              <p>
                <strong>Translation:</strong> {w.translation}
              </p>
              {w.example && (
                <p className="word-example">
                  <strong>Example:</strong> <em>{w.example}</em>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="history-list">
      <h2>Topic history</h2>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="hint">Loading...</p>}
      {topics === null && !error && <p className="hint">Loading...</p>}
      {topics && topics.length === 0 && (
        <p className="hint">No topics created yet.</p>
      )}
      <ul>
        {topics?.map((topic) => (
          <li key={topic.id}>
            <button type="button" onClick={() => openTopic(topic.id)}>
              <span className="history-item-title">{topic.title}</span>
              <span className="history-item-date">{formatDate(topic.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
