import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import { useSpeech } from "../hooks/useSpeech";
import type { Flashcard, FlashcardRating, FlashcardStats } from "../types";

const QUEUE_LIMIT = 20;
const MAX_LEVEL = 5;

interface FlashcardsViewProps {
  language: string;
}

type Tally = Record<FlashcardRating, number>;
const EMPTY_TALLY: Tally = { known: 0, doubt: 0, unknown: 0 };

function RetentionDots({ level }: { level: number }) {
  return (
    <span className="retention-dots" title={`Nível de conhecimento: ${level} de ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`retention-dot${i < level ? " filled" : ""}`} />
      ))}
    </span>
  );
}

export function FlashcardsView({ language }: FlashcardsViewProps) {
  const { getFlashcardQueue, getFlashcardStats, reviewFlashcard } = useApi();
  const { speak, isSupported } = useSpeech();

  const [deck, setDeck] = useState<Flashcard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);

  const load = () => {
    setDeck(null);
    setPos(0);
    setRevealed(false);
    setTally(EMPTY_TALLY);
    setError(null);
    setSaveWarning(false);
    getFlashcardQueue(language, QUEUE_LIMIT)
      .then((data) => setDeck(data.cards))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Não foi possível carregar os flashcards")
      );
    getFlashcardStats(language)
      .then(setStats)
      .catch(() => setStats(null));
  };

  useEffect(() => {
    load();
    // Reload the deck whenever the translation language changes.
  }, [language]);

  const handleRate = async (card: Flashcard, rating: FlashcardRating) => {
    setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
    setRevealed(false);
    // "Não sei": the card goes back to the end of this session's deck so it
    // shows up again before the training finishes.
    if (rating === "unknown") {
      setDeck((d) => (d ? [...d, { ...card, retentionLevel: 0 }] : d));
    }
    setPos((p) => p + 1);
    try {
      await reviewFlashcard(card.id, rating);
    } catch {
      setSaveWarning(true);
    }
  };

  return (
    <div className="flashcards-view">
      <h2>Flashcards</h2>

      {stats && (
        <p className="flashcard-stats">
          {stats.total} {stats.total === 1 ? "palavra" : "palavras"} · {stats.due} para revisar ·{" "}
          {stats.mastered} {stats.mastered === 1 ? "dominada" : "dominadas"}
        </p>
      )}

      {error && (
        <div className="retry-banner">
          <span>{error}</span>
          <button type="button" onClick={load}>
            Tentar de novo
          </button>
        </div>
      )}

      {saveWarning && (
        <div className="flashcard-warning">
          Uma ou mais avaliações podem não ter sido salvas. Verifique sua conexão.
        </div>
      )}

      {!error && deck === null && <p className="hint">Carregando...</p>}

      {!error && deck !== null && deck.length === 0 && (
        <div className="flashcard-empty">
          {stats && stats.total === 0 ? (
            <p>
              Você ainda não marcou nenhuma palavra. Estude um assunto e marque as palavras que
              não conhece — elas aparecerão aqui como flashcards.
            </p>
          ) : (
            <p>
              Nenhum cartão para revisar agora. Volte mais tarde: novas palavras e revisões
              agendadas aparecem aqui automaticamente.
            </p>
          )}
        </div>
      )}

      {!error && deck !== null && deck.length > 0 && pos >= deck.length && (
        <div className="flashcard-done">
          <h3>Sessão concluída! 🎉</h3>
          <ul className="flashcard-tally">
            <li>
              <span className="fb-dot fb-dot--known" /> Aprendi: {tally.known}
            </li>
            <li>
              <span className="fb-dot fb-dot--doubt" /> Tenho dúvida: {tally.doubt}
            </li>
            <li>
              <span className="fb-dot fb-dot--unknown" /> Não sei: {tally.unknown}
            </li>
          </ul>
          <button type="button" className="flashcard-reveal" onClick={load}>
            Estudar mais
          </button>
        </div>
      )}

      {!error && deck !== null && pos < deck.length && (
        <FlashcardStudy
          card={deck[pos]}
          position={pos}
          total={deck.length}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onRate={handleRate}
          onSpeak={isSupported ? speak : null}
        />
      )}
    </div>
  );
}

interface FlashcardStudyProps {
  card: Flashcard;
  position: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
  onRate: (card: Flashcard, rating: FlashcardRating) => void;
  onSpeak: ((text: string) => void) | null;
}

function FlashcardStudy({
  card,
  position,
  total,
  revealed,
  onReveal,
  onRate,
  onSpeak,
}: FlashcardStudyProps) {
  return (
    <>
      <div className="flashcard-progress">
        <span>
          Cartão {position + 1} de {total}
        </span>
        <RetentionDots level={card.retentionLevel} />
      </div>

      {!revealed ? (
        <>
          <div
            className="flashcard"
            role="button"
            tabIndex={0}
            onClick={onReveal}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onReveal();
              }
            }}
          >
            <span className="flashcard-face-label">frente</span>
            <span className="flashcard-word">{card.word}</span>
            {onSpeak && (
              <button
                type="button"
                className="flashcard-audio"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(card.word);
                }}
              >
                🔊 Ouvir pronúncia
              </button>
            )}
            <span className="flashcard-hint">Clique no cartão para revelar</span>
          </div>
          <button type="button" className="flashcard-reveal" onClick={onReveal}>
            Revelar tradução
          </button>
        </>
      ) : (
        <>
          <div className="flashcard flashcard--back">
            <span className="flashcard-face-label">verso</span>
            <div className="flashcard-word-row">
              <span className="flashcard-word flashcard-word--sm">{card.word}</span>
              {onSpeak && (
                <button
                  type="button"
                  className="flashcard-audio flashcard-audio--sm"
                  onClick={() => onSpeak(card.word)}
                  aria-label={`Ouvir pronúncia de ${card.word}`}
                  title="Ouvir pronúncia"
                >
                  🔊
                </button>
              )}
            </div>
            <p className="flashcard-section">
              <strong>Definição</strong>
              {card.definition}
            </p>
            <p className="flashcard-section">
              <strong>Tradução</strong>
              {card.translation}
            </p>
            {card.example && (
              <p className="flashcard-section flashcard-example">
                <strong>Exemplo</strong>
                <em>{card.example}</em>{" "}
                {onSpeak && (
                  <button
                    type="button"
                    className="flashcard-audio flashcard-audio--sm"
                    onClick={() => onSpeak(card.example!)}
                    aria-label="Ouvir pronúncia da frase de exemplo"
                    title="Ouvir pronúncia"
                  >
                    🔊
                  </button>
                )}
              </p>
            )}
          </div>
          <div className="flashcard-feedback">
            <button
              type="button"
              className="fb fb--known"
              onClick={() => onRate(card, "known")}
            >
              🟢 Aprendi
            </button>
            <button
              type="button"
              className="fb fb--doubt"
              onClick={() => onRate(card, "doubt")}
            >
              🟡 Tenho dúvida
            </button>
            <button
              type="button"
              className="fb fb--unknown"
              onClick={() => onRate(card, "unknown")}
            >
              🔴 Não sei
            </button>
          </div>
        </>
      )}
    </>
  );
}
