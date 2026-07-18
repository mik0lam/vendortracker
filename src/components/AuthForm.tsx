"use client";

import { useActionState, useState } from "react";
import { LockKeyhole, LogIn, UserPlus } from "lucide-react";
import {
  signIn,
  signUp,
  type AuthState,
} from "@/app/auth-actions";
import { Button, Field, Input } from "@/components/ui";

const initialState: AuthState = {};

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState(
    signIn,
    initialState
  );
  const [signUpState, signUpAction, signingUp] = useActionState(
    signUp,
    initialState
  );

  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-lg)] sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Vendor Tracker</h1>
        <p className="mt-1.5 text-sm text-muted">
          Michael and Dillon&apos;s shared Pokemon card workspace
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === "signin"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === "signup"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted"
          }`}
        >
          Create account
        </button>
      </div>

      <form
        action={mode === "signin" ? signInAction : signUpAction}
        className="space-y-4"
      >
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            placeholder="At least 8 characters"
          />
        </Field>

        {state.error ? (
          <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p className="rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {mode === "signin" ? (
            <LogIn className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {pending
            ? "Please wait..."
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        Access is invite-only. Only email addresses configured by the workspace
        owner can register.
      </p>
    </div>
  );
}
