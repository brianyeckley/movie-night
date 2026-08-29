"use client";

import { useState, useEffect } from "react";
import { Clapperboard, Popcorn } from "lucide-react";

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
  const [isMobile, setIsMobile] = useState(false);

  const embedUrl = trailerUrl ? getYoutubeEmbedUrl(trailerUrl) : null;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  if (!trailerUrl) return null;

  if (isMobile) {
    return (
      <a
        href={trailerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`btn btn-secondary btn-trailer ${className || ""}`}
        style={style}
      >
        <span><Popcorn size="1em" className="inline-icon" /></span> Trailer
      </a>
    );
  }

  if (!embedUrl) return null;

  return (
    <>
      <button
        onClick={openModal}
        className={`btn btn-secondary btn-trailer ${className || ""}`}
        style={style}
      >
        <span><Popcorn size="1em" className="inline-icon" /></span> Trailer
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
              <span className="font-bold text-lg"><Clapperboard size="1em" className="inline-icon" /> Play Trailer</span>
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
