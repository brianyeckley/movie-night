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
        // Bypassing theme selection if in person, passing undefined triggers default "In Person Physical Media"
        await createWeekAction(isInPerson ? undefined : theme, isInPerson);
      } catch (err: any) {
        console.error("Failed to start week:", err);
        setError(err.message || "Failed to start week. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md text-left">
      <div className="flex-col gap-xs mb-sm">
        <label className="form-label" style={{ fontWeight: "600", fontSize: "0.9rem" }}>
          Select Movie Night Mode
        </label>
        <div className="flex-row gap-md flex-wrap w-full">
          <div
            onClick={() => !isPending && setIsInPerson(false)}
            className={`flex-1 min-w-[200px] p-md glass-panel cursor-pointer flex-col gap-sm items-center text-center transition-all ${
              !isInPerson
                ? "border-primary bg-primary-light shadow-glow"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{
              borderRadius: "var(--radius-md)",
              border: !isInPerson ? "2px solid var(--primary)" : "1px solid var(--glass-border)",
              transform: !isInPerson ? "scale(1.02)" : "scale(1)",
              pointerEvents: isPending ? "none" : "auto",
            }}
          >
            <span className="text-4xl" style={{ display: "block", marginBottom: "4px" }}>🎬</span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">Standard Week</span>
              <span className="text-xs text-secondary">
                Theme category selection, movie nominations, and multi-round voting.
              </span>
            </div>
          </div>

          <div
            onClick={() => !isPending && setIsInPerson(true)}
            className={`flex-1 min-w-[200px] p-md glass-panel cursor-pointer flex-col gap-sm items-center text-center transition-all ${
              isInPerson
                ? "border-accent bg-accent-light shadow-glow-accent"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{
              borderRadius: "var(--radius-md)",
              border: isInPerson ? "2px solid var(--accent)" : "1px solid var(--glass-border)",
              transform: isInPerson ? "scale(1.02)" : "scale(1)",
              pointerEvents: isPending ? "none" : "auto",
            }}
          >
            <span className="text-4xl" style={{ display: "block", marginBottom: "4px" }}>🍿</span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">In Person Night</span>
              <span className="text-xs text-secondary">
                Skip category rounds. Users vote directly on physical media (4K, Blu-ray, DVD).
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isInPerson ? (
        <div className="form-group animate-slide-in">
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
        <div className="text-sm text-secondary italic mb-sm p-sm glass-panel text-center animate-slide-in" style={{ opacity: 0.9, backgroundColor: "var(--accent-light)", borderColor: "rgba(244, 63, 94, 0.2)" }}>
          ℹ️ The Theme will default to <strong>"In Person Physical Media"</strong> and the Category Selection round will be skipped.
        </div>
      )}

      {error && <div className="vote-error mb-sm">{error}</div>}

      <button
        type="submit"
        disabled={isPending}
        className={`btn w-full ${isInPerson ? "btn-accent" : "btn-primary"}`}
      >
        {isPending ? "Starting Week..." : "Start Week"}
      </button>
    </form>
  );
}

