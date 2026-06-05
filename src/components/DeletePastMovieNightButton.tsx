"use client";

import { useState, useTransition } from "react";
import { deleteCompletedWeekAction } from "@/app/actions";

interface Props {
  weekId: string;
  weekNumber: number;
  movieTitle: string;
}

export default function DeletePastMovieNightButton({ weekId, weekNumber, movieTitle }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteCompletedWeekAction(weekId);
      } catch (err) {
        console.error("Failed to delete past movie night:", err);
        alert("Failed to delete. Please try again.");
        setConfirming(false);
      }
    });
  };

  if (confirming) {
    return (
      <div className="delete-confirm-box">
        <span className="delete-confirm-text">
          Delete Week #{weekNumber}?
        </span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="btn-danger-sm"
        >
          {isPending ? "Deleting…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="btn-secondary-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Delete "${movieTitle}" from Past Movie Nights`}
      className="delete-icon-btn"
    >
      🗑️
    </button>
  );
}
