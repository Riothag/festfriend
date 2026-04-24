import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.slice(0, 2000) : "";
    const response = typeof body?.response === "string" ? body.response.slice(0, 4000) : "";
    if (!query) {
      return Response.json({ ok: false, error: "missing query" }, { status: 400 });
    }

    const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (!webhook) {
      console.log("[log-query] (no GOOGLE_SHEETS_WEBHOOK_URL — dev fallback)", {
        timestamp: new Date().toISOString(),
        query,
        response,
      });
      return Response.json({ ok: true, dev: true });
    }

    const forward = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "query",
        timestamp: new Date().toISOString(),
        query,
        response,
      }),
      redirect: "follow",
    });

    if (!forward.ok) {
      const text = await forward.text().catch(() => "");
      console.error("[log-query] Google Apps Script error", forward.status, text);
      return Response.json({ ok: false }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[log-query] error", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
