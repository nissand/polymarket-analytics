import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type McpRequestBody = {
  method?: string;
  params?: unknown;
};

function buildAuthHeader() {
  if (process.env.MCP_AUTH_HEADER) {
    return process.env.MCP_AUTH_HEADER;
  }
  if (process.env.MCP_AUTH_TOKEN) {
    return `Bearer ${process.env.MCP_AUTH_TOKEN}`;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as McpRequestBody;

  if (!body.method || typeof body.method !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid MCP method." },
      { status: 400 }
    );
  }

  const mcpUrl =
    process.env.MCP_SERVER_URL ?? "https://rare-sturgeon-827.convex.site/mcp";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = buildAuthHeader();
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: body.method,
      params: body.params ?? {},
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid MCP response payload." },
      { status: 502 }
    );
  }

  if (!response.ok || payload.error) {
    return NextResponse.json(
      { error: payload.error ?? "MCP request failed." },
      { status: 502 }
    );
  }

  return NextResponse.json(payload.result ?? payload);
}
