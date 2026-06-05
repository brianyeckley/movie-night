"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/user";

interface HeaderProps {
  currentUser: {
    id: string;
    name: string;
    username: string;
    role: string;
  } | null;
}

export default function Header({ currentUser }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header
      style={{
        borderBottom: "1px solid var(--glass-border)",
        background: "var(--glass-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "16px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          position: "relative",
        }}
      >
        {/* Left Side: Logo & Desktop Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <Link href="/" onClick={() => setIsOpen(false)}>
            <span
              className="text-gradient"
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              🎬 Movie Night
            </span>
          </Link>

          {currentUser && (
            <nav className="desktop-nav">
              <Link
                href="/"
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  transition: "color var(--transition-fast)",
                }}
                className="nav-link"
              >
                Dashboard
              </Link>
              <Link
                href="/catalog"
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  transition: "color var(--transition-fast)",
                }}
                className="nav-link"
              >
                Catalog
              </Link>
              {currentUser.role === "ADMIN" && (
                <Link
                  href="/admin/users"
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    transition: "color var(--transition-fast)",
                  }}
                  className="nav-link"
                >
                  Users
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right Side: Desktop User Info / Mobile Menu Toggle */}
        {currentUser && (
          <>
            {/* Desktop User Navigation */}
            <div className="desktop-user">
              <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                Watching as: <strong style={{ color: "var(--text-primary)" }}>{currentUser.name} {currentUser.role === "ADMIN" ? "👑" : "🍿"}</strong>
              </span>
              <Link
                href="/settings"
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  transition: "color var(--transition-fast)",
                }}
                className="nav-link"
              >
                ⚙️ Settings
              </Link>
              <form action={logoutAction} style={{ display: "inline" }}>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Log Out
                </button>
              </form>
            </div>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="mobile-menu-toggle"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-primary)",
              }}
              aria-label="Toggle navigation menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </>
        )}

        {/* Mobile Absolute Dropdown Menu */}
        {currentUser && isOpen && (
          <div className="mobile-menu-dropdown">
            <nav style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                Dashboard
              </Link>
              <Link
                href="/catalog"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                Catalog
              </Link>
              {currentUser.role === "ADMIN" && (
                <Link
                  href="/admin/users"
                  onClick={() => setIsOpen(false)}
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--glass-border)",
                  }}
                >
                  Users
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                ⚙️ Settings
              </Link>
            </nav>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                Watching as: <strong style={{ color: "var(--text-primary)" }}>{currentUser.name} {currentUser.role === "ADMIN" ? "👑" : "🍿"}</strong>
              </span>
              <form action={logoutAction} style={{ width: "100%" }}>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  Log Out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
