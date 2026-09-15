"use client";

import { useState, useTransition } from "react";
import { Clapperboard, Info, Popcorn, Sparkles } from "lucide-react";
import { createWeekAction } from "@/app/actions/week";
import type { Theme } from "@/lib/types";

interface AdminStartWeekFormClientProps {
  themes: Theme[];
}

type WeekMode = "standard" | "theme-week" | "in-person";

export default function AdminStartWeekFormClient({
  themes,
}: AdminStartWeekFormClientProps) {
  const [mode, setMode] = useState<WeekMode>("standard");
  const [theme, setTheme] = useState(themes.length > 0 ? themes[0].name : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (mode === "in-person") {
          await createWeekAction(undefined, true, false);
        } else if (mode === "theme-week") {
          await createWeekAction(theme, false, true);
        } else {
          await createWeekAction(theme, false, false);
        }
      } catch (err) {
        console.error("Failed to start week:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to start week. Please try again."
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md text-left">
      <fieldset className="flex-col gap-xs mb-sm">
        <legend className="form-label mode-picker-label mb-md">
          Select Movie Night Mode
        </legend>
        <div className="mode-picker">
          <label
            className={`glass-panel mode-option mode-option-standard ${
              mode === "standard" ? "selected" : ""
            }`}
            aria-disabled={isPending}
          >
            <input
              type="radio"
              name="weekMode"
              value="standard"
              checked={mode === "standard"}
              disabled={isPending}
              onChange={() => setMode("standard")}
            />
            <span className="mode-option-icon">
              <Clapperboard size="1em" strokeWidth={1} className="inline-icon" />
            </span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">Standard Week</span>
              <span className="text-xs text-secondary">
                Theme category selection, movie nominations, and multi-round voting.
              </span>
            </div>
          </label>

          <label
            className={`glass-panel mode-option mode-option-theme-week ${
              mode === "theme-week" ? "selected" : ""
            }`}
            aria-disabled={isPending}
          >
            <input
              type="radio"
              name="weekMode"
              value="theme-week"
              checked={mode === "theme-week"}
              disabled={isPending}
              onChange={() => setMode("theme-week")}
            />
            <span className="mode-option-icon">
              <Sparkles size="1em" strokeWidth={1} className="inline-icon" />
            </span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">Dedicated Theme Week</span>
              <span className="text-xs text-secondary">
                Skip category voting! Vote directly on movies tagged with this theme (Halloween, Christmas, etc.).
              </span>
            </div>
          </label>

          <label
            className={`glass-panel mode-option mode-option-in-person ${
              mode === "in-person" ? "selected" : ""
            }`}
            aria-disabled={isPending}
          >
            <input
              type="radio"
              name="weekMode"
              value="in-person"
              checked={mode === "in-person"}
              disabled={isPending}
              onChange={() => setMode("in-person")}
            />
            <span className="mode-option-icon">
              <Popcorn size="1em" strokeWidth={1} className="inline-icon" />
            </span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">In Person Night</span>
              <span className="text-xs text-secondary">
                Skip category rounds. Users vote directly on physical media (4K, Blu-ray, DVD).
              </span>
            </div>
          </label>
        </div>
      </fieldset>

      {mode !== "in-person" ? (
        <div className="form-group animate-slide-in">
          <label htmlFor="week-theme" className="form-label">
            Theme
          </label>
          {themes.length > 0 ? (
            <select
              id="week-theme"
              value={theme}
              disabled={isPending}
              onChange={(e) => setTheme(e.target.value)}
              required
              className="form-select w-full"
            >
              {themes.map((themeOption) => (
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
              required
              className="form-input w-full"
            />
          )}

          {mode === "theme-week" && (
            <div className="text-sm text-secondary italic mt-xs p-sm glass-panel text-center animate-slide-in" style={{ opacity: 0.9, backgroundColor: "var(--accent-light)", borderColor: "rgba(244, 63, 94, 0.2)" }}>
              <Info size="1em" className="inline-icon" /> Category selection will be skipped! Voting will immediately begin on all unwatched movies tagged with <strong>&quot;{theme || "this theme"}&quot;</strong>.
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-secondary italic mb-sm p-sm glass-panel text-center animate-slide-in" style={{ opacity: 0.9, backgroundColor: "var(--accent-light)", borderColor: "rgba(244, 63, 94, 0.2)" }}>
          <Info size="1em" className="inline-icon" /> Physical media only (4K, Blu-ray, DVD). The Category Selection round will be skipped.
        </div>
      )}

      {error && <div className="vote-error mb-sm">{error}</div>}

      <button
        type="submit"
        disabled={isPending}
        className={`btn w-full ${mode === "in-person" ? "btn-accent" : "btn-primary"}`}
      >
        {isPending ? "Starting Week..." : mode === "theme-week" ? "Start Dedicated Theme Week" : "Start Week"}
      </button>
    </form>
  );
}


