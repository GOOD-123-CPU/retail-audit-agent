import { describe, expect, it, beforeEach } from "vitest";

import {
  assertTrustedMutationRequest,
  ok,
  badRequest,
  readJsonBody
} from "@/lib/http";

function makeRequest(headers: Record<string, string>, body?: string) {
  return new Request("http://localhost:3000/api/test", {
    method: body ? "POST" : "GET",
    headers,
    body
  });
}

describe("http 安全响应头", () => {
  it("ok() 附带完整安全头", async () => {
    const response = ok({ data: 1 });
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("badRequest() 返回错误 JSON 与状态码", async () => {
    const response = badRequest("参数错误", 422);
    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.error).toBe("参数错误");
  });
});

describe("CSRF 同源校验", () => {
  it("同源 origin 放行", () => {
    const request = makeRequest({ origin: "http://localhost:3000" });
    expect(() => assertTrustedMutationRequest(request)).not.toThrow();
  });

  it("缺少 origin/referer 时放行（服务端间调用）", () => {
    const request = makeRequest({});
    expect(() => assertTrustedMutationRequest(request)).not.toThrow();
  });

  it("cross-site 拒绝", () => {
    const request = makeRequest({
      "sec-fetch-site": "cross-site",
      origin: "https://evil.example.com"
    });
    expect(() => assertTrustedMutationRequest(request)).toThrow(/跨站/);
  });

  it("未知 origin 拒绝", () => {
    const request = makeRequest({ origin: "https://evil.example.com" });
    expect(() => assertTrustedMutationRequest(request)).toThrow(/非法请求来源/);
  });
});

describe("readJsonBody", () => {
  it("解析合法 JSON", async () => {
    const request = makeRequest(
      { "content-type": "application/json" },
      JSON.stringify({ name: "测试", value: 42 })
    );
    const body = await readJsonBody<{ name: string; value: number }>(request);
    expect(body.name).toBe("测试");
    expect(body.value).toBe(42);
  });

  it("非 JSON Content-Type 拒绝", async () => {
    const request = makeRequest({ "content-type": "text/plain" }, "hello");
    await expect(readJsonBody(request)).rejects.toThrow(/application\/json/);
  });

  it("超限请求体拒绝", async () => {
    const request = makeRequest(
      { "content-type": "application/json" },
      JSON.stringify({ data: "x".repeat(70_000) })
    );
    await expect(readJsonBody(request)).rejects.toThrow(/过大/);
  });

  it("非法 JSON 拒绝", async () => {
    const request = makeRequest({ "content-type": "application/json" }, "{invalid");
    await expect(readJsonBody(request)).rejects.toThrow(/合法 JSON/);
  });
});
