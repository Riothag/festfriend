"use client";

const BUTTONS: { label: string; prompt: string }[] = [
  { label: "Who's playing now", prompt: "Which stage are you near?" },
  { label: "Find food", prompt: "What kind of food are you hungry for?" },
  { label: "Artist info", prompt: "Which artist do you want to know about?" },
  { label: "Stage schedule", prompt: "Which stage's schedule do you want?" },
];

export default function QuickActions({
  onPrompt,
  onSurprise,
}: {
  onPrompt: (prompt: string) => void;
  onSurprise: () => void;
}) {
  return (
    <div className="px-4 pb-3 space-y-2">
      <button
        onClick={onSurprise}
        className="w-full rounded-xl bg-yellow-400 text-black text-sm font-bold py-3 px-3 active:scale-[0.98] active:bg-yellow-500"
      >
        ✨ Surprise me
      </button>
      <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
}
