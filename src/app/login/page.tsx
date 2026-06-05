"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/user";
import Link from "next/link";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="page-wrapper">
      <div className="glass-panel no-hover w-full max-w-md p-xl flex-col gap-xl">
        <div className="text-center">
          <h1 className="text-gradient text-7xl font-extrabold mb-sm tracking-tight">
            🎬 Movie Night
          </h1>
          <p className="text-secondary text-md">
            Sign in to start voting and tracking movies
          </p>
        </div>

        {state?.error && (
          <div className="alert-box alert-error">
            ⚠️ {state.error}
          </div>
        )}

        <form action={formAction} className="form-container gap-lg">
          <div className="form-group">
            <label htmlFor="username" className="form-label-bold">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="e.g. brian"
              required
              autoFocus
              className="form-input form-input-dark"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label-bold">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="form-input form-input-dark"
            />
          </div>

          <label className="checkbox-label text-base text-primary-var mt-xs mb-xs">
            <input
              type="checkbox"
              name="rememberMe"
              className="checkbox-input"
            />
            Keep me logged in (Remember Me)
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-lg mt-sm w-full"
            disabled={isPending}
          >
            {isPending ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="form-footer">
          New user?{" "}
          <Link href="/signup" className="text-primary-color font-semibold underline nav-link">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
