"use client";

import { useState, useEffect } from "react";

interface TrailerButtonProps {
  trailerUrl: string | null | undefined;
  style?: React.CSSProperties;
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

export default function TrailerButton({ trailerUrl, style }: TrailerButtonProps) {
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
        className="btn btn-secondary"
        style={{
          padding: "4px 10px",
          fontSize: "0.75rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          borderRadius: "var(--radius-sm)",
          borderColor: "rgba(99, 102, 241, 0.3)",
          ...style,
        }}
      >
        <span>🍿</span> Trailer
      </button>

      {isRendered && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(5, 7, 12, 0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: isOpen ? 1 : 0,
            transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            padding: "24px",
          }}
        >
          {/* Modal Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "850px",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg), var(--shadow-glow)",
              overflow: "hidden",
              transform: isOpen ? "translateY(0) scale(1)" : "translateY(-40px) scale(0.95)",
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid var(--glass-border)",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>🎬 Play Trailer</span>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                &times;
              </button>
            </div>

            {/* Video Player */}
            <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={embedUrl}
                title="Trailer Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
