"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction } from "@/app/actions/user";
import Link from "next/link";

export default function SettingsPage() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear form fields on successful password change
  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  return (
    <div style={{ padding: "40px 0" }}>
      <main className="container" style={{ maxWidth: "550px" }}>
        
        {/* Banner */}
        <div className="glass-panel no-hover" style={{ padding: "24px", marginBottom: "32px", textAlign: "center" }}>
          <h1 className="text-gradient" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "6px", letterSpacing: "-0.02em" }}>
            ⚙️ Profile Settings
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Manage your password and security credentials
          </p>
        </div>

        {/* Change Password Form */}
        <div className="glass-panel no-hover" style={{ padding: "32px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "20px", color: "var(--text-primary)" }}>
            Change Password
          </h2>

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
                marginBottom: "20px",
              }}
            >
              ⚠️ {state.error}
            </div>
          )}

          {state?.success && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1px solid var(--success)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                fontWeight: 500,
                marginBottom: "20px",
              }}
            >
              ✅ Password updated successfully!
            </div>
          )}

          <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="currentPassword" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="Enter current password"
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

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="newPassword" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Enter new password"
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

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="confirmPassword" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
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

            <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
                style={{ flex: 1, padding: "12px", fontWeight: 600 }}
              >
                {isPending ? "Updating Password..." : "Update Password"}
              </button>
              <Link href="/" className="btn btn-secondary" style={{ padding: "12px 20px" }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>

      </main>
    </div>
  );
}
