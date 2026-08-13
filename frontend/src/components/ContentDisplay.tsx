interface ContentDisplayProps {
  title: string;
  content: string;
  selectedWords: string[];
  onToggleWord: (word: string) => void;
  knownWords?: string[];
}

const WORD_REGEX = /[A-Za-z][A-Za-z'-]*/g;

function normalize(word: string) {
  return word.toLowerCase();
}

export function ContentDisplay({
  title,
  content,
  selectedWords,
  onToggleWord,
  knownWords,
}: ContentDisplayProps) {
  const selectedSet = new Set(selectedWords);
  const knownSet = new Set(knownWords ?? []);

  const tokens: { text: string; isWord: boolean }[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(WORD_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ text: content.slice(lastIndex, index), isWord: false });
    }
    tokens.push({ text: match[0], isWord: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) {
    tokens.push({ text: content.slice(lastIndex), isWord: false });
  }

  return (
    <div className="content-display">
      <h2>{title}</h2>
      <p className="hint">Click the words you don't know.</p>
      <div className="content-text">
        {tokens.map((token, i) => {
          if (!token.isWord) {
            return <span key={i}>{token.text}</span>;
          }
          const word = normalize(token.text);
          const isKnown = knownSet.has(word);
          if (isKnown) {
            return (
              <span key={i} className="word-token known" title="Word already marked">
                {token.text}
              </span>
            );
          }
          const isSelected = selectedSet.has(word);
          return (
            <span
              key={i}
              className={`word-token ${isSelected ? "selected" : ""}`}
              onClick={() => onToggleWord(word)}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
