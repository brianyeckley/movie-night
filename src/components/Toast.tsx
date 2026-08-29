"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  return (
    <div className={`toast-container ${message ? "show" : ""}`}>
      <span className="toast-icon"><CheckCircle2 size="1em" className="inline-icon" /></span>
      <span className="toast-message">{message}</span>
    </div>
  );
}
