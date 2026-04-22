"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage as TChatMessage, PendingDisambiguation } from "@/types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import QuickActions from "./QuickActions";
import InstallBanner from "./InstallBanner";

export default function ChatApp() {
  const [messages, setMessages] = useState<TChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  // Remembered across turns so "who is after them?" works.
  const lastArtistRef = useRef<string | null>(null);
  // Carries a pending follow-up question (e.g. "which Thursday?") so a short
  // reply like "23" resolves to the right day.
  const pendingRef = useRef<PendingDisambiguation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const userMsg: TChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          lastArtist: lastArtistRef.current ?? undefined,
          pending: pendingRef.current ?? undefined,
        }),
      });
      const data = await res.json();
      if (typeof data?.resolvedArtist === "string") {
        lastArtistRef.current = data.resolvedArtist;
      }
      // Stash any new pending follow-up, or clear the previous one if the
      // server consumed it.
      pendingRef.current = (data?.pending as PendingDisambiguation | undefined) ?? null;
      const botMsg: TChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: data?.response ?? "No answer.",
      };
      setMessages((m) => [...m, botMsg]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", text: "Network error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-[100svh] w-full flex-col bg-black text-white">
      <header className="border-b border-gray-900 px-4 py-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>🎷</span>
        <div>
          <h1 className="text-base font-bold leading-none">Fest Friend</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Jazz Fest 2026</p>
        </div>
      </header>

      <InstallBanner />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {empty ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400 max-w-xs">
              <p className="text-lg font-semibold text-white">Ask anything</p>
              <p className="mt-2 text-sm">
                Schedules, stages, food, and band bios. Tap a quick button below to start.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} />)
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-gray-900 border border-gray-800 px-4 py-3 text-sm text-gray-400">
              …
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {empty && (
        <QuickActions
          onPrompt={(prompt) =>
            setMessages((m) => [
              ...m,
              { id: `a-${Date.now()}`, role: "assistant", text: prompt },
            ])
          }
        />
      )}

      <div className="border-t border-gray-900 bg-black px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <ChatInput onSend={send} disabled={loading} />
        <p className="mt-2 text-center text-[10px] text-gray-600">
          Made with ❤️ from Lisa LaCour at{" "}
          <a
            href="https://thevaultcollective.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-400"
          >
            The Vault Collective
          </a>
        </p>
      </div>
    </div>
  );
}
