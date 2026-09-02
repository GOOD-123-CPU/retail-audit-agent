import fs from "node:fs/promises";
import path from "node:path";

import { repairMojibake } from "@/lib/encoding";
import { extractDocumentFields } from "@/lib/documents";
import { ProjectCategory, StructuredRow } from "@/lib/types";
import { tryParseNumber } from "@/lib/utils";

function buildTableText(rows: StructuredRow[]) {
  return rows
    .map((row) =>
      Object.entries(row)
        .map(([key, value]) => `${key}: ${value ?? ""}`)
        .join(" | ")
    )
    .join("\n");
}

function normalizeRows(rows: StructuredRow[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (typeof value === "string") {
          const number = tryParseNumber(value);
          return [key.trim(), number ?? value.trim()];
        }

        return [key.trim(), value];
      })
    )
  );
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index]?.trim() ?? ""])
    );
  });
}

async function parseXlsx(buffer: Buffer) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const rows: StructuredRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
      defval: ""
    });
    rows.push(...data);
  }

  return normalizeRows(rows);
}

async function parsePdf(buffer: Buffer) {
  const pdfModule = await import("pdf-parse");
  const pdfParse = "default" in pdfModule ? pdfModule.default : pdfModule;
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

async function parseImage(buffer: Buffer) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("chi_sim+eng");

  try {
    const result = await worker.recognize(buffer);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function parseFileBuffer(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  category: ProjectCategory;
}) {
  const extension = path.extname(params.fileName).toLowerCase();
  let parser: "xlsx" | "csv" | "pdf" | "ocr" | "text" = "text";
  let text = "";
  let structuredRows: StructuredRow[] = [];

  if (extension === ".xlsx" || extension === ".xls") {
    parser = "xlsx";
    structuredRows = await parseXlsx(params.buffer);
    text = buildTableText(structuredRows);
  } else if (extension === ".csv") {
    parser = "csv";
    text = params.buffer.toString("utf8");
    structuredRows = normalizeRows(parseCsv(text));
    text = buildTableText(structuredRows);
  } else if (extension === ".pdf") {
    parser = "pdf";
    text = await parsePdf(params.buffer);
  } else if ([".png", ".jpg", ".jpeg", ".bmp", ".webp"].includes(extension)) {
    parser = "ocr";
    text = await parseImage(params.buffer);
  } else {
    parser = "text";
    text = params.buffer.toString("utf8");
  }

  const repaired = repairMojibake(text);
  const extractedFields =
    params.category === "documents" ||
    params.category === "contracts" ||
    params.category === "invoices"
      ? extractDocumentFields(repaired.text)
      : [];

  return {
    parser,
    text: repaired.text,
    structuredRows,
    extractedFields,
    encodingFixed: repaired.fixed
  };
}

export async function parseStoredFile(params: {
  storedPath: string;
  fileName: string;
  mimeType: string;
  category: ProjectCategory;
}) {
  const buffer = await fs.readFile(params.storedPath);
  return parseFileBuffer({
    buffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    category: params.category
  });
}
