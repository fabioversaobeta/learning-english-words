import { useSpeech } from "../hooks/useSpeech";

interface SpeakButtonProps {
  word: string;
}

export function SpeakButton({ word }: SpeakButtonProps) {
  const { speak, isSupported } = useSpeech();

  if (!isSupported) return null;

  return (
    <button
      type="button"
      className="speak-btn"
      onClick={(e) => {
        e.stopPropagation();
        speak(word);
      }}
      aria-label={`Listen to pronunciation of ${word}`}
      title="Listen to pronunciation"
    >
      🔊
    </button>
  );
}
