import crypto from "node:crypto";

import { cleanOptionalText, cleanText } from "@/lib/cleaners";
import { executeStatement, isDatabaseEnabled, queryRows } from "@/lib/db";
import { approvalsFile, ensureDirectories, readJsonFile, writeJsonFile } from "@/lib/fs";
import { ProjectData, SessionUser } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export type ApprovalStatus = "draft" | "submitted" | "approved" | "rejected";

export type ApprovalHistoryItem = {
  id: string;
  action: "submit" | "approve" | "reject";
  actorId: string;
  actorName: string;
  comment: string;
  createdAt: string;
};

export type ApprovalRequest = {
  id: string;
  projectId: string;
  status: ApprovalStatus;
  submittedBy: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  currentStep: string;
  comment: string;
  history: ApprovalHistoryItem[];
  createdAt: string;
  updatedAt: string;
};

type ApprovalRow = {
  id: string;
  project_id: string;
  status: ApprovalStatus;
  submitted_by: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  current_step: string;
  comment: string;
  history_json: string;
  created_at: string;
  updated_at: string;
};

function normalizeApprovalRequest(request: ApprovalRequest): ApprovalRequest {
  return {
    ...request,
    currentStep: cleanText(request.currentStep, { maxLength: 64, preserveNewlines: false }),
    comment: cleanOptionalText(request.comment, { maxLength: 200 }),
    history: request.history.map((item) => ({
      ...item,
      actorName: cleanText(item.actorName, { maxLength: 80 }),
      comment: cleanOptionalText(item.comment, { maxLength: 200 })
    }))
  };
}

function mapApprovalRow(row: ApprovalRow): ApprovalRequest {
  return normalizeApprovalRequest({
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
    currentStep: row.current_step,
    comment: row.comment,
    history: JSON.parse(row.history_json) as ApprovalHistoryItem[],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

async function readApprovalRequestsFromFile() {
  await ensureDirectories();
  const requests = await readJsonFile<ApprovalRequest[]>(approvalsFile, []);
  return requests.map(normalizeApprovalRequest);
}

async function writeApprovalRequestsToFile(requests: ApprovalRequest[]) {
  await writeJsonFile(
    approvalsFile,
    requests
      .map(normalizeApprovalRequest)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
}

async function persistApprovalToDatabase(request: ApprovalRequest) {
  if (!isDatabaseEnabled()) {
    return false;
  }

  try {
    await executeStatement(
      `INSERT INTO approval_requests (
        id, project_id, status, submitted_by, submitted_at, reviewed_by, reviewed_at,
        current_step, comment, history_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        submitted_by = VALUES(submitted_by),
        submitted_at = VALUES(submitted_at),
        reviewed_by = VALUES(reviewed_by),
        reviewed_at = VALUES(reviewed_at),
        current_step = VALUES(current_step),
        comment = VALUES(comment),
        history_json = VALUES(history_json),
        updated_at = VALUES(updated_at)`,
      [
        request.id,
        request.projectId,
        request.status,
        request.submittedBy,
        request.submittedAt ? request.submittedAt.slice(0, 19).replace("T", " ") : null,
        request.reviewedBy ?? null,
        request.reviewedAt ? request.reviewedAt.slice(0, 19).replace("T", " ") : null,
        request.currentStep,
        request.comment,
        JSON.stringify(request.history),
        request.createdAt.slice(0, 19).replace("T", " "),
        request.updatedAt.slice(0, 19).replace("T", " ")
      ]
    );
    return true;
  } catch {
    return false;
  }
}

export async function getApprovalRequest(projectId: string) {
  if (isDatabaseEnabled()) {
    try {
      const rows = await queryRows<ApprovalRow[]>(
        "SELECT * FROM approval_requests WHERE project_id = ? LIMIT 1",
        [projectId]
      );

      if (rows.length > 0) {
        return mapApprovalRow(rows[0]);
      }
    } catch {
      // Fall back to the file store below.
    }
  }

  const requests = await readApprovalRequestsFromFile();
  const request = requests.find((item) => item.projectId === projectId) ?? null;

  if (request) {
    await persistApprovalToDatabase(request);
  }

  return request;
}

export async function listApprovalRequests() {
  if (isDatabaseEnabled()) {
    try {
      const rows = await queryRows<ApprovalRow[]>(
        "SELECT * FROM approval_requests ORDER BY updated_at DESC"
      );

      if (rows.length > 0) {
        return rows.map(mapApprovalRow);
      }
    } catch {
      // Fall back to the file store below.
    }
  }

  const requests = await readApprovalRequestsFromFile();
  for (const request of requests) {
    await persistApprovalToDatabase(request);
  }

  return requests;
}

async function persistApproval(request: ApprovalRequest) {
  const normalized = normalizeApprovalRequest(request);
  const existing = await readApprovalRequestsFromFile();
  const next = [
    normalized,
    ...existing.filter((item) => item.projectId !== normalized.projectId)
  ];

  await persistApprovalToDatabase(normalized);
  await writeApprovalRequestsToFile(next);
  return normalized;
}

export async function submitApproval(project: ProjectData, user: SessionUser, comment: string) {
  const existing = await getApprovalRequest(project.id);
  const historyItem: ApprovalHistoryItem = {
    id: crypto.randomUUID(),
    action: "submit",
    actorId: user.id,
    actorName: user.name,
    comment,
    createdAt: nowIso()
  };

  const nextRequest: ApprovalRequest = {
    id: existing?.id ?? crypto.randomUUID(),
    projectId: project.id,
    status: "submitted",
    submittedBy: user.id,
    submittedAt: nowIso(),
    reviewedBy: existing?.reviewedBy,
    reviewedAt: existing?.reviewedAt,
    currentStep: "admin_review",
    comment,
    history: [...(existing?.history ?? []), historyItem],
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };

  return persistApproval(nextRequest);
}

export async function reviewApproval(
  projectId: string,
  user: SessionUser,
  action: "approve" | "reject",
  comment: string
) {
  const existing = await getApprovalRequest(projectId);
  if (!existing) {
    throw new Error("当前项目还没有待审批记录。");
  }

  const nextStatus: ApprovalStatus = action === "approve" ? "approved" : "rejected";
  const historyItem: ApprovalHistoryItem = {
    id: crypto.randomUUID(),
    action,
    actorId: user.id,
    actorName: user.name,
    comment,
    createdAt: nowIso()
  };

  return persistApproval({
    ...existing,
    status: nextStatus,
    reviewedBy: user.id,
    reviewedAt: nowIso(),
    currentStep: nextStatus === "approved" ? "done" : "owner_rework",
    comment,
    history: [...existing.history, historyItem],
    updatedAt: nowIso()
  });
}
