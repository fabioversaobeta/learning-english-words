import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface LoginFormProps {
  onSuccess: () => void;
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
}

export function LoginForm({ onSuccess, onGoToRegister, onGoToForgotPassword }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? "Too many login attempts. Please try again later."
          : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="topic-form" onSubmit={handleSubmit}>
      <h1>Log in</h1>
      <label>
        E-mail
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          autoComplete="email"
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          autoComplete="current-password"
        />
      </label>
      {error && <div className="error-banner">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? "Logging in..." : "Log in"}
      </button>
      <button type="button" className="back-link" onClick={onGoToForgotPassword}>
        Forgot your password?
      </button>
      <button type="button" className="back-link" onClick={onGoToRegister}>
        Don't have an account? Sign up
      </button>
    </form>
  );
}
