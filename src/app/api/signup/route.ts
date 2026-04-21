import { NextRequest } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "Invalid email." }, { status: 400 });
    }

    const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const userAgent = request.headers.get("user-agent") ?? "";
    // Best-effort IP from common proxy headers. Falls back to empty.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "";

    // Dev fallback: if no webhook configured, log and succeed so local
    // iteration works without needing Google Apps Script set up.
    if (!webhook) {
      console.log("[signup] (no GOOGLE_SHEETS_WEBHOOK_URL set — dev fallback)", {
        timestamp: new Date().toISOString(),
        email,
        userAgent,
        ip,
      });
      return Response.json({ ok: true, dev: true });
    }

    // Forward to Google Apps Script web app. We do this server-side so we
    // don't have to worry about CORS and we can keep the URL private.
    const forward = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        email,
        user_agent: userAgent,
        ip,
      }),
      // Apps Script web apps return a 302 redirect that we need to follow.
      redirect: "follow",
    });

    if (!forward.ok) {
      const text = await forward.text().catch(() => "");
      console.error("[signup] Google Apps Script error", forward.status, text);
      return Response.json(
        { error: "Could not save your signup. Try again." },
        { status: 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[signup] error", e);
    return Response.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
