"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "sign-in" | "sign-up";
type ErrorResponse = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, setIsPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldErrors({});
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    }).catch(() => undefined);

    setIsPending(false);
    if (!response) {
      setError("Unable to reach the server. Please try again.");
      return;
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as ErrorResponse;
      setError(payload.message ?? "Unable to complete that request.");
      setFieldErrors(payload.fieldErrors ?? {});
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  const inputClassName =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2";

  return (
    <form className="mt-8 space-y-5" method="post" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className={inputClassName}
          name="email"
          required
          type="email"
        />
        {fieldErrors.email?.map((message) => (
          <p className="mt-1 text-sm text-red-700" key={message}>
            {message}
          </p>
        ))}
      </label>
      <label className="block text-sm font-medium">
        Password
        <input
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className={inputClassName}
          name="password"
          required
          type="password"
        />
        {fieldErrors.password?.map((message) => (
          <p className="mt-1 text-sm text-red-700" key={message}>
            {message}
          </p>
        ))}
      </label>
      {isSignUp ? (
        <label className="block text-sm font-medium">
          Confirm password
          <input
            autoComplete="new-password"
            className={inputClassName}
            name="passwordConfirmation"
            required
            type="password"
          />
          {fieldErrors.passwordConfirmation?.map((message) => (
            <p className="mt-1 text-sm text-red-700" key={message}>
              {message}
            </p>
          ))}
        </label>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="w-full rounded-md bg-orange-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          className="font-semibold text-orange-700 underline"
          href={isSignUp ? "/sign-in" : "/sign-up"}
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
