import { list, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function checkAuth(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  return !!key && key === process.env.API_KEY;
}

// POST /api/sessions — store a single session entry
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const sessionId = body.session_id || "unknown";
  const timestamp = body.timestamp || new Date().toISOString();
  const name = `sessions/${timestamp}_${sessionId}.json`;

  const blob = await put(name, JSON.stringify(body), {
    contentType: "application/json",
    access: "public",
    addRandomSuffix: false,
  });

  return NextResponse.json({ ok: true, url: blob.url });
}

// GET /api/sessions — list all sessions
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key !== process.env.API_KEY) return unauthorized();

  const sessions = [];
  let cursor: string | undefined;

  do {
    const result = await list({
      prefix: "sessions/",
      cursor,
      limit: 1000,
    });

    for (const blob of result.blobs) {
      try {
        const res = await fetch(blob.url);
        const data = await res.json();
        sessions.push(data);
      } catch {
        // skip malformed entries
      }
    }

    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  // Sort by session_start descending
  sessions.sort((a, b) => {
    const ta = a.session_start || "";
    const tb = b.session_start || "";
    return tb.localeCompare(ta);
  });

  return NextResponse.json(sessions);
}
