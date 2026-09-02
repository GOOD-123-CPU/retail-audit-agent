import { ProjectData, ProjectMetricSnapshot, RiskEvidence, RiskHit, RuleDefinition } from "@/lib/types";
import { createId, formatPercent, truncate, tryParseNumber, unique } from "@/lib/utils";

export const RULES: RuleDefinition[] = [
  {
    riskCode: "retail_revenue_fraud_001",
    title: "刷单 / 虚假收入",
    category: "收入确认 + 舞弊风险",
    triggerKeywords: ["刷单", "冲量", "虚假收入", "异常退货", "提前确认收入", "补单", "渠道压货"],
    financialSignals: ["revenue_growth_spike", "return_rate_spike", "receivable_mismatch"],
    nonFinancialSignals: ["促销冲量", "异常订单", "月末集中发货"],
    validationLogic: [
      "核对月末大额订单、退货与收款时间是否匹配。",
      "检查收入增长与回款、退货率是否同步支持。",
      "追踪重点客户与平台订单是否存在异常撤销或跨期冲销。"
    ],
    auditStandard: "收入确认应与控制权转移、实际交易与后续回款保持一致。",
    auditProcedures: [
      "抽查月末及期后销售订单、签收单与回款流水。",
      "核对异常退货、红冲与折让记录。",
      "对异常高增长渠道执行函证或替代性程序。"
    ],
    summaryTemplate: "收入增长明显快于经营质量表现，存在刷单或提前确认收入风险。"
  },
  {
    riskCode: "retail_store_expansion_001",
    title: "门店扩张无效 / 收入虚增",
    category: "收入确认",
    triggerKeywords: ["门店扩张", "新店开业", "低效门店", "闭店", "跑马圈地", "同店下滑"],
    financialSignals: ["store_growth_fast", "revenue_per_store_decline"],
    nonFinancialSignals: ["新开店爬坡慢", "闭店率提升"],
    validationLogic: [
      "比较门店数量增长与单店收入变化趋势。",
      "核对新店开业时间、爬坡周期与销售贡献是否匹配。",
      "检查闭店、迁址或装修停业门店是否被错误计入扩张成果。"
    ],
    auditStandard: "门店扩张应带来可持续经营质量改善，而非单纯规模外观增长。",
    auditProcedures: [
      "抽取新开店与闭店台账，复核开闭店日期与经营情况。",
      "分析同店销售与单店坪效变化。",
      "访谈区域运营负责人并复核预算兑现差异。"
    ],
    summaryTemplate: "门店数量增长与单店经营表现背离，需警惕规模扩张掩盖收入质量问题。"
  },
  {
    riskCode: "retail_inventory_001",
    title: "存货积压 / 减值计提不足",
    category: "存货审计",
    triggerKeywords: ["滞销", "积压", "减值", "库龄", "清仓", "负毛利", "周转变慢"],
    financialSignals: ["inventory_growth_high", "inventory_turnover_slow", "gross_margin_drop"],
    nonFinancialSignals: ["季末清货", "大额折扣", "退换货增加"],
    validationLogic: [
      "分析库存增长与收入增长是否匹配。",
      "复核库龄、周转天数与毛利率变化。",
      "抽查临期、滞销品是否已及时计提减值。"
    ],
    auditStandard: "存货应按成本与可变现净值孰低计量，库龄与滞销迹象应充分反映。",
    auditProcedures: [
      "抽盘滞销与临期商品，核对实物状态。",
      "复核减值测试模型、售价预测与促销策略。",
      "比对采购计划与后续销售去化情况。"
    ],
    summaryTemplate: "库存规模、周转与毛利率同时恶化，存在积压及减值不足风险。"
  },
  {
    riskCode: "retail_rebate_001",
    title: "返利 / 费用舞弊",
    category: "费用审计",
    triggerKeywords: ["返利", "市场费用", "陈列费", "促销费", "渠道补贴", "费用报销", "冲销"],
    financialSignals: ["rebate_expense_spike", "marketing_expense_spike", "document_support_gap"],
    nonFinancialSignals: ["票据不完整", "结算条件模糊"],
    validationLogic: [
      "检查返利、促销费用与合同条款是否一致。",
      "核对费用发生与结算票据、验收单及审批链。",
      "关注异常冲销、跨期确认与模糊摘要。"
    ],
    auditStandard: "返利及市场费用应有完整业务依据、审批痕迹与合同支持。",
    auditProcedures: [
      "抽查返利协议、对账单、发票与付款凭证。",
      "复核大额市场费用的活动证明与验收材料。",
      "追踪跨期冲销分录及异常摘要。"
    ],
    summaryTemplate: "返利与市场费用占比偏高且单据支持薄弱，存在费用舞弊或归集失真风险。"
  },
  {
    riskCode: "retail_margin_deterioration_001",
    title: "毛利率异常下滑 / 盈利质量恶化",
    category: "财务分析",
    triggerKeywords: ["毛利率下滑", "负毛利", "降价", "价格战", "折扣", "毛利异常", "盈利恶化"],
    financialSignals: ["gross_margin_drop", "gross_margin_downtrend", "marketing_expense_spike"],
    nonFinancialSignals: ["大额折扣", "促销依赖加深"],
    validationLogic: [
      "分析毛利率月度趋势与季节性规律是否背离。",
      "拆分品类毛利，识别是结构恶化还是单价/成本异常。",
      "核对降价、折扣审批与会计期间归属。"
    ],
    auditStandard: "毛利率变动应与业务结构、定价策略及成本变动逻辑一致。",
    auditProcedures: [
      "按月度/品类重算毛利率并执行趋势与结构分析。",
      "抽查大额折扣、特价审批单与执行一致性。",
      "复核成本结转方法一致性及期末成本完整性。"
    ],
    summaryTemplate: "毛利率绝对水平偏低且呈持续下滑趋势，盈利质量存在恶化风险。"
  },
  {
    riskCode: "retail_return_anomaly_001",
    title: "退货异常 / 虚增收入回冲",
    category: "收入确认 + 舞弊风险",
    triggerKeywords: ["异常退货", "退货增加", "批量退货", "退货率上升", "重复下单", "退换货"],
    financialSignals: ["return_rate_spike", "return_rate_downtrend_reversal"],
    nonFinancialSignals: ["期后退货集中", "退货原因集中"],
    validationLogic: [
      "对比退货率与历史区间、行业参考值。",
      "分析退货时间分布是否集中于期末或期后。",
      "核对退货审批、物流签收与红字发票链条完整性。"
    ],
    auditStandard: "退货与折让应完整入账，收入确认应扣除可合理预计的退货义务。",
    auditProcedures: [
      "取得期后退货明细并测试资产负债表日收入完整性。",
      "抽样核对退货商品实物流与账务红冲记录。",
      "对集中退货客户执行访谈或函证。"
    ],
    summaryTemplate: "退货率显著偏高或期末期后退货集中，存在以退货回冲虚增收入的迹象。"
  },
  {
    riskCode: "retail_revenue_quality_001",
    title: "收入质量存疑 / 应收激增",
    category: "收入确认",
    triggerKeywords: ["回款滞后", "账期延长", "应收激增", "压货", "渠道压货", "信用放宽"],
    financialSignals: ["receivable_mismatch", "receivable_turnover_slow"],
    nonFinancialSignals: ["回款节奏滞后", "放宽信用换收入"],
    validationLogic: [
      "对比应收增速与收入增速的剪刀差并追溯原因。",
      "测算应收周转天数变化及账龄迁移。",
      "评估期末新增大客户/大额订单的信用审批。"
    ],
    auditStandard: "收入确认应与回款能力、信用政策变动逻辑保持一致。",
    auditProcedures: [
      "执行应收账龄与周转分析，识别异常长账龄。",
      "对期末大额应收执行函证或期后回款测试。",
      "复核临时放宽信用的审批依据与后续回款兑现。"
    ],
    summaryTemplate: "应收增速显著快于收入且周转转慢，收入确认的可持续性存疑。"
  },
  {
    riskCode: "retail_expense_anomaly_001",
    title: "费用归集异常 / 跨期调节",
    category: "费用审计",
    triggerKeywords: ["费用激增", "跨期", "费用冲销", "预提", "费用挂账", "其他应收", "往来挂账"],
    financialSignals: ["total_expense_rate_high", "rebate_expense_spike", "marketing_expense_spike"],
    nonFinancialSignals: ["摘要模糊", "往来科目异常"],
    validationLogic: [
      "分析费用率月度波动与业务量的匹配性。",
      "识别年末集中发生/冲销的费用分录。",
      "检查往来科目中长期挂账的费用化支出。"
    ],
    auditStandard: "费用应按权责发生制归属期间，科目归集应与经济实质一致。",
    auditProcedures: [
      "执行费用月度波动分析与年末分录截止测试。",
      "抽查大额费用合同、验收与付款三单匹配。",
      "清查其他应收/其他应付中费用化挂账项目。"
    ],
    summaryTemplate: "费用率异常偏高且存在跨期/冲销迹象，可能存在费用跨期调节或归集失真。"
  }
];

