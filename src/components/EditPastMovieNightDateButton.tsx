"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { updateWeekWatchDateAction } from "@/app/actions";
import { useRouter } from "next/navigation";

interface Props {
  weekId: string;
  currentClosedAt: Date | string | null;
  onDateUpdated?: (newClosedAt: Date) => void;
}

function toLocalDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EditPastMovieNightDateButton({
  weekId,
  currentClosedAt,
  onDateUpdated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [dateValue, setDateValue] = useState(() => toLocalDateInputValue(currentClosedAt));
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setDateValue(toLocalDateInputValue(currentClosedAt));
  }, [currentClosedAt]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      try {
        inputRef.current.showPicker?.();
      } catch {
        // Ignored if browser prevents showPicker
      }
    }
  }, [isEditing]);

  const handleSave = () => {
    if (!dateValue) return;
    startTransition(async () => {
      try {
        const res = await updateWeekWatchDateAction(weekId, dateValue);
        const newDate = new Date(res.closedAt);
        onDateUpdated?.(newDate);
        setIsEditing(false);
        router.refresh();
      } catch (err) {
        console.error("Failed to update watched date:", err);
        alert(err instanceof Error ? err.message : "Failed to update watch date. Please make sure you are signed in.");
      }
    });
  };

  if (isEditing) {
    return (
      <div className="edit-date-box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
              setDateValue(toLocalDateInputValue(currentClosedAt));
            }
          }}
          disabled={isPending}
          className="form-input form-input-dark edit-date-input"
          aria-label="Edit date watched"
          autoFocus
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !dateValue}
          className="btn-primary-sm"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setDateValue(toLocalDateInputValue(currentClosedAt));
          }}
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
      type="button"
      onClick={() => setIsEditing(true)}
      title="Edit date watched"
      aria-label="Edit date watched"
      className="edit-icon-btn"
    >
      <Pencil size="0.95em" className="inline-icon" />
    </button>
  );
}
