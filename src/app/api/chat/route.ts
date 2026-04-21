import { NextRequest } from "next/server";
import { answer } from "@/lib/intent";
import type { AnswerContext, PendingDisambiguation } from "@/types";

export const runtime = "nodejs";

function isValidPending(p: unknown): p is PendingDisambiguation {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    o.kind === "day" &&
    Array.isArray(o.options) &&
    o.options.every((x) => typeof x === "string") &&
    typeof o.originalQuery === "string"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const message: string = typeof body?.message === "string" ? body.message : "";
    const lastArtist: string | undefined =
      typeof body?.lastArtist === "string" && body.lastArtist.trim()
        ? body.lastArtist.trim()
        : undefined;
    const pending = isValidPending(body?.pending) ? body.pending : undefined;
    const context: AnswerContext = { lastArtist, pending };
    const result = answer(message, context);
    return Response.json(result);
  } catch {
    return Response.json(
      { intent: "unknown", response: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
