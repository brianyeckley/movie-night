"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileVideo, Trash2, UploadCloud, X } from "lucide-react";
import { deleteWeekFileAction } from "@/app/actions";

/** The week's file as the server renders it. Sizes are plain numbers here. */
export interface WeekFileInfo {
  originalName: string;
  size: number;
  uploadedById: string | null;
  uploadedByName: string | null;
  /** False while an upload is still in progress (or was abandoned). */
  completed: boolean;
}

interface Props {
  weekId: string;
  file: WeekFileInfo | null;
  currentUserId: string;
  isAdmin: boolean;
}

interface Progress {
  name: string;
  sent: number;
  total: number;
  /** Bytes per second, smoothed. */
  rate: number;
}

const MAX_CHUNK_RETRIES = 3;

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

class UploadError extends Error {
  constructor(message: string, public status: number, public received?: number) {
    super(message);
  }
}

/** PUTs one chunk with XHR, since fetch cannot report upload progress. */
function sendChunk(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
  xhrRef: { current: XMLHttpRequest | null }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let body: { error?: string; received?: number } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON error page, e.g. from the tunnel.
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body.received ?? 0);
      } else {
        reject(new UploadError(body.error ?? `Upload failed (${xhr.status}).`, xhr.status, body.received));
      }
    };
    xhr.onerror = () => reject(new UploadError("Network error during upload.", 0));
    xhr.onabort = () => reject(new UploadError("Upload cancelled.", -1));
    xhr.send(chunk);
  });
}

