"use client";

import { useState, FormEvent } from "react";

export default function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="sentences"
        placeholder="Ask about a band, stage, or food…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className="flex-1 rounded-full bg-gray-900 border border-gray-800 px-5 py-4 text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-400 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-full bg-yellow-400 text-black font-bold px-5 py-4 active:scale-[0.97] disabled:opacity-40"
        aria-label="Send"
      >
        Send
      </button>
    </form>
  );
}
