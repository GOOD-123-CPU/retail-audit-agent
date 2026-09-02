import { describe, expect, it } from "vitest";

import { deriveProjectMetrics, analyzeProjectRules, RULES } from "@/lib/rules";
import { ProjectData, ProjectMetricSnapshot, RiskHit, RuleDefinition } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

function emptyMetrics(): ProjectMetricSnapshot {
  return {
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
  };
}

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
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
    records: [],
    risks: [],
    metrics: emptyMetrics(),
    reportMarkdown: "",
    conversation: [],
    ...overrides
  };
}

function monthRow(overrides: Record<string, string | number>) {
  return {
    month: "2025-01",
    revenue: 20_000_000,
    last_year_revenue: 16_000_000,
    returns: 400_000,
    receivables: 3_000_000,
    last_year_receivables: 2_800_000,
    inventory: 15_000_000,
    last_year_inventory: 12_000_000,
    inventory_turnover_days: 100,
    gross_margin: 0.25,
    store_count: 180,
    last_year_store_count: 170,
    rebate_expense: 600_000,
    marketing_expense: 900_000,
    ...overrides
  };
}

describe("deriveProjectMetrics", () => {
  it("空项目返回零值指标", () => {
    const metrics = deriveProjectMetrics(makeProject());
    expect(metrics.revenueGrowthRate).toBe(0);
    expect(metrics.signals).toHaveLength(0);
  });

  it("正确计算营收增速、退货率与门店增速", () => {
    const project = makeProject({
      records: [
        {
          id: "r1",
          category: "financials",
          fileName: "financials.csv",
          mimeType: "text/csv",
          size: 100,
          uploadedAt: nowIso(),
          storedPath: "storage/test.csv",
          parser: "csv",
          text: "",
          structuredRows: [
            monthRow({}),
            monthRow({ month: "2025-02", revenue: 24_000_000, last_year_revenue: 18_000_000 })
          ],
          extractedFields: [],
          encodingFixed: false
        }
      ]
    });

    const metrics = deriveProjectMetrics(project);
    // 全年合计 44M / 上年 34M
    expect(metrics.revenueGrowthRate).toBeCloseTo((44_000_000 - 34_000_000) / 34_000_000, 6);
    expect(metrics.returnRate).toBeCloseTo(800_000 / 44_000_000, 6);
    expect(metrics.storeGrowthRate).toBeCloseTo((180 - 170) / 170, 6);
  });

  it("高增速触发 revenue_growth_spike 信号", () => {
    const project = makeProject({
      records: [
        {
          id: "r1",
          category: "financials",
          fileName: "financials.csv",
          mimeType: "text/csv",
          size: 100,
          uploadedAt: nowIso(),
          storedPath: "storage/test.csv",
          parser: "csv",
          text: "",
          structuredRows: [monthRow({ revenue: 30_000_000, last_year_revenue: 20_000_000 })],
          extractedFields: [],
          encodingFixed: false
        }
      ]
    });

    const metrics = deriveProjectMetrics(project);
    expect(metrics.signals).toContain("revenue_growth_spike");
  });

  it("毛利率连续下滑触发 gross_margin_downtrend 信号", () => {
    const margins = [0.26, 0.25, 0.24, 0.23, 0.22, 0.21];
    const project = makeProject({
      records: [
        {
          id: "r1",
          category: "financials",
          fileName: "financials.csv",
          mimeType: "text/csv",
          size: 100,
          uploadedAt: nowIso(),
          storedPath: "storage/test.csv",
          parser: "csv",
          text: "",
          structuredRows: margins.map((gross_margin, index) =>
            monthRow({ month: `2025-0${index + 1}`, gross_margin })
          ),
          extractedFields: [],
          encodingFixed: false
        }
      ]
    });

    const metrics = deriveProjectMetrics(project);
    expect(metrics.signals).toContain("gross_margin_downtrend");
    expect(metrics.grossMarginTrend).toBeLessThan(0);
  });

  it("毛利率上升时不应触发下滑信号", () => {
    const margins = [0.20, 0.21, 0.22, 0.23, 0.24, 0.25];
    const project = makeProject({
      records: [
        {
          id: "r1",
          category: "financials",
          fileName: "financials.csv",
          mimeType: "text/csv",
          size: 100,
          uploadedAt: nowIso(),
          storedPath: "storage/test.csv",
          parser: "csv",
          text: "",
          structuredRows: margins.map((gross_margin, index) =>
            monthRow({ month: `2025-0${index + 1}`, gross_margin })
          ),
          extractedFields: [],
          encodingFixed: false
        }
      ]
    });

    const metrics = deriveProjectMetrics(project);
    expect(metrics.signals).not.toContain("gross_margin_downtrend");
  });

  it("费用合计占比超过 12% 触发 total_expense_rate_high", () => {
    const project = makeProject({
      records: [
        {
          id: "r1",
          category: "financials",
          fileName: "financials.csv",
          mimeType: "text/csv",
          size: 100,
          uploadedAt: nowIso(),
          storedPath: "storage/test.csv",
          parser: "csv",
          text: "",
          structuredRows: [monthRow({ rebate_expense: 1_600_000, marketing_expense: 1_200_000 })],
          extractedFields: [],
          encodingFixed: false
        }
      ]
    });

    const metrics = deriveProjectMetrics(project);
    expect(metrics.signals).toContain("total_expense_rate_high");
    expect(metrics.totalExpenseRate).toBeGreaterThan(0.12);
  });
});

describe("analyzeProjectRules", () => {
  it("低于 30 分的风险不入选", () => {
    const rule: RuleDefinition = {
      ...RULES[0],
      triggerKeywords: ["绝不存在的词"],
      financialSignals: []
    };
    const { risks } = analyzeProjectRules(makeProject(), [rule]);
    expect(risks).toHaveLength(0);
  });

  it("关键词命中数 × 14 进入评分并决定严重级别", () => {
    const rule: RuleDefinition = {
      ...RULES[0],
      triggerKeywords: ["刷单", "冲量", "补单", "渠道压货", "异常退货", "提前确认收入"],
      financialSignals: []
    };
    const text = "存在刷单与冲量行为，并配合补单、渠道压货，还有异常退货和提前确认收入。";
    const project = makeProject({
      records: [
        {
          id: "r1",
          category: "operations",
          fileName: "memo.txt",
          mimeType: "text/plain",
          size: 100,
          uploadedAt: nowIso(),
          storedPath: "storage/memo.txt",
          parser: "text",
          text,
          structuredRows: [],
          extractedFields: [],
          encodingFixed: false
        }
      ]
    });

    const { risks } = analyzeProjectRules(project, [rule]);
    expect(risks).toHaveLength(1);
    // 6 个关键词 × 14 = 84 → high
    expect(risks[0].score).toBe(84);
    expect(risks[0].severity).toBe("high");
    expect(risks[0].evidence.length).toBeGreaterThan(0);
  });
});