export default function WeekFilePanel({ weekId, file, currentUserId, isAdmin }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  const uploading = progress !== null;

  // Leaving mid-upload would silently throw the upload away.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const baseUrl = `/api/weeks/${encodeURIComponent(weekId)}/file`;

  async function upload(selected: File) {
    setError(null);
    if (selected.size === 0) {
      setError("That file is empty.");
      return;
    }
    cancelledRef.current = false;
    setProgress({ name: selected.name, sent: 0, total: selected.size, rate: 0 });
    let started = false;

    try {
      const startRes = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, size: selected.size }),
      });
      const startBody = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new UploadError(startBody.error ?? "Could not start the upload.", startRes.status);
      const { uploadId, chunkSize } = startBody as { uploadId: string; chunkSize: number };
      started = true;

      let offset = 0;
      let retries = 0;
      let lastTime = performance.now();
      let lastSent = 0;
      let rate = 0;

      while (offset < selected.size) {
        if (cancelledRef.current) throw new UploadError("Upload cancelled.", -1);
        const chunk = selected.slice(offset, offset + chunkSize);
        const chunkStart = offset;
        try {
          offset = await sendChunk(
            `${baseUrl}/chunk?uploadId=${encodeURIComponent(uploadId)}&offset=${offset}`,
            chunk,
            (loaded) => {
              const sent = chunkStart + loaded;
              const now = performance.now();
              const elapsed = (now - lastTime) / 1000;
              if (elapsed >= 0.5) {
                const instant = (sent - lastSent) / elapsed;
                rate = rate ? rate * 0.7 + instant * 0.3 : instant;
                lastTime = now;
                lastSent = sent;
              }
              setProgress({ name: selected.name, sent, total: selected.size, rate });
            },
            xhrRef
          );
          retries = 0;
        } catch (err) {
          // Network blips and offset mismatches are retried from wherever
          // the server says it got to; anything else is fatal.
          if (
            err instanceof UploadError &&
            (err.status === 0 || err.status === 409 || err.status >= 500) &&
            retries < MAX_CHUNK_RETRIES
          ) {
            retries++;
            if (typeof err.received === "number") offset = err.received;
            await new Promise((r) => setTimeout(r, 1000 * retries));
            continue;
          }
          throw err;
        }
      }

      setProgress(null);
      router.refresh();
    } catch (err) {
      setProgress(null);
      xhrRef.current = null;
      if (err instanceof UploadError && err.status === -1) {
        // Cancelled by the user: the cancel handler already cleaned up.
        return;
      }
      setError(err instanceof Error ? err.message : "Upload failed.");
      // Release our slot rather than leave a half-written file behind. Only
      // once we hold it: a refused start or a 410 may mean it is someone else's.
      const lostSlot = err instanceof UploadError && err.status === 410;
      if (started && !lostSlot) await deleteWeekFileAction(weekId).catch(() => {});
      router.refresh();
    }
  }

  async function cancelUpload() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    setProgress(null);
    await deleteWeekFileAction(weekId).catch(() => {});
    router.refresh();
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteWeekFileAction(weekId);
      setConfirmingDelete(false);
      if (!result.success) setError(result.error ?? "Failed to delete the file.");
      router.refresh();
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) upload(dropped);
  }

  const canDelete = file !== null && (isAdmin || file.uploadedById === currentUserId);

  // ---- Upload in progress (this tab) ----
  if (progress) {
    const pct = progress.total ? (progress.sent / progress.total) * 100 : 0;
    const remaining = progress.rate > 0 ? (progress.total - progress.sent) / progress.rate : null;
    return (
      <div className="week-file-panel">
        <div className="week-file-row">
          <FileVideo size={28} className="week-file-icon" />
          <div className="week-file-details">
            <div className="week-file-name" title={progress.name}>{progress.name}</div>
            <div className="week-file-meta">
              Uploading… {formatBytes(progress.sent)} of {formatBytes(progress.total)}
              {progress.rate > 0 && ` · ${formatBytes(progress.rate)}/s`}
              {remaining !== null && ` · ${formatDuration(remaining)} left`}
            </div>
          </div>
          <div className="week-file-actions">
            <button type="button" className="btn-secondary-sm" onClick={cancelUpload}>
              <X size="1em" className="inline-icon" /> Cancel
            </button>
          </div>
        </div>
        <div
          className="week-file-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div className="week-file-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="week-file-pct">{pct.toFixed(1)}%</div>
      </div>
    );
  }

  // ---- A finished file: download it ----
  if (file?.completed) {
    return (
      <div className="week-file-panel">
        <div className="week-file-row">
          <FileVideo size={28} className="week-file-icon" />
          <div className="week-file-details">
            <div className="week-file-name" title={file.originalName}>{file.originalName}</div>
            <div className="week-file-meta">
              {formatBytes(file.size)}
              {file.uploadedByName && ` · uploaded by ${file.uploadedByName}`}
            </div>
          </div>
          <div className="week-file-actions">
            <a href={baseUrl} className="btn btn-primary btn-sm week-file-download" download>
              <Download size="1em" className="inline-icon" /> Download
            </a>
            {canDelete &&
              (confirmingDelete ? (
                <div className="delete-confirm-box">
                  <span className="delete-confirm-text">Delete file?</span>
                  <button type="button" onClick={handleDelete} disabled={isDeleting} className="btn-danger-sm">
                    {isDeleting ? "Deleting…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={isDeleting}
                    className="btn-secondary-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  title="Delete this file"
                  className="delete-icon-btn"
                >
                  <Trash2 size={16} />
                </button>
              ))}
          </div>
        </div>
        {error && <p className="week-file-error">{error}</p>}
      </div>
    );
  }

  // ---- Someone else is mid-upload ----
  if (file && file.uploadedById !== currentUserId) {
    return (
      <div className="week-file-panel">
        <div className="week-file-row">
          <UploadCloud size={28} className="week-file-icon" />
          <div className="week-file-details">
            <div className="week-file-name">{file.originalName}</div>
            <div className="week-file-meta">
              {file.uploadedByName ?? "Someone"} is uploading this file. Refresh to check on it.
            </div>
          </div>
          {canDelete && (
            <div className="week-file-actions">
              <button type="button" className="btn-secondary-sm" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Cancelling…" : "Cancel upload"}
              </button>
            </div>
          )}
        </div>
        {error && <p className="week-file-error">{error}</p>}
      </div>
    );
  }

  // ---- No file yet (or this user's own upload was interrupted) ----
  return (
    <div className="week-file-panel">
      <div
        className={`week-file-dropzone ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <UploadCloud size={36} className="week-file-icon" />
        <div className="font-semibold">Drop the movie file here, or click to choose one</div>
        <div className="week-file-meta">
          {file
            ? `Your upload of "${file.originalName}" didn't finish. Choose it again to start over.`
            : "Everyone can download it until the week is closed out, and then it's deleted."}
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (chosen) upload(chosen);
          }}
        />
      </div>
      {error && <p className="week-file-error">{error}</p>}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
