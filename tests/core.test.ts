import { describe, expect, it, beforeAll, afterAll } from "vitest";

import { searchProjectVectors } from "@/lib/vector-search";
import { repairMojibake } from "@/lib/encoding";
import { createId, formatPercent, sanitizeFileName, truncate, tryParseNumber } from "@/lib/utils";
import { ProjectData } from "@/lib/types";
import { nowIso } from "@/lib/utils";

// 向量检索依赖 MySQL 时会查库；测试中强制关闭数据库以覆盖文件回退分支。
const originalProvider = process.env.DATABASE_PROVIDER;

beforeAll(() => {
  process.env.DATABASE_PROVIDER = "json";
});

afterAll(() => {
  process.env.DATABASE_PROVIDER = originalProvider;
});

function makeProjectWithText(texts: { fileName: string; text: string }[]): ProjectData {
  return {
    id: createId("project"),
    name: "测试项目",
    companyName: "示例商业集团有限公司",
    year: "2025",
    industry: "零售业",
    ownerId: "user_test",
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    summary: "",
    records: texts.map((item) => ({
      id: createId("record"),
      category: "operations" as const,
      fileName: item.fileName,
      mimeType: "text/plain",
      size: 100,
      uploadedAt: nowIso(),
      storedPath: `storage/${item.fileName}`,
      parser: "text" as const,
      text: item.text,
      structuredRows: [],
      extractedFields: [],
      encodingFixed: false
    })),
    risks: [],
    metrics: {
      revenueGrowthRate: 0,
      returnRate: 0,
      receivableGrowthRate: 0,
      inventoryGrowthRate: 0,
      inventoryTurnoverDays: 0,
      grossMargin: 0,
      grossMarginTrend: 0,
      storeGrowthRate: 0,
      revenuePerStoreGrowthRate: 0,
      rebateExpenseRate: 0,
      marketingExpenseRate: 0,
      totalExpenseRate: 0,
      receivableTurnoverDays: 0,
      signals: [],
      notes: []
    },
    reportMarkdown: "",
    conversation: []
  };
}

describe("vector-search 文件回退模式检索", () => {
  it("命中相关文本片段", async () => {
    const project = makeProjectWithText([
      {
        fileName: "inventory.txt",
        text: "存货积压严重，部分 SKU 库龄超过 210 天，减值计提不足，存货周转变慢，清仓将出现负毛利。"
      },
      {
        fileName: "rebate.txt",
        text: "返利框架协议约定按季度结算陈列费与市场推广费用，年末集中冲销返利。"
      }
    ]);

    const hits = await searchProjectVectors(project, "存货积压减值计提不足");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].fileName).toBe("inventory.txt");
  });

  it("不相关的查询不会返回高分结果", async () => {
    const project = makeProjectWithText([
      { fileName: "a.txt", text: "门店扩张专项说明，新店开业三十八家。" }
    ]);
    const hits = await searchProjectVectors(project, "zzz qqq xxx 完全无关词");
    expect(hits).toHaveLength(0);
  });
});

describe("encoding 乱码修复", () => {
  it("正常中文文本原样保留", () => {
    const text = "这是一段正常的中文审计文本。";
    const result = repairMojibake(text);
    expect(result.text).toBe(text);
    expect(result.fixed).toBe(false);
  });

  it("latin1 双重编码的中文可被修复", () => {
    // "存货积压" UTF-8 字节被误读为 latin1 的典型 mojibake 场景
    const garbled = Buffer.from("存货积压减值", "utf8").toString("latin1");
    const result = repairMojibake(garbled);
    expect(result.fixed).toBe(true);
    expect(result.text).toContain("存货");
  });
});

describe("utils", () => {
  it("tryParseNumber 解析带千分位与货币符号的金额", () => {
    expect(tryParseNumber("1,286,000.00")).toBe(1286000);
    expect(tryParseNumber("¥1,286,000.00")).toBe(1286000);
    expect(tryParseNumber(42)).toBe(42);
    expect(tryParseNumber("")).toBeNull();
    expect(tryParseNumber("abc")).toBeNull();
  });

  it("formatPercent 输出百分比格式", () => {
    expect(formatPercent(0.2531)).toBe("25.3%");
    expect(formatPercent(-0.08)).toBe("-8.0%");
  });

  it("sanitizeFileName 替换危险字符", () => {
    const unsafe = '报表/\\:*?"<>|2025.txt';
    const safe = sanitizeFileName(unsafe);
    expect(safe).not.toMatch(/[/\\:*?"<>|]/);
    expect(safe.endsWith("2025.txt")).toBe(true);
  });

  it("truncate 超长截断加省略号", () => {
    expect(truncate("a".repeat(50), 10)).toBe("aaaaaaaaaa...");
    expect(truncate("短文本", 10)).toBe("短文本");
  });

  it("createId 带前缀且唯一", () => {
    const a = createId("risk");
    const b = createId("risk");
    expect(a).toMatch(/^risk_/);
    expect(a).not.toBe(b);
  });
});
