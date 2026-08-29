"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
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
      } catch (err) {
        console.error("Failed to advance round:", err);
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(msg.replace("An error occurred in the Server Action: ", ""));
      }
    });
  };

  return (
    <div className="flex-col gap-xs items-stretch">
      <button
        onClick={handleAdvance}
        disabled={isPending}
        className={`btn btn-sm ${isGreen ? "btn-success" : "btn-primary"}`}
      >
        {isPending ? "Advancing..." : "Close Round & Advance ➔"}
      </button>
      {error && (
        <div className="alert-box alert-error alert-sm text-center font-semibold text-accent-color">
          <AlertTriangle size="1em" className="inline-icon" /> {error}
        </div>
      )}
    </div>
  );
}
