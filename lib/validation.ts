import { isLikelyCorruptedInput, normalizeInputText } from "@/lib/encoding";
import { ProjectCategory } from "@/lib/types";
import { unique } from "@/lib/utils";

const projectCategories = new Set<ProjectCategory>([
  "financials",
  "documents",
  "contracts",
  "invoices",
  "operations",
  "other"
]);

export function sanitizeShortText(
  value: unknown,
  fieldName: string,
  options: { maxLength?: number; required?: boolean } = {}
) {
  const maxLength = options.maxLength ?? 120;
  const required = options.required ?? true;
  const normalized = normalizeInputText(String(value ?? ""), { maxLength });

  if (!normalized) {
    if (required) {
      throw new Error(`${fieldName}不能为空。`);
    }

    return "";
  }

  if (isLikelyCorruptedInput(normalized)) {
    throw new Error(`${fieldName}存在乱码或不可识别内容。`);
  }

  return normalized;
}

export function sanitizeQuestion(value: unknown) {
  const raw = String(value ?? "");
  const question = normalizeInputText(raw, {
    preserveNewlines: true,
    maxLength: 500
  });

  if (!question) {
    throw new Error("请输入问题。");
  }

  if (isLikelyCorruptedInput(raw)) {
    throw new Error("检测到问题内容存在乱码或异常占位符，请重新输入。");
  }

  return question;
}

export function sanitizePassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 8 || password.length > 128) {
    throw new Error("密码长度必须在 8 到 128 位之间。");
  }

  return password;
}

export function sanitizeProjectCategory(value: unknown) {
  const category = String(value ?? "other") as ProjectCategory;
  if (!projectCategories.has(category)) {
    throw new Error("非法资料分类。");
  }

  return category;
}

export function sanitizeIdList(value: unknown, fieldName: string, maxItems = 20) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName}列表格式不正确。`);
  }

  return unique(
    value.map((item) =>
      sanitizeShortText(item, `${fieldName}ID`, {
        maxLength: 64
      })
    )
  ).slice(0, maxItems);
}
