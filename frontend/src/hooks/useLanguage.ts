import { useCallback, useState } from "react";

const STORAGE_KEY = "english-app-language";

export const DEFAULT_LANGUAGE = "pt-BR";

export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh-CN", label: "简体中文" },
];

function getStoredLanguage(): string {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LANGUAGE;
}

export function useLanguage() {
  const [language, setLanguageState] = useState<string>(getStoredLanguage);

  const setLanguage = useCallback((language: string) => {
    localStorage.setItem(STORAGE_KEY, language);
    setLanguageState(language);
  }, []);

  return { language, setLanguage };
}
