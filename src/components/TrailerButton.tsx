"use client";

import { useState, useEffect } from "react";

interface TrailerButtonProps {
  trailerUrl: string | null | undefined;
  style?: React.CSSProperties;
  className?: string;
}

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
  }
  return null;
}

export default function TrailerButton({ trailerUrl, style, className }: TrailerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  const embedUrl = trailerUrl ? getYoutubeEmbedUrl(trailerUrl) : null;

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsRendered(false), 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!embedUrl) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`btn btn-secondary btn-trailer ${className || ""}`}
        style={style}
      >
        <span>🍿</span> Trailer
      </button>

      {isRendered && (
        <div
          onClick={() => setIsOpen(false)}
          className={`modal-overlay ${isOpen ? "open" : ""}`}
        >
          {/* Modal Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-card max-w-4xl"
          >
            {/* Header */}
            <div className="modal-header">
              <span className="font-bold text-lg">🎬 Play Trailer</span>
              <button
                onClick={() => setIsOpen(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            {/* Video Player */}
            <div className="video-container">
              <iframe
                src={embedUrl}
                title="Trailer Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="video-iframe"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
