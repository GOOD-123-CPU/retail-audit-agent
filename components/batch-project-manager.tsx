"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type BatchProjectItem = {
  id: string;
  name: string;
  companyName: string;
  year: string;
  status: string;
  riskCount: number;
  highRiskCount: number;
};

export function BatchProjectManager({
  initialProjects
}: {
  initialProjects: BatchProjectItem[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggle(projectId: string) {
    setSelectedIds((current) =>
      current.includes(projectId)
        ? current.filter((item) => item !== projectId)
        : [...current, projectId]
    );
  }

  function toggleAll() {
    if (selectedIds.length === initialProjects.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(initialProjects.map((project) => project.id));
  }

  async function handleAction(type: "analyze" | "submitApproval") {
    const endpoint =
      type === "analyze" ? "/api/projects/batch/analyze" : "/api/projects/batch/approval";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ projectIds: selectedIds, comment: "批量发起" })
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "批量操作失败。");
      return;
    }

    setMessage(type === "analyze" ? "批量分析完成。" : "批量审批提交流程已发起。");
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <section className="card stack">
      <div className="card__header">
        <div className="split">
          <div>
            <h3>批量项目管理</h3>
            <p className="muted">适合月度集中审计作业，可统一发起分析和审批，不需要逐个进入项目。</p>
          </div>
          <div className="actions">
            <button className="button button--ghost" onClick={toggleAll} type="button">
              {selectedIds.length === initialProjects.length ? "清空选择" : "全选项目"}
            </button>
            <button
              className="button button--secondary"
              disabled={isPending || selectedIds.length === 0}
              onClick={() => {
                startTransition(() => {
                  void handleAction("analyze");
                });
              }}
              type="button"
            >
              批量分析
            </button>
            <button
              className="button button--primary"
              disabled={isPending || selectedIds.length === 0}
              onClick={() => {
                startTransition(() => {
                  void handleAction("submitApproval");
                });
              }}
              type="button"
            >
              批量提交审批
            </button>
          </div>
        </div>
      </div>
      {message ? <div className="pill">{message}</div> : null}
      <div className="split">
        <span className="muted">已选择 {selectedIds.length} / {initialProjects.length} 个项目</span>
        <span className="muted">接口会逐项校验项目权限和可写范围。</span>
      </div>
      <div className="record-list">
        {initialProjects.map((project) => (
          <article className="card card--embedded" key={project.id}>
            <div className="split">
              <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  checked={selectedIds.includes(project.id)}
                  onChange={() => toggle(project.id)}
                  type="checkbox"
                />
                <strong>{project.name}</strong>
              </label>
              <div className="pill-row">
                <span className="pill">{project.status}</span>
                <span className="pill">风险 {project.riskCount}</span>
                <span className="pill pill--high">高风险 {project.highRiskCount}</span>
              </div>
            </div>
            <p className="muted">
              {project.companyName} 路 {project.year}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
