import { useCallback, useState } from "react";

export function useWordSelection() {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);

  const toggleWord = useCallback((word: string) => {
    setSelectedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  }, []);

  const removeWord = useCallback((word: string) => {
    setSelectedWords((prev) => prev.filter((w) => w !== word));
  }, []);

  const reset = useCallback(() => setSelectedWords([]), []);

  return { selectedWords, toggleWord, removeWord, reset };
}
