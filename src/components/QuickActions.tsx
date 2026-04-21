"use client";

const BUTTONS: { label: string; query: string }[] = [
  { label: "Who's playing now", query: "who's playing now" },
  { label: "Find food", query: "where is crawfish bread" },
  { label: "Artist info", query: "tell me about Trombone Shorty" },
  { label: "Stage schedule", query: "stage schedule for Festival Stage" },
];

export default function QuickActions({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-3">
      {BUTTONS.map((b) => (
        <button
          key={b.label}
          onClick={() => onSelect(b.query)}
          className="rounded-xl border border-gray-800 bg-gray-950 text-white text-sm font-medium py-3 px-3 active:bg-gray-900"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
