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
    <div className="py-xl">
      <main className="container max-w-xl">
        
        {/* Banner */}
        <div className="glass-panel no-hover p-lg mb-2xl text-center">
          <h1 className="text-gradient text-6xl font-extrabold mb-xs tracking-tight">
            ⚙️ Profile Settings
          </h1>
          <p className="text-secondary text-md">
            Manage your password and security credentials
          </p>
        </div>

        {/* Change Password Form */}
        <div className="glass-panel no-hover p-xl">
          <h2 className="text-3xl font-bold mb-xl text-primary-var">
            Change Password
          </h2>

          {state?.error && (
            <div className="alert-box alert-error mb-xl">
              ⚠️ {state.error}
            </div>
          )}

          {state?.success && (
            <div className="alert-box alert-success mb-xl">
              ✅ Password updated successfully!
            </div>
          )}

          <form ref={formRef} action={formAction} className="form-container gap-lg">
            <div className="form-group">
              <label htmlFor="currentPassword" className="form-label-bold">
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="Enter current password"
                required
                className="form-input form-input-dark"
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label-bold">
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Enter new password"
                required
                className="form-input form-input-dark"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label-bold">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                required
                className="form-input form-input-dark"
              />
            </div>

            <div className="flex-row gap-md mt-sm">
              <button
                type="submit"
                className="btn btn-primary btn-lg flex-1"
                disabled={isPending}
              >
                {isPending ? "Updating Password..." : "Update Password"}
              </button>
              <Link href="/" className="btn btn-secondary btn-lg">
                Cancel
              </Link>
            </div>
          </form>
        </div>

      </main>
    </div>
  );
}
