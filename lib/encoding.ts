const mojibakePattern = /(?:\uFFFD|[\u00C2\u00C3][\u0080-\u00BF]|\u00E2[\u0080-\u00BF]{2})/;
const replacementPattern = /\uFFFD/;
const c1ControlPattern = /[\u0080-\u009F]/;
const suspiciousPlaceholderPattern = /(?:\?{3,}|\uFFFD{2,})/;
const cjkPattern = /[\u3400-\u9fff]/;
const latinPattern = /[A-Za-z]{2,}/;
const numberPattern = /\d{2,}/;
const punctuationOnlyPattern = /^[\p{P}\p{S}\s]+$/u;

type NormalizeOptions = {
  preserveNewlines?: boolean;
  maxLength?: number;
};

function stripControlChars(text: string) {
  // 注意：不删除 C1 控制区（U+0080–U+009F）。该区段是 latin1 双重编码
  // 乱码（mojibake）的组成部分，提前删除会让 repairMojibake 永远无法还原文本。
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function trimLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function containsMojibake(text: string) {
  return (
    mojibakePattern.test(text) ||
    replacementPattern.test(text) ||
    c1ControlPattern.test(text)
  );
}

export function containsSuspiciousPlaceholders(text: string) {
  return suspiciousPlaceholderPattern.test(text);
}

export function hasSemanticContent(text: string) {
  return cjkPattern.test(text) || latinPattern.test(text) || numberPattern.test(text);
}

export function normalizeInputText(input: string, options: NormalizeOptions = {}) {
  const maxLength = options.maxLength ?? 5000;
  const normalized = stripControlChars(input)
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .normalize("NFC");

  const cleaned = options.preserveNewlines
    ? trimLines(normalized)
    : normalized.replace(/\s+/g, " ").trim();

  const withoutPlaceholders = cleaned.replace(/\uFFFD+/g, "");

  return withoutPlaceholders.slice(0, maxLength);
}

function scoreReadableContent(text: string) {
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjkCount * 2 + latinCount;
}

export function repairMojibake(text: string) {
  const normalized = normalizeInputText(text, {
    preserveNewlines: true,
    maxLength: Math.max(text.length * 2, 5000)
  });

  if (!containsMojibake(normalized)) {
    return {
      fixed: false,
      text: normalized
    };
  }

  const recoded = normalizeInputText(Buffer.from(normalized, "latin1").toString("utf8"), {
    preserveNewlines: true,
    maxLength: Math.max(text.length * 2, 5000)
  });

  const useRecoded =
    scoreReadableContent(recoded) > scoreReadableContent(normalized) &&
    !containsMojibake(recoded);

  return {
    fixed: useRecoded,
    text: useRecoded ? recoded : normalized
  };
}

export function isLikelyCorruptedInput(text: string) {
  const raw = stripControlChars(String(text ?? ""));
  const normalized = normalizeInputText(raw, {
    preserveNewlines: true,
    maxLength: 2000
  });

  if (!normalized) {
    return true;
  }

  if (replacementPattern.test(normalized) || c1ControlPattern.test(normalized)) {
    return true;
  }

  if (
    containsSuspiciousPlaceholders(raw) &&
    !hasSemanticContent(raw.replace(/[\?\uFFFD]/g, ""))
  ) {
    return true;
  }

  if (punctuationOnlyPattern.test(normalized)) {
    return true;
  }

  return false;
}

export function shouldDropConversationMessage(text: string) {
  const normalized = normalizeInputText(text, {
    preserveNewlines: true,
    maxLength: 2000
  });

  if (!normalized) {
    return true;
  }

  return isLikelyCorruptedInput(normalized);
}
