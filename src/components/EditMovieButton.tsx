"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, ImagePlus } from "lucide-react";
import {
  updateMovieAction,
  markMovieWatchedManuallyAction,
  addMovieBackgroundImageAction,
  updateMovieBackgroundImageAction,
  deleteMovieBackgroundImageAction,
} from "@/app/actions";

interface BgImageRow {
  id: string;
  filename: string;
  panelAlign: string;
  bgPosition: string;
}

interface EditMovieButtonProps {
  movie: {
    id: string;
    title: string;
    imdbUrl: string | null;
    trailerUrl: string | null;
    categoryId: string;
    genres: { id: string; name: string }[];
    physical4K: boolean;
    physicalBluRay: boolean;
    physicalDvd: boolean;
    backgroundImages: BgImageRow[];
  };
  categories: { id: string; name: string; parentId: string | null }[];
  genres: { id: string; name: string }[];
}

const PANEL_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const BG_POSITION_OPTIONS = [
  { value: "top left", label: "Top Left" },
  { value: "top center", label: "Top Center" },
  { value: "top right", label: "Top Right" },
  { value: "center left", label: "Center Left" },
  { value: "center center", label: "Center Center" },
  { value: "center right", label: "Center Right" },
  { value: "bottom left", label: "Bottom Left" },
  { value: "bottom center", label: "Bottom Center" },
  { value: "bottom right", label: "Bottom Right" },
];

