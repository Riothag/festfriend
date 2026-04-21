import { festivalDays, festivalTimezone } from "@/data/festival";
import type { FestivalDay } from "@/types";

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Get the current festival day + current minute-of-day in the festival's timezone.
 * Returns null for the day if today is not a festival day.
 */
export function getFestivalNow(now: Date = new Date()): {
  day: FestivalDay | null;
  minutes: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: festivalTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hh = parseInt(get("hour"), 10);
  const mm = parseInt(get("minute"), 10);
  const match = festivalDays.find((d) => d.date === date);
  return { day: match?.day ?? null, minutes: hh * 60 + mm };
}
