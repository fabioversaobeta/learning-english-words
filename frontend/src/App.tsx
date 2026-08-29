import { useEffect, useState } from "react";
import { Home } from "./components/Home";
import { TopicForm } from "./components/TopicForm";
import { ContentDisplay } from "./components/ContentDisplay";
import { WordList } from "./components/WordList";
import { ResultsDisplay } from "./components/ResultsDisplay";
import { HistoryView } from "./components/HistoryView";
import { FlashcardsView } from "./components/FlashcardsView";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { ForgotPasswordForm } from "./components/ForgotPasswordForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { useApi } from "./hooks/useApi";
import { useWordSelection } from "./hooks/useWordSelection";
import { useAuth } from "./hooks/useAuth";
import { LANGUAGE_OPTIONS, useLanguage } from "./hooks/useLanguage";
import type { Topic, WordResult } from "./types";
import "./App.css";

type Step =
  | "home"
  | "topic"
  | "content"
  | "results"
  | "history"
  | "flashcards"
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password";
type ProtectedStep = "topic" | "content" | "results" | "history" | "flashcards";

// A password reset link points at "/?reset_token=..." (no client-side router
// in this app), so the token is picked up from the URL once on first render.
const initialResetToken = new URLSearchParams(window.location.search).get("reset_token");

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [step, setStep] = useState<Step>(initialResetToken ? "reset-password" : "home");
  const [resetToken, setResetToken] = useState<string | null>(initialResetToken);
  const [redirectStep, setRedirectStep] = useState<ProtectedStep>("topic");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [results, setResults] = useState<WordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyLimitResetAt, setDailyLimitResetAt] = useState<string | null>(null);

  const { createTopic, translateWords, retryWords } = useApi();
  const { selectedWords, toggleWord, removeWord, reset } = useWordSelection();

  useEffect(() => {
    if (initialResetToken) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleRestart = () => {
    setTopic(null);
    setResults([]);
    reset();
    setError(null);
    setDailyLimitResetAt(null);
    setStep("topic");
  };

  const goToProtected = (target: ProtectedStep) => {
    if (!user) {
      setRedirectStep(target);
      setStep("login");
      return;
    }
    if (target === "topic") {
      handleRestart();
    } else {
      setStep(target);
    }
  };

  const handleAuthSuccess = () => {
    if (redirectStep === "topic") {
      handleRestart();
    } else {
      setStep(redirectStep);
    }
  };

  const handleLogout = async () => {
    await logout();
    setTopic(null);
    setResults([]);
    reset();
    setStep("home");
  };

  const handleCreateTopic = async (title: string, description: string) => {
    setLoading(true);
    setError(null);
    try {
      const newTopic = await createTopic(title, description);
      setTopic(newTopic);
      setStep("content");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        const resetAt = (err as { resetAt?: string }).resetAt;
        setDailyLimitResetAt(resetAt ?? new Date().toISOString());
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate content");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!topic) return;
    setLoading(true);
    setError(null);
    try {
      const { results: translated } = await translateWords(topic.topicId, selectedWords, language);
      setResults(translated);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate words");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryResults = async (words: string[]) => {
    if (!topic || words.length === 0) return;
    setError(null);
    try {
      const { results: retried } = await retryWords(topic.topicId, words, language);
      const retriedByWord = new Map(retried.map((r) => [r.word, r]));
      setResults((prev) => prev.map((r) => retriedByWord.get(r.word) ?? r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry lookup");
    }
  };

  return (
    <div className="app">
      <nav className="top-nav">
        <button type="button" className="brand" onClick={() => setStep("home")}>
          <svg
            className="brand-mark"
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1h14v18l-7-4-7 4V1z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <span className="brand-text">Words</span>
          <span className="brand-sub">EN &rarr; your language</span>
        </button>
        <div className="nav-links">
          <button
            type="button"
            className={step === "home" ? "active" : ""}
            onClick={() => setStep("home")}
          >
            Home
          </button>
          <button
            type="button"
            className={step === "topic" || step === "content" || step === "results" ? "active" : ""}
            onClick={() => goToProtected("topic")}
          >
            New topic
          </button>
          <button
            type="button"
            className={step === "flashcards" ? "active" : ""}
            onClick={() => goToProtected("flashcards")}
          >
            Flashcards
          </button>
          <button
            type="button"
            className={step === "history" ? "active" : ""}
            onClick={() => goToProtected("history")}
          >
            History
          </button>
          {!authLoading && user && (
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          )}
          {!authLoading && !user && (
            <>
              <button
                type="button"
                className={step === "login" ? "active" : ""}
                onClick={() => setStep("login")}
              >
                Log in
              </button>
              <button
                type="button"
                className={step === "register" ? "active" : ""}
                onClick={() => setStep("register")}
              >
                Sign up
              </button>
            </>
          )}
        </div>
        <select
          className="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Translation language"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </nav>

      {error && <div className="error-banner">{error}</div>}

      {step === "home" && (
        <Home onStart={() => goToProtected("topic")} onHistory={() => goToProtected("history")} />
      )}

      {step === "login" && (
        <LoginForm
          onSuccess={handleAuthSuccess}
          onGoToRegister={() => setStep("register")}
          onGoToForgotPassword={() => setStep("forgot-password")}
        />
      )}

      {step === "register" && (
        <RegisterForm onSuccess={handleAuthSuccess} onGoToLogin={() => setStep("login")} />
      )}

      {step === "forgot-password" && (
        <ForgotPasswordForm onGoToLogin={() => setStep("login")} />
      )}

      {step === "reset-password" && resetToken && (
        <ResetPasswordForm
          token={resetToken}
          onSuccess={() => {
            setResetToken(null);
            setStep("home");
          }}
        />
      )}

      {step === "topic" && user && (
        <TopicForm onSubmit={handleCreateTopic} loading={loading} blockedUntil={dailyLimitResetAt} />
      )}

      {step === "content" && topic && user && (
        <div className="content-step">
          <ContentDisplay
            title={topic.title}
            content={topic.content}
            selectedWords={selectedWords}
            onToggleWord={toggleWord}
          />
          <WordList
            words={selectedWords}
            onRemove={removeWord}
            onTranslate={handleTranslate}
            loading={loading}
          />
        </div>
      )}

      {step === "results" && user && (
        <ResultsDisplay results={results} onRestart={handleRestart} onRetry={handleRetryResults} />
      )}

      {step === "flashcards" && user && <FlashcardsView language={language} />}

      {step === "history" && user && <HistoryView language={language} />}
    </div>
  );
}

export default App;
