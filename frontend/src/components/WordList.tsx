import { SpeakButton } from "./SpeakButton";

interface WordListProps {
  words: string[];
  onRemove: (word: string) => void;
  onTranslate: () => void;
  loading: boolean;
}

export function WordList({ words, onRemove, onTranslate, loading }: WordListProps) {
  return (
    <aside className="word-list">
      <h3>Selected words ({words.length})</h3>
      {words.length === 0 && <p className="hint">No words selected yet.</p>}
      <ul>
        {words.map((word) => (
          <li key={word}>
            <span>{word}</span>
            <span className="word-actions">
              <SpeakButton word={word} />
              <button
                type="button"
                className="remove-btn"
                onClick={() => onRemove(word)}
                aria-label={`Remove ${word}`}
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="translate-btn"
        disabled={words.length === 0 || loading}
        onClick={onTranslate}
      >
        {loading ? "Translating..." : "Translate words"}
      </button>
    </aside>
  );
}
