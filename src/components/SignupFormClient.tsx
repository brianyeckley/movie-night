"use client";

import { useActionState } from "react";
import { signupAction } from "@/app/actions/user";
import Link from "next/link";

interface SignupFormClientProps {
  captchaQuestion: string;
  captchaToken: string;
}

export default function SignupFormClient({ captchaQuestion, captchaToken }: SignupFormClientProps) {
  const [state, formAction, isPending] = useActionState(signupAction, null);

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
          maxWidth: "460px",
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 className="text-gradient" style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.02em" }}>
            Create Account
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Sign up for Movie Night. Accounts require admin approval.
          </p>
        </div>

        {state?.success ? (
          <div
            style={{
              padding: "20px",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid var(--success)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ fontSize: "2.5rem" }}>🎉</div>
            <div>
              <strong style={{ color: "var(--success)", display: "block", marginBottom: "6px", fontSize: "1.1rem" }}>
                Registration Successful!
              </strong>
              Your account has been created and is pending approval. Please ask an administrator (Brian) to approve your account.
            </div>
            <Link href="/login" className="btn btn-primary" style={{ textDecoration: "none", width: "100%" }}>
              Return to Login
            </Link>
          </div>
        ) : (
          <>
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
              {/* Hidden captcha token */}
              <input type="hidden" name="captchaToken" value={captchaToken} />

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="username" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="e.g. stuart (alphanumeric/underscores)"
                  required
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="name" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Display Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Stew"
                  required
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
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
                  placeholder="Password (no requirements)"
                  required
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "16px",
                  backgroundColor: "rgba(99, 102, 241, 0.05)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: "var(--radius-md)",
                  marginTop: "4px",
                }}
              >
                <label htmlFor="captchaAnswer" style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  🤖 Bot Protection: <span style={{ color: "var(--primary)", fontSize: "0.95rem", fontWeight: 700 }}>{captchaQuestion}</span>
                </label>
                <input
                  id="captchaAnswer"
                  name="captchaAnswer"
                  type="text"
                  placeholder="Enter the number"
                  required
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 12px",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

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
                {isPending ? "Submitting..." : "Sign Up"}
              </button>
            </form>

            <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", borderTop: "1px solid var(--glass-border)", paddingTop: "16px", marginTop: "8px" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }} className="nav-link">
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