type RowLike = Record<string, string | number | null>;

function readValue(row: RowLike, aliases: string[]) {
  for (const alias of aliases) {
    const key = Object.keys(row).find((item) => item.toLowerCase() === alias.toLowerCase());
    if (!key) {
      continue;
    }

    const numeric = tryParseNumber(row[key]);
    if (numeric !== null) {
      return numeric;
    }

    if (typeof row[key] === "string") {
      return row[key] as string;
    }
  }

  return null;
}

export function deriveProjectMetrics(project: ProjectData): ProjectMetricSnapshot {
  const rows = project.records.flatMap((record) => record.structuredRows);
  const metrics: ProjectMetricSnapshot = {
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

  if (rows.length === 0) {
    return metrics;
  }

  const revenues: number[] = [];
  const previousRevenues: number[] = [];
  const returns: number[] = [];
  const receivables: number[] = [];
  const previousReceivables: number[] = [];
  const inventories: number[] = [];
  const previousInventories: number[] = [];
  const turnoverDays: number[] = [];
  const grossMargins: number[] = [];
  const storeCounts: number[] = [];
  const previousStoreCounts: number[] = [];
  const rebateExpenses: number[] = [];
  const marketingExpenses: number[] = [];

  for (const row of rows) {
    const revenue = readValue(row, ["revenue", "收入", "营业收入"]);
    const lastRevenue = readValue(row, ["last_year_revenue", "上年同期收入", "去年收入"]);
    const returnValue = readValue(row, ["returns", "退货金额", "退货"]);
    const receivable = readValue(row, ["receivables", "应收账款", "应收"]);
    const lastReceivable = readValue(row, ["last_year_receivables", "上年同期应收账款"]);
    const inventory = readValue(row, ["inventory", "存货"]);
    const lastInventory = readValue(row, ["last_year_inventory", "上年同期存货"]);
    const inventoryDays = readValue(row, ["inventory_turnover_days", "存货周转天数"]);
    const grossMargin = readValue(row, ["gross_margin", "毛利率"]);
    const stores = readValue(row, ["store_count", "门店数"]);
    const lastStores = readValue(row, ["last_year_store_count", "上年同期门店数"]);
    const rebate = readValue(row, ["rebate_expense", "返利费用"]);
    const marketing = readValue(row, ["marketing_expense", "市场费用", "促销费用"]);

    if (typeof revenue === "number") revenues.push(revenue);
    if (typeof lastRevenue === "number") previousRevenues.push(lastRevenue);
    if (typeof returnValue === "number") returns.push(returnValue);
    if (typeof receivable === "number") receivables.push(receivable);
    if (typeof lastReceivable === "number") previousReceivables.push(lastReceivable);
    if (typeof inventory === "number") inventories.push(inventory);
    if (typeof lastInventory === "number") previousInventories.push(lastInventory);
    if (typeof inventoryDays === "number") turnoverDays.push(inventoryDays);
    if (typeof grossMargin === "number") grossMargins.push(grossMargin > 1 ? grossMargin / 100 : grossMargin);
    if (typeof stores === "number") storeCounts.push(stores);
    if (typeof lastStores === "number") previousStoreCounts.push(lastStores);
    if (typeof rebate === "number") rebateExpenses.push(rebate);
    if (typeof marketing === "number") marketingExpenses.push(marketing);
  }

  const revenue = revenues.reduce((sum, value) => sum + value, 0);
  const previousRevenue = previousRevenues.reduce((sum, value) => sum + value, 0);
  const returnAmount = returns.reduce((sum, value) => sum + value, 0);
  const receivable = receivables.reduce((sum, value) => sum + value, 0);
  const previousReceivable = previousReceivables.reduce((sum, value) => sum + value, 0);
  const inventory = inventories.reduce((sum, value) => sum + value, 0);
  const previousInventory = previousInventories.reduce((sum, value) => sum + value, 0);
  const rebateExpense = rebateExpenses.reduce((sum, value) => sum + value, 0);
  const marketingExpense = marketingExpenses.reduce((sum, value) => sum + value, 0);
  const stores = storeCounts.length > 0 ? storeCounts.at(-1) ?? 0 : 0;
  const previousStores = previousStoreCounts.length > 0 ? previousStoreCounts.at(-1) ?? 0 : 0;

  metrics.revenueGrowthRate = previousRevenue > 0 ? (revenue - previousRevenue) / previousRevenue : 0;
  metrics.returnRate = revenue > 0 ? returnAmount / revenue : 0;
  metrics.receivableGrowthRate =
    previousReceivable > 0 ? (receivable - previousReceivable) / previousReceivable : 0;
  metrics.inventoryGrowthRate =
    previousInventory > 0 ? (inventory - previousInventory) / previousInventory : 0;
  metrics.inventoryTurnoverDays =
    turnoverDays.length > 0
      ? turnoverDays.reduce((sum, value) => sum + value, 0) / turnoverDays.length
      : 0;
  metrics.grossMargin =
    grossMargins.length > 0
      ? grossMargins.reduce((sum, value) => sum + value, 0) / grossMargins.length
      : 0;
  metrics.storeGrowthRate = previousStores > 0 ? (stores - previousStores) / previousStores : 0;

  const revenuePerStore = stores > 0 ? revenue / stores : 0;
  const previousRevenuePerStore = previousStores > 0 ? previousRevenue / previousStores : 0;
  metrics.revenuePerStoreGrowthRate =
    previousRevenuePerStore > 0
      ? (revenuePerStore - previousRevenuePerStore) / previousRevenuePerStore
      : 0;

  metrics.rebateExpenseRate = revenue > 0 ? rebateExpense / revenue : 0;
  metrics.marketingExpenseRate = revenue > 0 ? marketingExpense / revenue : 0;
  metrics.totalExpenseRate = metrics.rebateExpenseRate + metrics.marketingExpenseRate;

  // 毛利率月度趋势：逐期计算环比变化取平均（仅当有 ≥3 期数据才有趋势意义）。
  if (grossMargins.length >= 3) {
    const deltas: number[] = [];
    for (let i = 1; i < grossMargins.length; i += 1) {
      deltas.push(grossMargins[i] - grossMargins[i - 1]);
    }
    metrics.grossMarginTrend =
      deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  }

  // 应收周转天数（期末口径），用于识别回款能力恶化。
  const monthlyRevenue = revenues.length > 0 ? revenue / revenues.length : 0;
  metrics.receivableTurnoverDays =
    monthlyRevenue > 0 ? (receivable / monthlyRevenue) * 30 : 0;

  if (metrics.revenueGrowthRate > 0.25) {
    metrics.signals.push("revenue_growth_spike");
    metrics.notes.push(`营收同比增长 ${formatPercent(metrics.revenueGrowthRate)}`);
  }

  if (metrics.returnRate > 0.08) {
    metrics.signals.push("return_rate_spike");
    metrics.notes.push(`退货率达到 ${formatPercent(metrics.returnRate)}`);
  }

  if (metrics.receivableGrowthRate - metrics.revenueGrowthRate > 0.15) {
    metrics.signals.push("receivable_mismatch");
    metrics.notes.push("应收增速明显快于收入增速。");
  }

  if (metrics.storeGrowthRate > 0.15) {
    metrics.signals.push("store_growth_fast");
    metrics.notes.push(`门店数量同比增长 ${formatPercent(metrics.storeGrowthRate)}`);
  }

  if (metrics.revenuePerStoreGrowthRate < -0.08) {
    metrics.signals.push("revenue_per_store_decline");
    metrics.notes.push(
      `单店收入同比下降 ${formatPercent(Math.abs(metrics.revenuePerStoreGrowthRate))}`
    );
  }

  if (metrics.inventoryGrowthRate > metrics.revenueGrowthRate + 0.15) {
    metrics.signals.push("inventory_growth_high");
    metrics.notes.push("存货增速高于收入增速。");
  }

  if (metrics.inventoryTurnoverDays > 120) {
    metrics.signals.push("inventory_turnover_slow");
    metrics.notes.push(`平均存货周转天数 ${metrics.inventoryTurnoverDays.toFixed(0)} 天`);
  }

  if (metrics.grossMargin < 0.18) {
    metrics.signals.push("gross_margin_drop");
    metrics.notes.push(`平均毛利率仅 ${formatPercent(metrics.grossMargin)}`);
  }

  // 毛利率逐期下滑（趋势斜率 < -0.3 个百分点/期）。
  if (metrics.grossMarginTrend < -0.003) {
    metrics.signals.push("gross_margin_downtrend");
    metrics.notes.push(
      `毛利率呈逐期下滑趋势（平均每期下降 ${(metrics.grossMarginTrend * 100).toFixed(2)} 个百分点）`
    );
  }

  // 退货率逐期恶化：后半段均值较前半段上升 20% 以上。
  if (returns.length >= 6 && revenue > 0) {
    const half = Math.floor(returns.length / 2);
    const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const earlyRate = avg(returns.slice(0, half)) / avg(revenues.slice(0, half));
    const lateRate =
      avg(returns.slice(half)) / avg(revenues.slice(half, revenues.length));
    if (earlyRate > 0 && lateRate > earlyRate * 1.2) {
      metrics.signals.push("return_rate_downtrend_reversal");
      metrics.notes.push(
        `退货率逐期走高：期初 ${formatPercent(earlyRate)} → 期末 ${formatPercent(lateRate)}`
      );
    }
  }

  // 应收周转天数超过 45 天（零售业务通常账期较短）。
  if (metrics.receivableTurnoverDays > 45) {
    metrics.signals.push("receivable_turnover_slow");
    metrics.notes.push(`应收周转天数约 ${metrics.receivableTurnoverDays.toFixed(0)} 天`);
  }

  // 费用合计占比过高（返利 + 市场费用 > 12%）。
  if (metrics.totalExpenseRate > 0.12) {
    metrics.signals.push("total_expense_rate_high");
    metrics.notes.push(`返利与市场费用合计占收入 ${formatPercent(metrics.totalExpenseRate)}`);
  }

  if (metrics.rebateExpenseRate > 0.06) {
    metrics.signals.push("rebate_expense_spike");
    metrics.notes.push(`返利费用率 ${formatPercent(metrics.rebateExpenseRate)}`);
  }

  if (metrics.marketingExpenseRate > 0.08) {
    metrics.signals.push("marketing_expense_spike");
    metrics.notes.push(`市场费用率 ${formatPercent(metrics.marketingExpenseRate)}`);
  }

  const docSupportWeak = project.records.some((record) => {
    if (!["documents", "contracts", "invoices"].includes(record.category)) {
      return false;
    }

    const importantFields = new Set(record.extractedFields.map((field) => field.name));
    return !importantFields.has("合同编号") || !importantFields.has("付款条件");
  });

  if (docSupportWeak) {
    metrics.signals.push("document_support_gap");
    metrics.notes.push("部分返利或合同资料关键信息缺失。");
  }

  metrics.signals = unique(metrics.signals);
  metrics.notes = unique(metrics.notes);
  return metrics;
}

function matchKeywords(project: ProjectData, keywords: string[]) {
  const matches: { keyword: string; evidence: RiskEvidence }[] = [];

  for (const record of project.records) {
    for (const keyword of keywords) {
      if (!record.text.includes(keyword)) {
        continue;
      }

      const index = record.text.indexOf(keyword);
      matches.push({
        keyword,
        evidence: {
          recordId: record.id,
          fileName: record.fileName,
          summary: `文本命中关键词“${keyword}”`,
          sourceType: "text",
          sourceExcerpt: truncate(record.text.slice(Math.max(0, index - 20), index + 60), 100)
        }
      });
    }
  }

  return matches;
}

function metricEvidence(project: ProjectData, metrics: ProjectMetricSnapshot) {
  const firstFinancialRecord = project.records.find((record) => record.structuredRows.length > 0);
  if (!firstFinancialRecord) {
    return [];
  }

  return metrics.notes.map<RiskEvidence>((note) => ({
    recordId: firstFinancialRecord.id,
    fileName: firstFinancialRecord.fileName,
    summary: note,
    sourceType: "structured"
  }));
}

export function analyzeProjectRules(project: ProjectData, activeRules: RuleDefinition[] = RULES) {
  const metrics = deriveProjectMetrics(project);
  const risks: RiskHit[] = [];

  for (const rule of activeRules) {
    const keywordMatches = matchKeywords(project, rule.triggerKeywords);
    const financialSignals = rule.financialSignals.filter((signal) => metrics.signals.includes(signal));
    let score = keywordMatches.length * 14;

    if (rule.riskCode === "retail_store_expansion_001") {
      score += financialSignals.length * 16;
    } else {
      score += financialSignals.length * 18;
    }

    if (score < 30) {
      continue;
    }

    const evidence = unique(
      [...keywordMatches.map((item) => item.evidence), ...metricEvidence(project, metrics)].map((item) =>
        JSON.stringify(item)
      )
    )
      .map((item) => JSON.parse(item) as RiskEvidence)
      .slice(0, 6);

    const severity =
      score >= 75 ? "high" : score >= 45 ? "medium" : ("low" as const);

    risks.push({
      id: createId("risk"),
      riskCode: rule.riskCode,
      title: rule.title,
      severity,
      score,
      category: rule.category,
      matchedKeywords: unique(keywordMatches.map((item) => item.keyword)),
      financialSignals,
      nonFinancialSignals: rule.nonFinancialSignals,
      validationLogic: rule.validationLogic,
      auditStandard: rule.auditStandard,
      auditProcedures: rule.auditProcedures,
      summary: rule.summaryTemplate,
      evidence,
      aiExplanation: "",
      createdAt: new Date().toISOString()
    });
  }

  return { metrics, risks };
}
