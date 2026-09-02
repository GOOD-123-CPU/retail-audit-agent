"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SessionUser } from "@/lib/types";

type ApprovalRequest = {
  id: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  currentStep: string;
  comment: string;
  history: Array<{
    id: string;
    action: "submit" | "approve" | "reject";
    actorName: string;
    comment: string;
    createdAt: string;
  }>;
};

function statusLabel(status: ApprovalRequest["status"] | undefined) {
  switch (status) {
    case "submitted":
      return "待审批";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "草稿";
  }
}

function statusTone(status: ApprovalRequest["status"] | undefined) {
  switch (status) {
    case "approved":
      return "low";
    case "rejected":
      return "high";
    default:
      return "medium";
  }
}

function actionLabel(action: "submit" | "approve" | "reject") {
  switch (action) {
    case "submit":
      return "提交审批";
    case "approve":
      return "审批通过";
    default:
      return "驳回";
  }
}

export function ApprovalPanel({
  projectId,
  user,
  initialApproval
}: {
  projectId: string;
  user: SessionUser;
  initialApproval: ApprovalRequest | null;
}) {
  const router = useRouter();
  const [approval, setApproval] = useState(initialApproval);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setApproval(initialApproval);
  }, [initialApproval]);

  async function submit() {
    const response = await fetch(`/api/projects/${projectId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ comment })
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "提交审批失败。");
      return;
    }

    setApproval(result.approval);
    setComment("");
    setMessage("审批已提交。");
    router.refresh();
  }

  async function review(action: "approve" | "reject") {
    const response = await fetch(`/api/projects/${projectId}/approval`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, comment })
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "审批处理失败。");
      return;
    }

    setApproval(result.approval);
    setComment("");
    setMessage(action === "approve" ? "审批已通过。" : "审批已驳回。");
    router.refresh();
  }

  return (
    <section className="card stack project-card">
      <div className="card__header">
        <div>
          <h3>审批流</h3>
          <p className="muted">支持项目提交、管理员审批与驳回重做，形成标准审计作业闭环。</p>
        </div>
      </div>

      <div className="pill-row">
        <span className={`pill pill--${statusTone(approval?.status)}`}>
          状态：{statusLabel(approval?.status)}
        </span>
        <span className="pill">当前步骤：{approval?.currentStep ?? "owner_prepare"}</span>
      </div>

      <label className="label">
        审批备注
        <textarea
          className="textarea"
          maxLength={200}
          onChange={(event) => setComment(event.target.value)}
          placeholder="补充提交说明或审批意见"
          value={comment}
        />
      </label>

      <div className="actions">
        <button
          className="button button--secondary"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              void submit();
            });
          }}
          type="button"
        >
          提交审批
        </button>
        {user.role === "admin" ? (
          <>
            <button
              className="button button--primary"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  void review("approve");
                });
              }}
              type="button"
            >
              审批通过
            </button>
            <button
              className="button button--ghost"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  void review("reject");
                });
              }}
              type="button"
            >
              驳回
            </button>
          </>
        ) : null}
      </div>

      {message ? <div className="message-strip">{message}</div> : null}

      <div className="record-list">
        {(approval?.history ?? []).length === 0 ? (
          <p className="muted">当前还没有审批记录。</p>
        ) : (
          (approval?.history ?? []).map((item) => (
            <article className="card card--embedded stack" key={item.id}>
              <div className="split">
                <strong>{item.actorName}</strong>
                <span className="muted">
                  {new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
              </div>
              <p>{actionLabel(item.action)}</p>
              <p className="muted">{item.comment || "无备注"}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
