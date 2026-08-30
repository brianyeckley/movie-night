"use client";

import { useActionState } from "react";
import { AlertTriangle, Calendar } from "lucide-react";
import { loginAction } from "@/app/actions/user";
import type { BgImage } from "@/lib/bg-images";

interface LoginFormClientProps {
  bgImage: BgImage | null;
}

export default function LoginFormClient({ bgImage }: LoginFormClientProps) {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const panelAlign = bgImage?.panelAlign ?? "center";

  return (
    <>
      {bgImage && (
        <div
          className="random-bg-image"
          style={{
            backgroundImage: `linear-gradient(rgba(8, 12, 20, 0.3), rgba(8, 12, 20, 0.45)), url(${bgImage.url})`,
            backgroundPosition: bgImage.bgPosition,
          }}
        />
      )}

      <div className={`page-wrapper align-${panelAlign}`}>
        <div className="glass-panel no-hover w-full max-w-md p-xl flex-col gap-xl">
          <div className="text-center">
            <span className="site-logo site-logo-lg mb-sm" data-text="MOVIE NIGHT">
              MOVIE NIGHT
            </span>
            <p className="text-secondary text-md">
              Sign in to start voting and tracking movies
            </p>
          </div>

          {state?.error && (
            <div className="alert-box alert-error">
              <AlertTriangle size="1em" className="inline-icon" /> {state.error}
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
              Remember Me
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-lg mt-sm w-full"
              disabled={isPending}
            >
              {isPending ? "Signing In..." : "Sign In"}
            </button>
          </form>

        {/*   <div className="form-footer">
            New user?{" "}
            <Link href="/signup" className="text-primary-color font-semibold underline nav-link">
              Create an account
            </Link>
          </div> */}
        </div>
      </div>

      {bgImage?.credit && (
        <div className="bg-credit">
          <b>{bgImage.credit.title}</b> ({bgImage.credit.year})
          <br />
          <Calendar size="1em" className="inline-icon" /> {bgImage.credit.watched}
        </div>
      )}
    </>
  );
}
