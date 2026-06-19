"use client";

import { useState, useTransition } from "react";
import { createWeekAction } from "@/app/actions/week";

interface ThemeCategory {
  id: string;
  name: string;
}

interface AdminStartWeekFormClientProps {
  themeCategories: ThemeCategory[];
}

export default function AdminStartWeekFormClient({
  themeCategories,
}: AdminStartWeekFormClientProps) {
  const [isInPerson, setIsInPerson] = useState(false);
  const [theme, setTheme] = useState(
    themeCategories.length > 0 ? themeCategories[0].name : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        // If in person, pass empty string or select theme, server action handles defaulting
        await createWeekAction(isInPerson ? theme : theme, isInPerson);
      } catch (err: any) {
        console.error("Failed to start week:", err);
        setError(err.message || "Failed to start week. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md text-left">
      <div className="form-group flex-row items-center gap-sm" style={{ marginBottom: "8px" }}>
        <input
          id="in-person-checkbox"
          type="checkbox"
          checked={isInPerson}
          disabled={isPending}
          onChange={(e) => setIsInPerson(e.target.checked)}
          className="vote-checkbox"
        />
        <label
          htmlFor="in-person-checkbox"
          className="form-label cursor-pointer"
          style={{ marginBottom: 0, fontWeight: "600" }}
        >
          In Person Movie Night (Physical Media Only)
        </label>
      </div>

      {!isInPerson ? (
        <div className="form-group">
          <label htmlFor="week-theme" className="form-label">
            Theme Category
          </label>
          {themeCategories.length > 0 ? (
            <select
              id="week-theme"
              value={theme}
              disabled={isPending}
              onChange={(e) => setTheme(e.target.value)}
              required={!isInPerson}
              className="form-select w-full"
            >
              {themeCategories.map((themeOption) => (
                <option key={themeOption.id} value={themeOption.name}>
                  {themeOption.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="week-theme"
              type="text"
              value={theme}
              disabled={isPending}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="No themes found. Type to create..."
              required={!isInPerson}
              className="form-input w-full"
            />
          )}
        </div>
      ) : (
        <div className="text-sm text-secondary italic mb-sm" style={{ opacity: 0.8 }}>
          ℹ️ Theme will default to <strong>"In Person Physical Media"</strong> and the categories round will be skipped.
        </div>
      )}

      {error && <div className="vote-error mb-sm">{error}</div>}

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? "Starting Week..." : "Start Week"}
      </button>
    </form>
  );
}
