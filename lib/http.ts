import { NextResponse } from "next/server";

import { env } from "@/lib/env";

const defaultHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

function mergeHeaders(init?: ResponseInit) {
  return {
    ...defaultHeaders,
    ...(init?.headers ?? {})
  };
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    ...init,
    headers: mergeHeaders(init)
  });
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: mergeHeaders() });
}

function allowedOrigins() {
  const configured = new Set<string>([
    env.appUrl,
    "http://127.0.0.1:3000",
    "http://localhost:3000"
  ]);

  return Array.from(configured)
    .filter(Boolean)
    .map((value) => value.replace(/\/$/, ""));
}

export function assertTrustedMutationRequest(request: Request) {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    throw new Error("检测到跨站请求，已拒绝。");
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestOrigin = origin || (referer ? new URL(referer).origin : "");

  if (!requestOrigin) {
    return;
  }

  const trusted = allowedOrigins();
  if (!trusted.includes(requestOrigin.replace(/\/$/, ""))) {
    throw new Error("非法请求来源。");
  }
}

export async function readJsonBody<T>(
  request: Request,
  options: { maxBytes?: number } = {}
) {
  const maxBytes = options.maxBytes ?? 64 * 1024;
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("请求必须使用 application/json。");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new Error("请求体过大。");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("请求体不是合法 JSON。");
  }
}
