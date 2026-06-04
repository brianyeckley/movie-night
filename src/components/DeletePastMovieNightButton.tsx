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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.35)",
          borderRadius: "var(--radius-sm)",
          padding: "6px 10px",
          marginTop: "8px",
        }}
      >
        <span style={{ fontSize: "0.75rem", color: "#fca5a5", flex: 1 }}>
          Delete Week #{weekNumber}?
        </span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          style={{
            backgroundColor: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "3px 10px",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {isPending ? "Deleting…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          style={{
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            padding: "3px 10px",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
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
      style={{
        backgroundColor: "transparent",
        border: "none",
        color: "rgba(239, 68, 68, 0.55)",
        cursor: "pointer",
        fontSize: "0.8rem",
        padding: "2px 4px",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        transition: "color 0.2s",
        borderRadius: "var(--radius-sm)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(239, 68, 68, 0.55)")}
    >
      🗑️
    </button>
  );
}
