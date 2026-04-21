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
    <div className="flex min-h-[100svh] w-full flex-col items-center justify-between bg-black text-white px-6 py-10">
      <div className="w-full max-w-md mx-auto flex flex-col items-center pt-12 text-center">
        <div className="text-6xl mb-4" aria-hidden>🎷</div>
        <h1 className="text-5xl font-extrabold tracking-tight">Fest Friend</h1>
        <p className="mt-4 text-lg text-gray-300">
          Your pocket guide to Jazz Fest.
        </p>
        <ul className="mt-8 text-left space-y-2 text-base text-gray-200">
          <li>• What time does your band play?</li>
          <li>• Who&apos;s on stage right now?</li>
          <li>• Where to find crawfish bread.</li>
          <li>• Quick band bios.</li>
        </ul>
      </div>

      <form onSubmit={submit} className="w-full max-w-md mx-auto space-y-3 pb-6">
        {error && (
          <div className="rounded-md bg-red-900/40 border border-red-700 text-red-200 text-sm p-3">
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
          className="w-full rounded-full bg-gray-900 border border-gray-800 px-5 py-4 text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-400 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full rounded-full bg-yellow-400 text-black text-lg font-bold py-4 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "One sec…" : "Get started"}
        </button>
      </form>
    </div>
  );
}
