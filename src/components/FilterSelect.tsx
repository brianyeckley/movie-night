"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** Shown on the trigger when nothing is picked, e.g. "Genres". */
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}

/**
 * One filter group as a dropdown of checkboxes.
 *
 * These filters are additive, so the panel stays open while options are
 * ticked and the trigger carries the count -- the row stays one line tall
 * however many are active, which is the point of having them in a dropdown
 * rather than as a wall of chips.
 */
export default function FilterSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const count = selected.size;

  return (
    <div className="filter-select" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`filter-select-trigger ${count > 0 ? "has-selection" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        {count > 0 && <span className="filter-select-count">{count}</span>}
        <ChevronDown size="1em" className="inline-icon filter-select-chevron" />
      </button>

      {open && (
        <div className="filter-select-panel">
          {options.map((option) => (
            <label key={option.value} className="filter-select-option">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => onToggle(option.value)}
                className="checkbox-input"
              />
              {option.label}
            </label>
          ))}

          {count > 0 && (
            <button type="button" onClick={onClear} className="filter-select-clear">
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
