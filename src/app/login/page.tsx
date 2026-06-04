"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/user";
import Link from "next/link";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "75vh",
        padding: "24px",
      }}
    >
      <div
        className="glass-panel no-hover"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 className="text-gradient" style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.02em" }}>
            🎬 Movie Night
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Sign in to start voting and tracking movies
          </p>
        </div>

        {state?.error && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--accent-light)",
              border: "1px solid var(--accent)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            ⚠️ {state.error}
          </div>
        )}

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="username" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="e.g. brian"
              required
              autoFocus
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                color: "var(--text-primary)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color var(--transition-fast)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="password" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                color: "var(--text-primary)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color var(--transition-fast)",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.9rem",
              color: "var(--text-primary)",
              cursor: "pointer",
              userSelect: "none",
              margin: "4px 0",
            }}
          >
            <input
              type="checkbox"
              name="rememberMe"
              style={{
                accentColor: "var(--primary)",
                cursor: "pointer",
                width: "16px",
                height: "16px",
              }}
            />
            Keep me logged in (Remember Me)
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "1rem",
              fontWeight: 600,
              marginTop: "8px",
            }}
          >
            {isPending ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", borderTop: "1px solid var(--glass-border)", paddingTop: "16px", marginTop: "8px" }}>
          New user?{" "}
          <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }} className="nav-link">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
