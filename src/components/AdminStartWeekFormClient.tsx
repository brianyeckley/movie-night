"use client";

import { useState, useTransition } from "react";
import { Clapperboard, Info, Popcorn } from "lucide-react";
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
              !isInPerson ? "selected" : ""
            }`}
            aria-disabled={isPending}
          >
            <input
              type="radio"
              name="weekMode"
              value="standard"
              checked={!isInPerson}
              disabled={isPending}
              onChange={() => setIsInPerson(false)}
            />
            <span className="mode-option-icon"><Clapperboard size="1em" strokeWidth={1} className="inline-icon" /></span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">Standard Week</span>
              <span className="text-xs text-secondary">
                Theme category selection, movie nominations, and multi-round voting.
              </span>
            </div>
          </label>

          <label
            className={`glass-panel mode-option mode-option-in-person ${
              isInPerson ? "selected" : ""
            }`}
            aria-disabled={isPending}
          >
            <input
              type="radio"
              name="weekMode"
              value="in-person"
              checked={isInPerson}
              disabled={isPending}
              onChange={() => setIsInPerson(true)}
            />
            <span className="mode-option-icon"><Popcorn size="1em" strokeWidth={1} className="inline-icon" /></span>
            <div className="flex-col gap-xxs">
              <span className="font-bold text-md text-primary-var">In Person Night</span>
              <span className="text-xs text-secondary">
                Skip category rounds. Users vote directly on physical media (4K, Blu-ray, DVD).
              </span>
            </div>
          </label>
        </div>
      </fieldset>

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
          <Info size="1em" className="inline-icon" /> The Theme will default to <strong>&quot;In Person Physical Media&quot;</strong> and the Category Selection round will be skipped.
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

