export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { isLikelyCorruptedInput, normalizeInputText } from "@/lib/encoding";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { listRuleConfigs, saveRuleConfig } from "@/lib/rule-configs";
import { RuleDefinition } from "@/lib/types";

function sanitizeRuleText(value: string, maxLength: number, label: string) {
  if (isLikelyCorruptedInput(value)) {
    throw new Error(`${label}存在乱码或不可识别内容。`);
  }

  return normalizeInputText(value, { maxLength });
}

function sanitizeRuleTextList(value: unknown, maxLength: number, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label}必须是数组。`);
  }

  return value
    .map((item) => sanitizeRuleText(String(item ?? ""), maxLength, label))
    .filter(Boolean);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    if (!hasPermission(user, "users.manage")) {
      return badRequest("当前账号没有规则管理权限。", 403);
    }

    const rules = await listRuleConfigs();
    return ok({ rules });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "读取规则失败。");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    if (!hasPermission(user, "users.manage")) {
      return badRequest("当前账号没有规则管理权限。", 403);
    }

    const body = await readJsonBody<{
      riskCode: string;
      title: string;
      category: string;
      isEnabled: boolean;
      definition: Partial<RuleDefinition>;
    }>(request);

    if (!body.definition || typeof body.definition !== "object") {
      return badRequest("规则定义不能为空。");
    }

    const definition: RuleDefinition = {
      riskCode: sanitizeRuleText(body.riskCode, 128, "风险编码"),
      title: sanitizeRuleText(body.title, 191, "规则标题"),
      category: sanitizeRuleText(body.category, 128, "规则分类"),
      triggerKeywords: sanitizeRuleTextList(body.definition.triggerKeywords, 40, "触发关键词"),
      financialSignals: sanitizeRuleTextList(body.definition.financialSignals, 64, "财务信号"),
      nonFinancialSignals: sanitizeRuleTextList(body.definition.nonFinancialSignals, 64, "非财务信号"),
      validationLogic: sanitizeRuleTextList(body.definition.validationLogic, 200, "验证逻辑"),
      auditStandard: sanitizeRuleText(
        String(body.definition.auditStandard ?? ""),
        300,
        "审计准则"
      ),
      auditProcedures: sanitizeRuleTextList(body.definition.auditProcedures, 200, "审计程序"),
      summaryTemplate: sanitizeRuleText(
        String(body.definition.summaryTemplate ?? ""),
        300,
        "摘要模板"
      )
    };

    await saveRuleConfig({
      id: definition.riskCode,
      riskCode: definition.riskCode,
      title: definition.title,
      category: definition.category,
      isEnabled: Boolean(body.isEnabled),
      definition
    });

    const rules = await listRuleConfigs();
    return ok({ rules });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "保存规则失败。");
  }
}
