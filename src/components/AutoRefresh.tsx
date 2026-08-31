"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface AutoRefreshProps {
  interval?: number;
  initialSignature?: string;
}

export default function AutoRefresh({
  interval = 5000,
  initialSignature,
}: AutoRefreshProps) {
  const router = useRouter();
  const currentSignatureRef = useRef<string | undefined>(initialSignature);
  const isFetchingRef = useRef(false);

  // Keep ref updated if server rendered with a new initialSignature
  useEffect(() => {
    if (initialSignature !== undefined) {
      currentSignatureRef.current = initialSignature;
    }
  }, [initialSignature]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      // Don't poll if the tab is hidden or a request is already inflight
      if (document.visibilityState !== "visible" || isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      try {
        const res = await fetch("/api/voting-status", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data && typeof data.signature === "string") {
          if (
            currentSignatureRef.current !== undefined &&
            currentSignatureRef.current !== data.signature
          ) {
            // Signature changed: update ref and trigger full page refresh
            currentSignatureRef.current = data.signature;
            router.refresh();
          } else if (currentSignatureRef.current === undefined) {
            currentSignatureRef.current = data.signature;
          }
        }
      } catch {
        // Silently fail on network interruptions during background poll
      } finally {
        isFetchingRef.current = false;
      }
    };

    const startTimer = () => {
      if (!timer) {
        timer = setInterval(checkStatus, interval);
      }
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Check immediately on tab wake / focus, then resume timer
        checkStatus();
        startTimer();
      } else {
        stopTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (document.visibilityState === "visible") {
      startTimer();
    }

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, interval]);

  return null;
}

