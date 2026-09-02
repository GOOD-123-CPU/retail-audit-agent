export function createId(prefix?: string) {
  const id = globalThis.crypto.randomUUID();
  return prefix
    ? `${prefix}_${id.replaceAll("-", "")}`
    : id;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function tryParseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/[,%￥¥,\s]/g, "");
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function inferConfidence(value: string) {
  if (value.length >= 12) {
    return "high" as const;
  }

  if (value.length >= 6) {
    return "medium" as const;
  }

  return "low" as const;
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w\u4e00-\u9fa5.-]+/g, "_");
}

export function truncate(text: string, max = 160) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
