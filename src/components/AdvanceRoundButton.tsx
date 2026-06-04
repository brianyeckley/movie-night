"use client";

import { useState, useTransition } from "react";
import { advanceWeekRoundAction } from "@/app/actions";

interface Props {
  weekId: string;
  isGreen?: boolean;
}

export default function AdvanceRoundButton({ weekId, isGreen = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAdvance = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await advanceWeekRoundAction(weekId);
        if (result && !result.success) {
          setError(result.error || "An unexpected error occurred.");
        }
      } catch (err: any) {
        console.error("Failed to advance round:", err);
        const msg = err.message || "An unexpected error occurred.";
        setError(msg.replace("An error occurred in the Server Action: ", ""));
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "stretch" }}>
      <button
        onClick={handleAdvance}
        disabled={isPending}
        className="btn btn-primary"
        style={{
          padding: "6px 14px",
          fontSize: "0.85rem",
          backgroundColor: isGreen ? "var(--success)" : "var(--primary)",
          borderColor: isGreen ? "var(--success)" : "var(--primary)",
        }}
      >
        {isPending ? "Advancing..." : "Close Round & Advance ➔"}
      </button>
      {error && (
        <div style={{
          padding: "6px 10px",
          backgroundColor: "var(--accent-light)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-sm)",
          color: "var(--accent)",
          fontSize: "0.75rem",
          fontWeight: 600,
          textAlign: "center"
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
