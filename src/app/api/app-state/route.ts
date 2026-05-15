import { NextResponse } from "next/server";

const APP_STATE_KEY = "default";
const SUPABASE_REQUEST_TIMEOUT_MS = 12000;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error";
}

function getSupabaseRequestSignal() {
  return AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
}

export async function GET() {
  try {
    const config = getSupabaseConfig();

    if (!config) {
      return NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 503 },
      );
    }

    const response = await fetch(
      `${config.url}/rest/v1/app_state?select=state,updated_at&key=eq.${APP_STATE_KEY}&limit=1`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
        signal: getSupabaseRequestSignal(),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Could not fetch app state.", details: errorText },
        { status: response.status },
      );
    }

    const rows = (await response.json()) as Array<{ state: unknown; updated_at: string }>;
    return NextResponse.json({ state: rows[0]?.state ?? null, updatedAt: rows[0]?.updated_at ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected app-state GET failure.", details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const config = getSupabaseConfig();

    if (!config) {
      return NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { state?: unknown };
    if (!body.state) {
      return NextResponse.json({ error: "State payload is required." }, { status: 400 });
    }

    const response = await fetch(`${config.url}/rest/v1/app_state`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        key: APP_STATE_KEY,
        state: body.state,
        updated_at: new Date().toISOString(),
      }),
      signal: getSupabaseRequestSignal(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Could not save app state.", details: errorText },
        { status: response.status },
      );
    }

    const rows = (await response.json()) as Array<{ updated_at: string }>;
    return NextResponse.json({ ok: true, updatedAt: rows[0]?.updated_at ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected app-state PUT failure.", details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
