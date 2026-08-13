import { useState } from "react";
import type { FormEvent } from "react";

interface TopicFormProps {
  onSubmit: (title: string, description: string) => void;
  loading: boolean;
  blockedUntil?: string | null;
}

export function TopicForm({ onSubmit, loading, blockedUntil }: TopicFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const blocked = Boolean(blockedUntil);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit(title.trim(), description.trim());
  };

  return (
    <form className="topic-form" onSubmit={handleSubmit}>
      <h1>New topic</h1>
      {blocked && (
        <div className="error-banner">
          You already created a topic today (1 per day). Try again after{" "}
          {new Date(blockedUntil!).toLocaleString()}.
        </div>
      )}
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="E.g.: React Hooks"
          disabled={loading || blocked}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you want to learn about this topic"
          rows={4}
          disabled={loading || blocked}
        />
      </label>
      <button type="submit" disabled={loading || blocked}>
        {loading ? "Generating..." : blocked ? "Limit reached for today" : "Generate content"}
      </button>
    </form>
  );
}
