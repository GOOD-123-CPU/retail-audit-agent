import crypto from "node:crypto";

import { executeStatement, isDatabaseEnabled, queryRows } from "@/lib/db";
import { ProjectData } from "@/lib/types";
import { nowIso, unique } from "@/lib/utils";

type VectorChunkRow = {
  id: string;
  project_id: string;
  record_id: string;
  file_name: string;
  chunk_index: number;
  content_text: string;
  embedding_json: string;
};

export type VectorHit = {
  recordId: string;
  fileName: string;
  content: string;
  score: number;
};

const vectorSize = 64;

function tokenize(text: string) {
  return (text.toLowerCase().match(/[\u4e00-\u9fff]{1,4}|[a-z0-9_]+/g) ?? []).filter(
    (item) => item.length >= 2
  );
}

function embedText(text: string) {
  const vector = new Array<number>(vectorSize).fill(0);
  for (const token of tokenize(text)) {
    const hash = crypto.createHash("sha256").update(token).digest();
    const index = hash[0] % vectorSize;
    const sign = hash[1] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function cosine(a: number[], b: number[]) {
  let sum = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    sum += a[index] * b[index];
  }
  return sum;
}

function chunkText(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return [];
  }

  const chunkSize = 180;
  const result: string[] = [];
  for (let index = 0; index < clean.length; index += chunkSize) {
    result.push(clean.slice(index, index + chunkSize));
  }

  return unique(result).slice(0, 20);
}

export async function rebuildProjectVectors(project: ProjectData) {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    await executeStatement("DELETE FROM vector_chunks WHERE project_id = ?", [project.id]);

    for (const record of project.records) {
      const chunks = chunkText(record.text);

      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        await executeStatement(
        `INSERT INTO vector_chunks (
          id, project_id, record_id, file_name, chunk_index, content_text, embedding_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          project.id,
          record.id,
          record.fileName,
          index,
          content,
          JSON.stringify(embedText(content)),
          nowIso().slice(0, 19).replace("T", " "),
          nowIso().slice(0, 19).replace("T", " ")
          ]
        );
      }
    }
  } catch {
    return;
  }
}

export async function searchProjectVectors(project: ProjectData, question: string) {
  const queryEmbedding = embedText(question);
  let candidates: VectorHit[] = [];

  if (isDatabaseEnabled()) {
    try {
      const rows = await queryRows<VectorChunkRow[]>(
        "SELECT * FROM vector_chunks WHERE project_id = ?",
        [project.id]
      );

      candidates = rows.map((row) => ({
        recordId: row.record_id,
        fileName: row.file_name,
        content: row.content_text,
        score: cosine(queryEmbedding, JSON.parse(row.embedding_json) as number[])
      }));
    } catch {
      candidates = [];
    }
  } else {
    candidates = project.records.flatMap((record) =>
      chunkText(record.text).map((content) => ({
        recordId: record.id,
        fileName: record.fileName,
        content,
        score: cosine(queryEmbedding, embedText(content))
      }))
    );
  }

  return candidates
    .filter((item) => item.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
