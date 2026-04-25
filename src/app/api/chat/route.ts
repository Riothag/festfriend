import { NextRequest } from "next/server";
import { answer } from "@/lib/intent";
import { festivalDays } from "@/data/festival";
import type { AnswerContext, FestivalDay, PendingDisambiguation } from "@/types";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const message: string = typeof body?.message === "string" ? body.message : "";
    const context: AnswerContext = {
      lastArtist: parseString(body?.lastArtist),
      lastStage: parseString(body?.lastStage),
      lastDay: parseFestivalDay(body?.lastDay),
      pending: isValidPending(body?.pending) ? body.pending : undefined,
    };
    const result = answer(message, context);
    return Response.json(result);
  } catch {
    return Response.json(
      { intent: "unknown", response: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
