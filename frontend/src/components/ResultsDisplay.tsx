import { useState } from "react";
import type { WordResult } from "../types";
import { SpeakButton } from "./SpeakButton";
import { isMissingResult } from "../constants";

interface ResultsDisplayProps {
  results: WordResult[];
  onRestart: () => void;
  onRetry: (words: string[]) => Promise<void>;
}

export function ResultsDisplay({ results, onRestart, onRetry }: ResultsDisplayProps) {
  const [retrying, setRetrying] = useState(false);
  const missingWords = results.filter(isMissingResult).map((r) => r.word);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(missingWords);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="results-display">
      <h2>Meanings and translations</h2>
      {missingWords.length > 0 && (
        <div className="retry-banner">
          <span>
            {missingWords.length === 1
              ? "1 word is missing a definition/translation."
              : `${missingWords.length} words are missing a definition/translation.`}
          </span>
          <button type="button" onClick={handleRetry} disabled={retrying}>
            {retrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
      <div className="results-list">
        {results.map((r) => (
          <div
            className={`result-card${isMissingResult(r) ? " result-card--missing" : ""}`}
            key={r.word}
          >
            <h3>
              {r.word}
              <SpeakButton word={r.word} />
            </h3>
            <p>
              <strong>Definition:</strong> {r.definition}
            </p>
            <p>
              <strong>Translation:</strong> {r.translation}
            </p>
            {r.example && (
              <p className="word-example">
                <strong>Example:</strong> <em>{r.example}</em>
              </p>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={onRestart}>
        New topic
      </button>
    </div>
  );
}
