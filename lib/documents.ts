import { ExtractedField } from "@/lib/types";
import { inferConfidence, truncate } from "@/lib/utils";

type PatternConfig = {
  name: string;
  regex: RegExp;
};

const patterns: PatternConfig[] = [
  {
    name: "单据类型",
    regex: /(增值税专用发票|增值税普通发票|采购合同|销售合同|费用报销单|结算单|收据)/
  },
  {
    name: "发票号码",
    regex: /(?:发票号码|票据号码|No\.?)[:：]?\s*([0-9]{8,20})/i
  },
  {
    name: "开票日期",
    regex: /(?:开票日期|日期|签订日期)[:：]?\s*(20\d{2}[年\-/.]\d{1,2}[月\-/.]\d{1,2}日?)/i
  },
  {
    name: "供应商 / 销售方",
    regex: /(?:销售方|供应商|销方名称|乙方)[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9（）()·\-]{4,50})/i
  },
  {
    name: "购买方",
    regex: /(?:购买方|购方名称|甲方)[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9（）()·\-]{4,50})/i
  },
  {
    name: "金额",
    regex: /(?:价税合计|金额合计|合同金额|含税金额|金额)[:：]?\s*[￥¥]?\s*([0-9,]+\.\d{2}|[0-9,]+)/i
  },
  {
    name: "税额",
    regex: /(?:税额)[:：]?\s*[￥¥]?\s*([0-9,]+\.\d{2}|[0-9,]+)/i
  },
  {
    name: "税率",
    regex: /(?:税率)[:：]?\s*([0-9]{1,2}(?:\.\d+)?%)/i
  },
  {
    name: "合同编号",
    regex: /(?:合同编号|合同号|协议编号)[:：]?\s*([A-Za-z0-9\\-_/]{6,40})/i
  },
  {
    name: "付款条件",
    regex: /(?:付款条件|支付条款|结算方式)[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9，,。.%（）()\-]{6,80})/i
  }
];

export function extractDocumentFields(text: string) {
  const result: ExtractedField[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) {
      continue;
    }

    const value = match[1] ?? match[0];
    result.push({
      name: pattern.name,
      value,
      confidence: inferConfidence(value),
      sourceSnippet: truncate(match[0], 80)
    });
  }

  return result;
}
