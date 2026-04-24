"use client";

const BUTTONS: { label: string; prompt: string }[] = [
  { label: "Who's playing now", prompt: "Which stage are you near?" },
  { label: "Find food", prompt: "What kind of food are you hungry for?" },
  { label: "Artist info", prompt: "Which artist do you want to know about?" },
  { label: "Stage schedule", prompt: "Which stage's schedule do you want?" },
];

export default function QuickActions({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-3">
      {BUTTONS.map((b) => (
        <button
          key={b.label}
          onClick={() => onPrompt(b.prompt)}
          className="rounded-xl border border-gray-200 bg-gray-50 text-black text-sm font-medium py-3 px-3 active:bg-gray-100"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
