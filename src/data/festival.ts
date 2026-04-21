import type { FestivalDay } from "@/types";

// Jazz Fest 2026 — two weekends. Thu Apr 23 – Sun May 3.
// Order matters for "today" detection.
export const festivalDays: { day: FestivalDay; date: string }[] = [
  { day: "Thu Apr 23", date: "2026-04-23" },
  { day: "Fri Apr 24", date: "2026-04-24" },
  { day: "Sat Apr 25", date: "2026-04-25" },
  { day: "Sun Apr 26", date: "2026-04-26" },
  { day: "Thu Apr 30", date: "2026-04-30" },
  { day: "Fri May 1", date: "2026-05-01" },
  { day: "Sat May 2", date: "2026-05-02" },
  { day: "Sun May 3", date: "2026-05-03" },
];

export const festivalTimezone = "America/Chicago";
