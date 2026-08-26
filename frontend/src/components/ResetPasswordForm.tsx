import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface ResetPasswordFormProps {
  token: string;
  onSuccess: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
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
      await resetPassword(token, password);
      onSuccess();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 400
          ? "This reset link is invalid or has expired. Please request a new one."
          : "Couldn't reset your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="topic-form" onSubmit={handleSubmit}>
      <h1>Reset password</h1>
      <label>
        New password
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
        Confirm new password
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
        {loading ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
