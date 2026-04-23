"use client";

import { useState } from "react";
import { festivalDays } from "@/data/festival";
import { stages } from "@/data/stages";

// Hour options the festival actually runs. User picks a starting hour;
// we send "H PM" / "H AM" so the backend's time_window intent fires.
const HOUR_OPTIONS = [
  { label: "11 AM", value: "11 AM" },
  { label: "12 PM", value: "12 PM" },
  { label: "1 PM", value: "1 PM" },
  { label: "2 PM", value: "2 PM" },
  { label: "3 PM", value: "3 PM" },
  { label: "4 PM", value: "4 PM" },
  { label: "5 PM", value: "5 PM" },
  { label: "6 PM", value: "6 PM" },
  { label: "7 PM", value: "7 PM" },
];

export default function FilterBar({
  onSearch,
  disabled,
}: {
  onSearch: (query: string) => void;
  disabled?: boolean;
}) {
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [stage, setStage] = useState("");

  const hasAny = Boolean(day || time || stage);

  const go = () => {
    if (!hasAny || disabled) return;
    const parts = [stage, day, time].filter(Boolean);
    onSearch(parts.join(" "));
  };

  const clear = () => {
    setDay("");
    setTime("");
    setStage("");
  };

  const selectClass =
    "min-w-0 flex-1 appearance-none rounded-full bg-gray-900 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 disabled:opacity-50";

  return (
    <div className="border-b border-gray-900 bg-black px-3 py-2">
      <div className="flex items-center gap-1.5">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          disabled={disabled}
          className={selectClass}
          aria-label="Filter by day"
        >
          <option value="">Day</option>
          {festivalDays.map((d) => (
            <option key={d.day} value={d.day}>
              {d.day}
            </option>
          ))}
        </select>
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={disabled}
          className={selectClass}
          aria-label="Filter by time"
        >
          <option value="">Time</option>
          {HOUR_OPTIONS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          disabled={disabled}
          className={selectClass}
          aria-label="Filter by stage"
        >
          <option value="">Stage</option>
          {stages.map((s) => (
            <option key={s.stage_name} value={s.stage_name}>
              {s.stage_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={go}
          disabled={!hasAny || disabled}
          className="shrink-0 rounded-full bg-yellow-400 text-black text-xs font-bold px-3 py-2 active:scale-[0.97] disabled:opacity-40"
        >
          Find
        </button>
      </div>
      {hasAny && (
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="mt-1.5 text-[11px] text-gray-500 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
