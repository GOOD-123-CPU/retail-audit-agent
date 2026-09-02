import {
  isLikelyCorruptedInput,
  normalizeInputText,
  repairMojibake
} from "@/lib/encoding";

type CleanTextOptions = {
  maxLength?: number;
  preserveNewlines?: boolean;
};

export function cleanText(value: unknown, options: CleanTextOptions = {}) {
  const normalized = normalizeInputText(String(value ?? ""), {
    preserveNewlines: options.preserveNewlines ?? true,
    maxLength: options.maxLength ?? 5000
  });

  return repairMojibake(normalized).text;
}

export function cleanOptionalText(value: unknown, options: CleanTextOptions = {}) {
  const cleaned = cleanText(value, options);
  if (!cleaned) {
    return "";
  }

  return isLikelyCorruptedInput(cleaned) ? "" : cleaned;
}

export function cleanTextList(
  values: unknown[],
  options: CleanTextOptions = {}
) {
  return values
    .map((value) => cleanText(value, options))
    .filter(Boolean);
}
