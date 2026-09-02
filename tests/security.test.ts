import { describe, expect, it, beforeEach } from "vitest";

import { assertRateLimit } from "@/lib/rate-limit";
import {
  sanitizeShortText,
  sanitizeQuestion,
  sanitizePassword,
  sanitizeProjectCategory,
  sanitizeIdList
} from "@/lib/validation";
import { hasPermission, canReadProject, canWriteProject } from "@/lib/permissions";
import { extractDocumentFields } from "@/lib/documents";
import { SessionUser } from "@/lib/types";

describe("rate-limit", () => {
  const request = new Request("http://localhost:3000/api/x", {
    headers: { "x-real-ip": "10.0.0.1" }
  });

  it("窗口内超过上限抛出限流错误", () => {
    const action = `unit-test-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) {
      expect(() => assertRateLimit(request, { action, max: 5, windowMs: 60_000 })).not.toThrow();
    }
    expect(() => assertRateLimit(request, { action, max: 5, windowMs: 60_000 })).toThrow(
      /请求过于频繁/
    );
  });

  it("不同 IP 互不影响", () => {
    const other = new Request("http://localhost:3000/api/x", {
      headers: { "x-real-ip": "10.0.0.2" }
    });
    expect(() => assertRateLimit(other, { action: "shared", max: 1, windowMs: 60_000 })).not.toThrow();
  });
});

describe("validation", () => {
  it("sanitizeShortText 空值按 required 抛错", () => {
    expect(() => sanitizeShortText("", "名称")).toThrow(/不能为空/);
    expect(sanitizeShortText("", "名称", { required: false })).toBe("");
  });

  it("sanitizeShortText 清洗首尾空白", () => {
    expect(sanitizeShortText("  审计项目  ", "名称")).toBe("审计项目");
  });

  it("sanitizeQuestion 空问题抛错", () => {
    expect(() => sanitizeQuestion("   ")).toThrow(/请输入问题/);
  });

  it("sanitizePassword 长度校验", () => {
    expect(() => sanitizePassword("short")).toThrow(/8 到 128/);
    expect(sanitizePassword("a".repeat(8))).toBe("a".repeat(8));
  });

  it("sanitizeProjectCategory 白名单", () => {
    expect(sanitizeProjectCategory("financials")).toBe("financials");
    expect(() => sanitizeProjectCategory("hacker")).toThrow(/非法资料分类/);
  });

  it("sanitizeIdList 去重且限量", () => {
    const ids = sanitizeIdList(["a", "b", "a", "c"], "记录", 2);
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("permissions", () => {
  const admin: SessionUser = { id: "u_admin", email: "a@x", name: "A", role: "admin" };
  const member: SessionUser = { id: "u_member", email: "m@x", name: "M", role: "user" };
  const projectOfMember = { ownerId: "u_member" } as Parameters<typeof canReadProject>[1];

  it("admin 拥有 users.manage，普通用户没有", () => {
    expect(hasPermission(admin, "users.manage")).toBe(true);
    expect(hasPermission(member, "users.manage")).toBe(false);
  });

  it("admin 可读任意项目，成员只能读自己的", () => {
    expect(canReadProject(admin, projectOfMember)).toBe(true);
    expect(canReadProject(member, projectOfMember)).toBe(true);
    const projectOfOther = { ownerId: "someone_else" } as Parameters<typeof canReadProject>[1];
    expect(canReadProject(member, projectOfOther)).toBe(false);
  });

  it("成员不可写他人项目", () => {
    const projectOfOther = { ownerId: "someone_else" } as Parameters<typeof canWriteProject>[1];
    expect(canWriteProject(member, projectOfOther)).toBe(false);
    expect(canWriteProject(admin, projectOfOther)).toBe(true);
  });
});

describe("documents 字段抽取", () => {
  it("从发票文本抽取发票号、金额与购买方", () => {
    const text = [
      "增值税普通发票",
      "发票号码: 031245678912",
      "开票日期: 2025-12-22",
      "销售方: 示例营销服务有限公司",
      "购买方: 示例商业集团有限公司",
      "价税合计: ¥1,286,000.00",
      "税率: 6%"
    ].join("\n");

    const fields = extractDocumentFields(text);
    const byName = Object.fromEntries(fields.map((field) => [field.name, field.value]));
    expect(byName["单据类型"]).toBe("增值税普通发票");
    expect(byName["发票号码"]).toBe("031245678912");
    expect(byName["购买方"]).toBe("示例商业集团有限公司");
    expect(byName["金额"]).toBe("1,286,000.00");
    expect(byName["税率"]).toBe("6%");
  });

  it("无字段文本返回空数组", () => {
    expect(extractDocumentFields("完全无关的内容")).toEqual([]);
  });

  it("置信度按值长度推导", () => {
    const fields = extractDocumentFields("发票号码: 031245678912");
    expect(fields[0].confidence).toBe("high");
  });
});
