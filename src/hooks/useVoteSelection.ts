"use client";

import { useState, useTransition } from "react";
import type { MovieWithGenres } from "@/lib/types";

interface UseVoteSelectionOptions {
  /** The user's existing votes for this round. */
  initialVotes: string[];
  /** How many options may be picked. `1` renders as radios. */
  maxVotes: number;
}

interface SubmitOptions {
  /** Shown when the user submits without picking anything. */
  emptyMessage: string;
  /** Shown in the toast once the vote is recorded. */
  successMessage: string;
  /** The server action to call with the chosen ids. */
  action: (selectedIds: string[]) => Promise<unknown>;
}

/**
 * Selection, submission and feedback state shared by every voting form.
 *
 * Each round differs only in its limit, its copy and which action it calls, so
 * all of that is passed in and the mechanics live here once.
 */
export function useVoteSelection({
  initialVotes,
  maxVotes,
}: UseVoteSelectionOptions) {
  const isSingle = maxVotes === 1;

  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [plotMovie, setPlotMovie] = useState<MovieWithGenres | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLimitReached = selectedIds.length >= maxVotes;

  const toggle = (id: string, checked: boolean) => {
    setError(null);
    if (isSingle) {
      // Radio behaviour: picking replaces rather than adds.
      setSelectedIds(checked ? [id] : []);
      return;
    }
    if (checked) {
      // Belt and braces: the limit is really enforced by `isDisabled`, which
      // stops the input from firing at all. This guards a caller that renders
      // a row without wiring `disabled` through.
      if (selectedIds.length < maxVotes) {
        setSelectedIds((prev) => [...prev, id]);
      }
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const isChecked = (id: string) => selectedIds.includes(id);

  /** Single-choice rounds never grey out an option - picking swaps the choice. */
  const isDisabled = (id: string) =>
    !isSingle && isLimitReached && !isChecked(id);

  const handleSubmit =
    ({ emptyMessage, successMessage, action }: SubmitOptions) =>
    (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedIds.length === 0) {
        setError(emptyMessage);
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          await action(selectedIds);
          setToastMsg(successMessage);
        } catch (err) {
          console.error("Failed to submit votes:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to submit votes. Please try again."
          );
        }
      });
    };

  return {
    selectedIds,
    hasExistingVotes: initialVotes.length > 0,
    isSingle,
    isPending,
    isChecked,
    isDisabled,
    toggle,
    error,
    handleSubmit,
    toastMsg,
    clearToast: () => setToastMsg(null),
    plotMovie,
    setPlotMovie,
  };
}
