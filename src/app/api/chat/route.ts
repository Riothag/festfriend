import { NextRequest } from "next/server";
import { answer } from "@/lib/intent";
import { festivalDays } from "@/data/festival";
import type {
  AnswerContext,
  FestivalDay,
  Intent,
  PendingDisambiguation,
} from "@/types";

export const runtime = "nodejs";

function isValidPending(p: unknown): p is PendingDisambiguation {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (o.kind === "day") {
    return (
      Array.isArray(o.options) &&
      o.options.every((x) => typeof x === "string") &&
      typeof o.originalQuery === "string"
    );
  }
  if (o.kind === "surprise") return true;
  return false;
}

const VALID_DAYS: Set<string> = new Set(festivalDays.map((d) => d.day));

function parseFestivalDay(value: unknown): FestivalDay | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return VALID_DAYS.has(trimmed) ? (trimmed as FestivalDay) : undefined;
}

function parseString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const VALID_INTENTS: Set<string> = new Set([
  "artist_lookup",
  "stage_lookup",
  "now_playing",
  "food_lookup",
  "food_recommendations",
  "artist_bio",
  "day_lookup",
  "next_on_stage",
  "prev_on_stage",
  "genre_lookup",
  "time_window",
  "conflict_lookup",
  "cultural_lookup",
  "faq_lookup",
  "headliner_lookup",
  "surprise_me",
  "subjective_recommendation",
  "unknown",
]);

function parseIntent(value: unknown): Intent | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_INTENTS.has(value) ? (value as Intent) : undefined;
}

// HH:MM 24-hour. Validates so junk doesn't poison context.
function parseClockString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? value.trim() : undefined;
}

// Accept either the legacy flat shape (lastArtist/lastStage/...) or a
// nested `context` object. The frontend now sends `context`; older
// clients still work.
function readContext(body: Record<string, unknown>): AnswerContext {
  const ctxSource = (
    body.context && typeof body.context === "object"
      ? body.context
      : body
  ) as Record<string, unknown>;
  return {
    lastArtist: parseString(ctxSource.lastArtist),
    lastStage: parseString(ctxSource.lastStage),
    lastDay: parseFestivalDay(ctxSource.lastDay),
    lastTime: parseClockString(ctxSource.lastTime),
    lastIntent: parseIntent(ctxSource.lastIntent),
    pending: isValidPending(ctxSource.pending) ? ctxSource.pending : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const message: string = typeof body?.message === "string" ? body.message : "";
    const context = readContext(body);
    const result = answer(message, context);
    return Response.json(result);
  } catch {
    return Response.json(
      { intent: "unknown", response: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
