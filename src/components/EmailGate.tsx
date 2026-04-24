"use client";

import { useState, FormEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailGate({ onUnlock }: { onUnlock: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }
      onUnlock(trimmed);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100svh] w-full flex-col items-center justify-between bg-white text-black px-6 py-10">
      <div className="w-full max-w-md mx-auto flex flex-col pt-12 text-left">
        <p className="text-sm font-bold tracking-[0.2em] text-amber-600 uppercase">
          Jazz Fest 2026
        </p>
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight leading-[1.05]">
          The fest in{" "}
          <span className="italic font-serif text-amber-500">your pocket.</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600">
          Schedules, stages, food, and artists.
          <br />
          <span className="text-black font-semibold">Ask like you&apos;re texting a local.</span>
        </p>
      </div>

      <div className="w-full max-w-md mx-auto">
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              {error}
            </div>
          )}
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            className="w-full rounded-full bg-gray-50 border border-gray-200 px-5 py-4 text-base text-black placeholder:text-gray-400 focus:outline-none focus:border-amber-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-full bg-yellow-400 text-black text-lg font-bold py-4 active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "One sec…" : "Get started"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-gray-500">
          Made with ❤️ from Lisa LaCour at{" "}
          <a
            href="https://thevaultcollective.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            The Vault Collective
          </a>
        </p>
      </div>
    </div>
  );
}
