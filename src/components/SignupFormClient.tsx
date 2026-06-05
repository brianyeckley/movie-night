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
    <div className="page-wrapper">
      <div className="glass-panel no-hover w-full max-w-lg p-xl flex-col gap-xl">
        <div className="text-center">
          <h1 className="text-gradient text-7xl font-extrabold mb-sm tracking-tight">
            Create Account
          </h1>
          <p className="text-secondary text-md">
            Sign up for Movie Night. Accounts require admin approval.
          </p>
        </div>

        {state?.success ? (
          <div className="success-alert-card text-center flex-col gap-lg">
            <div className="text-8xl">🎉</div>
            <div>
              <strong className="text-success-color block mb-xs text-lg">
                Registration Successful!
              </strong>
              Your account has been created and is pending approval. Please ask an administrator (Brian) to approve your account.
            </div>
            <Link href="/login" className="btn btn-primary w-full">
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            {state?.error && (
              <div className="alert-box alert-error">
                ⚠️ {state.error}
              </div>
            )}

            <form action={formAction} className="form-container gap-lg">
              {/* Hidden captcha token */}
              <input type="hidden" name="captchaToken" value={captchaToken} />

              <div className="form-group">
                <label htmlFor="username" className="form-label-bold">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="e.g. stuart (alphanumeric/underscores)"
                  required
                  className="form-input form-input-dark"
                />
              </div>

              <div className="form-group">
                <label htmlFor="name" className="form-label-bold">
                  Display Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Stew"
                  required
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
                  placeholder="Password (no requirements)"
                  required
                  className="form-input form-input-dark"
                />
              </div>

              <div className="captcha-box">
                <label htmlFor="captchaAnswer" className="form-label-bold text-primary-var flex-row items-center gap-xs">
                  🤖 Bot Protection: <span className="text-primary-color text-md font-bold">{captchaQuestion}</span>
                </label>
                <input
                  id="captchaAnswer"
                  name="captchaAnswer"
                  type="text"
                  placeholder="Enter the number"
                  required
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg mt-sm w-full"
                disabled={isPending}
              >
                {isPending ? "Submitting..." : "Sign Up"}
              </button>
            </form>

            <div className="form-footer">
              Already have an account?{" "}
              <Link href="/login" className="text-primary-color font-semibold underline nav-link">
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
