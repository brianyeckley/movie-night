"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileVideo, Trash2, UploadCloud, X } from "lucide-react";
import { deleteWeekFileAction } from "@/app/actions";

/** The week's file as the server renders it. Sizes are plain numbers here. */
export interface WeekFileInfo {
  /** Names this exact file in the download link, so a resume can't be
   *  served out of a different one that took the slot since. */
  id: string;
  originalName: string;
  size: number;
  uploadedById: string | null;
  uploadedByName: string | null;
  /** False while an upload is still in progress (or was abandoned). */
  completed: boolean;
  /** SHA-256 of the finished file; briefly null right after an upload. */
  contentHash: string | null;
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

/**
 * SHA-256 of one chunk, as hex. The server checks the bytes it stored against
 * this, so a chunk damaged in transit is caught and resent rather than ending
 * up in the finished movie.
 *
 * crypto.subtle needs a secure context: HTTPS, or localhost in development.
 */
async function sha256Hex(chunk: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await chunk.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * How far the file got, from one chunk's response.
 *
 * A 2xx without a readable `received` is not progress, whatever it looks
 * like -- an error page from the tunnel can arrive with a 200 on it. Treating
 * a missing count as zero used to rewind the upload to the start of the file;
 * raising it as a retryable failure lets the next attempt ask the server where
 * it actually got to.
 */
export function readChunkResponse(status: number, responseText: string): number {
  let body: { error?: string; received?: number } = {};
  try {
    body = JSON.parse(responseText);
  } catch {
    // Non-JSON error page, e.g. from the tunnel.
  }
  if (status < 200 || status >= 300) {
    throw new UploadError(body.error ?? `Upload failed (${status}).`, status, body.received);
  }
  if (typeof body.received !== "number") {
    throw new UploadError("The server's answer for that chunk could not be read.", 0);
  }
  return body.received;
}

/** PUTs one chunk with XHR, since fetch cannot report upload progress. */
function sendChunk(
  url: string,
  chunk: Blob,
  sha256: string,
  onProgress: (loaded: number) => void,
  xhrRef: { current: XMLHttpRequest | null }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Chunk-SHA256", sha256);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      try {
        resolve(readChunkResponse(xhr.status, xhr.responseText));
      } catch (err) {
        reject(err);
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
    if (!crypto?.subtle) {
      // Every upload is verified chunk by chunk, and this is what does the
      // hashing. Without it there is no safe way to send a movie.
      setError("This browser can't verify an upload on an insecure connection. Open the site over HTTPS and try again.");
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
        const chunkHash = await sha256Hex(chunk);
        try {
          offset = await sendChunk(
            `${baseUrl}/chunk?uploadId=${encodeURIComponent(uploadId)}&offset=${offset}`,
            chunk,
            chunkHash,
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
          // Network blips, offset mismatches and a chunk that arrived
          // corrupted (422) are retried from wherever the server says it got
          // to; anything else is fatal.
          if (
            err instanceof UploadError &&
            (err.status === 0 || err.status === 409 || err.status === 422 || err.status >= 500) &&
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
            {file.contentHash && (
              <div className="week-file-meta" title={file.contentHash}>
                SHA-256 {file.contentHash.slice(0, 16)}… — check a finished download with{" "}
                <code>shasum -a 256</code>
              </div>
            )}
          </div>
          <div className="week-file-actions">
            <a
              href={`${baseUrl}?v=${encodeURIComponent(file.id)}`}
              className="btn btn-primary btn-sm week-file-download"
              download
            >
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
