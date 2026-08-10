import { NextResponse } from "next/server";

const PLUGGY_API_BASE_URL = "https://api.pluggy.ai";
const PLUGGY_REQUEST_TIMEOUT_MS = 12000;

type ConnectTokenRequest = {
  clientUserId?: string;
  itemId?: string;
  options?: {
    clientUserId?: string;
    webhookUrl?: string;
    oauthRedirectUri?: string;
    avoidDuplicates?: boolean;
  };
};

type PluggyAuthResponse = {
  apiKey?: string;
  accessToken?: string;
};

type PluggyConnectTokenResponse = {
  accessToken?: string;
};

function getPluggyConfig() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    webhookUrl: process.env.PLUGGY_WEBHOOK_URL,
    oauthRedirectUri: process.env.PLUGGY_OAUTH_REDIRECT_URI,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error";
}

function getRequestSignal() {
  return AbortSignal.timeout(PLUGGY_REQUEST_TIMEOUT_MS);
}

async function createPluggyApiKey(clientId: string, clientSecret: string) {
  const response = await fetch(`${PLUGGY_API_BASE_URL}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId, clientSecret }),
    cache: "no-store",
    signal: getRequestSignal(),
  });

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      details: await response.text(),
    };
  }

  const payload = (await response.json()) as PluggyAuthResponse;
  const apiKey = payload.apiKey ?? payload.accessToken;

  if (!apiKey) {
    return {
      ok: false as const,
      status: 502,
      details: "Pluggy auth response did not include an API key.",
    };
  }

  return {
    ok: true as const,
    apiKey,
  };
}

async function parseRequestBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {} as ConnectTokenRequest;
  }

  return (await request.json()) as ConnectTokenRequest;
}

export async function POST(request: Request) {
  try {
    const config = getPluggyConfig();

    if (!config) {
      return NextResponse.json(
        { error: "Pluggy environment variables are not configured." },
        { status: 503 },
      );
    }

    const body = await parseRequestBody(request);
    const auth = await createPluggyApiKey(config.clientId, config.clientSecret);

    if (!auth.ok) {
      return NextResponse.json(
        { error: "Could not authenticate with Pluggy.", details: auth.details },
        { status: auth.status },
      );
    }

    const options = {
      avoidDuplicates: true,
      ...body.options,
      clientUserId: body.options?.clientUserId ?? body.clientUserId,
      webhookUrl: body.options?.webhookUrl ?? config.webhookUrl,
      oauthRedirectUri: body.options?.oauthRedirectUri ?? config.oauthRedirectUri,
    };
    const connectTokenPayload = {
      ...(body.itemId ? { itemId: body.itemId } : {}),
      options: Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined && value !== ""),
      ),
    };

    const response = await fetch(`${PLUGGY_API_BASE_URL}/connect_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": auth.apiKey,
      },
      body: JSON.stringify(connectTokenPayload),
      cache: "no-store",
      signal: getRequestSignal(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Could not create Pluggy connect token.", details: errorText },
        { status: response.status },
      );
    }

    const connectToken = (await response.json()) as PluggyConnectTokenResponse;

    return NextResponse.json({
      accessToken: connectToken.accessToken,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected Pluggy connect-token failure.", details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST(
    new Request("http://monex.local/api/connect-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}
