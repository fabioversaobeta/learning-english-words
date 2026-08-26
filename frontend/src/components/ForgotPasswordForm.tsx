import { useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../api/client";

interface ForgotPasswordFormProps {
  onGoToLogin: () => void;
}

export function ForgotPasswordForm({ onGoToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? "Too many requests. Please try again later."
          : "Please provide a valid email address."
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="topic-form">
        <h1>Check your email</h1>
        <p>If that email is registered, we've sent a link to reset your password.</p>
        <button type="button" className="back-link" onClick={onGoToLogin}>
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <form className="topic-form" onSubmit={handleSubmit}>
      <h1>Forgot password</h1>
      <p>Enter your email and we'll send you a link to reset your password.</p>
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
      {error && <div className="error-banner">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </button>
      <button type="button" className="back-link" onClick={onGoToLogin}>
        Back to log in
      </button>
    </form>
  );
}