export default function EditMovieButton({ movie, categories, genres }: EditMovieButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [title, setTitle] = useState(movie.title);
  const [imdbUrl, setImdbUrl] = useState(movie.imdbUrl || "");
  const [trailerUrl, setTrailerUrl] = useState(movie.trailerUrl || "");
  const [categoryId, setCategoryId] = useState(movie.categoryId);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    movie.genres.map((g) => g.id)
  );
  const [physical4K, setPhysical4K] = useState(movie.physical4K);
  const [physicalBluRay, setPhysicalBluRay] = useState(movie.physicalBluRay);
  const [physicalDvd, setPhysicalDvd] = useState(movie.physicalDvd);
  const [images, setImages] = useState<BgImageRow[]>(movie.backgroundImages);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [markWatched, setMarkWatched] = useState(false);
  const [watchedDate, setWatchedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [watchedType, setWatchedType] = useState<"in-person" | "standard">("in-person");

  // The form is seeded from `movie` on mount only. It deliberately does not
  // re-sync on prop change: `movie` is a fresh object on every server render,
  // so an effect keyed on it wiped whatever the user had typed each time the
  // page revalidated. The dialog is remounted per movie by its `key` instead.

  const openModal = () => {
    // Mounted here rather than in an effect so opening is a single render.
    setIsRendered(true);
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return;
    }
    // Keep the overlay mounted until the close transition has finished.
    const timer = setTimeout(() => setIsRendered(false), 300);
    document.body.style.overflow = "";
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleGenreToggle = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleUploadImage = (file: File) => {
    setImageError("");
    startTransition(async () => {
      try {
        const image = await addMovieBackgroundImageAction(movie.id, file);
        setImages((prev) => [...prev, image]);
      } catch (err) {
        console.error("Failed to upload background image:", err);
        setImageError(err instanceof Error ? err.message : "Failed to upload image.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const handleUpdateImage = (imageId: string, panelAlign: string, bgPosition: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, panelAlign, bgPosition } : img))
    );
    startTransition(async () => {
      try {
        await updateMovieBackgroundImageAction(imageId, panelAlign, bgPosition);
      } catch (err) {
        console.error("Failed to update background image:", err);
      }
    });
  };

  const handleDeleteImage = (imageId: string) => {
    startTransition(async () => {
      try {
        await deleteMovieBackgroundImageAction(imageId);
        setImages((prev) => prev.filter((img) => img.id !== imageId));
      } catch (err) {
        console.error("Failed to delete background image:", err);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateMovieAction(
          movie.id,
          title,
          imdbUrl,
          trailerUrl,
          categoryId,
          selectedGenreIds,
          physical4K,
          physicalBluRay,
          physicalDvd
        );
        if (markWatched) {
          const result = await markMovieWatchedManuallyAction(
            movie.id,
            watchedDate,
            watchedType === "in-person"
          );
          if (!result.success) {
            alert(`Saved the movie, but couldn't mark it watched: ${result.error}`);
            return;
          }
        }
        setIsOpen(false);
      } catch (err) {
        console.error("Failed to update movie:", err);
        const message = err instanceof Error ? err.message : "Please try again.";
        alert(`Failed to save changes: ${message}`);
      }
    });
  };

  return (
    <>
      <button
        onClick={openModal}
        className="btn-edit"
      >
        <Pencil size="1em" className="inline-icon" /> Edit
      </button>

      {isRendered && createPortal(
        <div
          onClick={() => setIsOpen(false)}
          className={`modal-overlay ${isOpen ? "open" : ""}`}
        >
          {/* Modal Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-card max-w-xl"
          >
            {/* Header */}
            <div className="modal-header">
              <span className="font-bold text-lg"><Pencil size="1em" className="inline-icon" /> Edit Movie Details</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Form */}
            <form
              onSubmit={handleSubmit}
              className="form-container modal-form"
            >
              {/* Title Input */}
              <div className="form-group">
                <label className="form-label-bold">
                  Movie Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="form-input form-input-dark"
                />
              </div>

              {/* IMDb URL Input */}
              <div className="form-group">
                <label className="form-label-bold">
                  IMDb Link
                </label>
                <input
                  type="url"
                  value={imdbUrl}
                  onChange={(e) => setImdbUrl(e.target.value)}
                  placeholder="https://www.imdb.com/title/tt..."
                  className="form-input form-input-dark"
                />
                <span className="text-xs text-muted italic">
                  Note: Changing this will automatically trigger metadata scraping.
                </span>
              </div>

              {/* YouTube URL Input */}
              <div className="form-group">
                <label className="form-label-bold">
                  YouTube Trailer Link
                </label>
                <input
                  type="url"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="form-input form-input-dark"
                />
              </div>

              {/* Category Dropdown */}
              <div className="form-group">
                <label className="form-label-bold">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="form-select"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parentId ? `↳ ${cat.name}` : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Genres Multi-Select */}
              <div className="form-group">
                <label className="form-label-bold">
                  Genres
                </label>
                <div className="checkbox-group-scroll">
                  {genres.map((genre) => {
                    const isChecked = selectedGenreIds.includes(genre.id);
                    return (
                      <label
                        key={genre.id}
                        className={`checkbox-label ${isChecked ? "text-primary-var" : "text-secondary"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleGenreToggle(genre.id)}
                          className="checkbox-input"
                        />
                        {genre.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Physical Media (Optional) */}
              <div className="form-group">
                <label className="form-label-bold">
                  Physical Media (Optional)
                </label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={physical4K}
                      onChange={(e) => setPhysical4K(e.target.checked)}
                      className="checkbox-input"
                    />
                    4K UHD
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={physicalBluRay}
                      onChange={(e) => setPhysicalBluRay(e.target.checked)}
                      className="checkbox-input"
                    />
                    Blu-ray
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={physicalDvd}
                      onChange={(e) => setPhysicalDvd(e.target.checked)}
                      className="checkbox-input"
                    />
                    DVD
                  </label>
                </div>
              </div>

              {/* Mark as Watched */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={markWatched}
                    onChange={(e) => setMarkWatched(e.target.checked)}
                    className="checkbox-input"
                  />
                  Mark as Watched
                </label>

                {markWatched && (
                  <div className="flex-col gap-md mt-sm">
                    <div className="form-group">
                      <label className="form-label-bold">Date Watched</label>
                      <input
                        type="date"
                        value={watchedDate}
                        onChange={(e) => setWatchedDate(e.target.value)}
                        className="form-input form-input-dark"
                      />
                    </div>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="radio"
                          name={`watchedType-${movie.id}`}
                          checked={watchedType === "in-person"}
                          onChange={() => setWatchedType("in-person")}
                          className="checkbox-input"
                        />
                        In Person
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="radio"
                          name={`watchedType-${movie.id}`}
                          checked={watchedType === "standard"}
                          onChange={() => setWatchedType("standard")}
                          className="checkbox-input"
                        />
                        Standard
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Background Images */}
              <div className="form-group">
                <label className="form-label-bold">
                  Background Images
                </label>
                <div className="bg-image-manager">
                  {images.map((image) => (
                    <div key={image.id} className="bg-image-manager-card">
                      <img
                        src={`/media/bg/${image.filename}`}
                        alt=""
                        className="bg-image-manager-thumb"
                      />
                      <select
                        value={image.panelAlign}
                        onChange={(e) => handleUpdateImage(image.id, e.target.value, image.bgPosition)}
                        className="form-select form-select-sm"
                      >
                        {PANEL_ALIGN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            Panel: {opt.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={image.bgPosition}
                        onChange={(e) => handleUpdateImage(image.id, image.panelAlign, e.target.value)}
                        className="form-select form-select-sm"
                      >
                        {BG_POSITION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            Image: {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(image.id)}
                        disabled={isPending}
                        className="btn btn-secondary btn-sm btn-danger-outline"
                      >
                        <Trash2 size="1em" className="inline-icon" /> Remove
                      </button>
                    </div>
                  ))}
                  <label className="bg-image-manager-upload">
                    <ImagePlus size="1.5em" className="inline-icon" />
                    Add Image
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      disabled={isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file);
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
                {imageError && <span className="text-xs alert-error">{imageError}</span>}
              </div>

              {/* Actions Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary btn-md"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md min-w-100"
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
