import { readRuleConfigsFromDatabase, saveRuleConfigToDatabase } from "@/lib/database-store";
import { cleanText, cleanTextList } from "@/lib/cleaners";
import { ensureDirectories, readJsonFile, ruleConfigsFile, writeJsonFile } from "@/lib/fs";
import { RULES } from "@/lib/rules";
import { RuleDefinition } from "@/lib/types";

export type RuleConfigItem = {
  id: string;
  riskCode: string;
  title: string;
  category: string;
  isEnabled: boolean;
  definition: RuleDefinition;
};

function normalizeRuleDefinition(rule: RuleDefinition): RuleDefinition {
  return {
    riskCode: cleanText(rule.riskCode, { maxLength: 128, preserveNewlines: false }),
    title: cleanText(rule.title, { maxLength: 191 }),
    category: cleanText(rule.category, { maxLength: 128 }),
    triggerKeywords: cleanTextList(rule.triggerKeywords, {
      maxLength: 40,
      preserveNewlines: false
    }),
    financialSignals: cleanTextList(rule.financialSignals, {
      maxLength: 64,
      preserveNewlines: false
    }),
    nonFinancialSignals: cleanTextList(rule.nonFinancialSignals, {
      maxLength: 64,
      preserveNewlines: false
    }),
    validationLogic: cleanTextList(rule.validationLogic, {
      maxLength: 200
    }),
    auditStandard: cleanText(rule.auditStandard, { maxLength: 300 }),
    auditProcedures: cleanTextList(rule.auditProcedures, {
      maxLength: 200
    }),
    summaryTemplate: cleanText(rule.summaryTemplate, { maxLength: 300 })
  };
}

function normalizeRuleConfig(item: RuleConfigItem): RuleConfigItem {
  const definition = normalizeRuleDefinition(item.definition);

  return {
    id: cleanText(item.id, { maxLength: 128, preserveNewlines: false }),
    riskCode: definition.riskCode,
    title: cleanText(item.title, { maxLength: 191 }),
    category: cleanText(item.category, { maxLength: 128 }),
    isEnabled: Boolean(item.isEnabled),
    definition
  };
}

function defaultRuleConfigs() {
  return RULES.map((rule) => ({
    id: rule.riskCode,
    riskCode: rule.riskCode,
    title: rule.title,
    category: rule.category,
    isEnabled: true,
    definition: rule
  })).map(normalizeRuleConfig) satisfies RuleConfigItem[];
}

async function readRuleConfigsFromFile() {
  await ensureDirectories();
  const rules = await readJsonFile<RuleConfigItem[]>(ruleConfigsFile, []);
  return rules.map(normalizeRuleConfig);
}

async function writeRuleConfigsToFile(rules: RuleConfigItem[]) {
  await writeJsonFile(
    ruleConfigsFile,
    rules.map(normalizeRuleConfig).sort((a, b) => a.riskCode.localeCompare(b.riskCode))
  );
}

export async function listRuleConfigs() {
  const databaseRules = await readRuleConfigsFromDatabase();
  if (databaseRules && databaseRules.length > 0) {
    return databaseRules.map(normalizeRuleConfig);
  }

  const fileRules = await readRuleConfigsFromFile();
  if (fileRules.length > 0) {
    return fileRules;
  }

  return defaultRuleConfigs();
}

export async function getActiveRules() {
  const rules = await listRuleConfigs();
  return rules.filter((item) => item.isEnabled).map((item) => item.definition);
}

export async function saveRuleConfig(input: RuleConfigItem) {
  const normalized = normalizeRuleConfig(input);
  const currentRules = await listRuleConfigs();
  const nextRules = [
    ...currentRules.filter((item) => item.riskCode !== normalized.riskCode),
    normalized
  ];

  await saveRuleConfigToDatabase(normalized);
  await writeRuleConfigsToFile(nextRules);
  return normalized;
}
