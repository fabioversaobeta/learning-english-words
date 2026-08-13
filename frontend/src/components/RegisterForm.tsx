import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface RegisterFormProps {
  onSuccess: () => void;
  onGoToLogin: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm({ onSuccess, onGoToLogin }: RegisterFormProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(email.trim(), password);
      onSuccess();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 409
          ? "This email is already registered."
          : "Couldn't create your account. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="topic-form" onSubmit={handleSubmit}>
      <h1>Sign up</h1>
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
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          disabled={loading}
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          autoComplete="new-password"
        />
      </label>
      {error && <div className="error-banner">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? "Creating account..." : "Sign up"}
      </button>
      <button type="button" className="back-link" onClick={onGoToLogin}>
        Already have an account? Log in
      </button>
    </form>
  );
}
