"use client";

import { useState, useTransition } from "react";
import { Check, FolderPlus } from "lucide-react";
import { addMovieToLegacyAction } from "@/app/actions";

interface AddToLegacyButtonProps {
  movieId: string;
  /** Only watched movies belong in the Legacy re-watch pool. */
  watched: boolean;
  isInLegacy: boolean;
}

export default function AddToLegacyButton({
  movieId,
  watched,
  isInLegacy,
}: AddToLegacyButtonProps) {
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!watched) return null;

  const alreadyInLegacy = isInLegacy || added;

  const handleClick = () => {
    setError("");
    startTransition(async () => {
      const result = await addMovieToLegacyAction(movieId);
      if (result.success) {
        setAdded(true);
      } else {
        setError(result.error ?? "Failed to add to Legacy.");
      }
    });
  };

  return (
    <div className="flex-col gap-xxs">
      <button
        type="button"
        onClick={handleClick}
        disabled={alreadyInLegacy || isPending}
        className="btn btn-secondary btn-sm"
      >
        {alreadyInLegacy ? (
          <>
            <Check size="1em" className="inline-icon" /> In Legacy
          </>
        ) : (
          <>
            <FolderPlus size="1em" className="inline-icon" />{" "}
            {isPending ? "Adding..." : "Add to Legacy"}
          </>
        )}
      </button>
      {error && <span className="text-xs alert-error">{error}</span>}
    </div>
  );
}
