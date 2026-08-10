import { NextResponse } from "next/server";

const APP_STATE_KEY = "default";
const SUPABASE_REQUEST_TIMEOUT_MS = 4000;
const PLUGGY_ITEM_EVENT_PREFIX = "item/";

type PluggyWebhookEvent = {
  event?: string;
  eventId?: string;
  itemId?: string;
  error?: unknown;
  [key: string]: unknown;
};

type AppStateRow = {
  state: {
    importAutomationConfigs?: Array<{
      id?: string;
      transport?: string;
      status?: string;
      isEnabled?: boolean;
      provider?: string;
      externalConnectionId?: string;
      processedExternalIds?: string[];
      lastSyncAt?: string;
      notes?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  } | null;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

function getRequestSignal() {
  return AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
}

function getEventStatus(eventName?: string) {
  if (eventName === "item/error") {
    return "needs_authorization";
  }

  if (eventName === "item/created" || eventName === "item/updated") {
    return "active";
  }

  return "active";
}

function buildEventNote(event: PluggyWebhookEvent) {
  const pieces = [`Webhook Pluggy recebido: ${event.event ?? "evento desconhecido"}.`];

  if (event.itemId) {
    pieces.push(`Item ID: ${event.itemId}.`);
  }

  if (event.eventId) {
    pieces.push(`Event ID: ${event.eventId}.`);
  }

  if (event.error) {
    pieces.push(`Erro informado pela Pluggy: ${JSON.stringify(event.error)}.`);
  }

  return pieces.join(" ");
}

async function updateOpenFinanceAutomation(event: PluggyWebhookEvent) {
  const config = getSupabaseConfig();

  if (!config) {
    return false;
  }

  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };

  const currentStateResponse = await fetch(
    `${config.url}/rest/v1/app_state?select=state&key=eq.${APP_STATE_KEY}&limit=1`,
    {
      headers,
      cache: "no-store",
      signal: getRequestSignal(),
    },
  );

  if (!currentStateResponse.ok) {
    return false;
  }

  const rows = (await currentStateResponse.json()) as AppStateRow[];
  const state = rows[0]?.state;

  if (!state?.importAutomationConfigs) {
    return false;
  }

  const now = new Date().toISOString();
  const eventKey = event.eventId ?? event.itemId ?? `${event.event ?? "pluggy-event"}:${now}`;
  const nextConfigs = state.importAutomationConfigs.map((automationConfig) => {
    if (automationConfig.id !== "open-finance" && automationConfig.transport !== "open_finance") {
      return automationConfig;
    }

    return {
      ...automationConfig,
      status: getEventStatus(event.event),
      isEnabled: event.event !== "item/error",
      provider: automationConfig.provider ?? "Pluggy",
      externalConnectionId: event.itemId ?? automationConfig.externalConnectionId,
      processedExternalIds: Array.from(new Set([...(automationConfig.processedExternalIds ?? []), eventKey])),
      lastSyncAt: now,
      notes: buildEventNote(event),
    };
  });

  const saveResponse = await fetch(`${config.url}/rest/v1/app_state`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      key: APP_STATE_KEY,
      state: {
        ...state,
        importAutomationConfigs: nextConfigs,
      },
      updated_at: now,
    }),
    signal: getRequestSignal(),
  });

  return saveResponse.ok;
}

async function parseWebhookEvent(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {} as PluggyWebhookEvent;
  }

  return JSON.parse(rawBody) as PluggyWebhookEvent;
}

export async function POST(request: Request) {
  const event = await parseWebhookEvent(request).catch((error: unknown) => {
    console.warn("Received Pluggy webhook with invalid JSON payload", error);
    return {} as PluggyWebhookEvent;
  });

  console.info("Received Pluggy webhook", {
    event: event.event,
    eventId: event.eventId,
    itemId: event.itemId,
  });

  const shouldUpdateState = Boolean(event.itemId && event.event?.startsWith(PLUGGY_ITEM_EVENT_PREFIX));

  if (shouldUpdateState) {
    void updateOpenFinanceAutomation(event).catch((error: unknown) => {
      console.error("Could not update Open Finance automation from Pluggy webhook", error);
    });
  }

  return NextResponse.json({
    received: true,
    stateUpdateQueued: shouldUpdateState,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/pluggy",
  });
}
