"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ApprovalPanel } from "@/components/approval-panel";
import { ProjectChatWorkspace } from "@/components/project-chat-workspace";
import { ReportView } from "@/components/report-view";
import { PROJECT_RECORD_CATEGORIES } from "@/lib/constants";
import { ProjectData, SessionUser } from "@/lib/types";
import { formatPercent, truncate } from "@/lib/utils";

type WorkspaceView = "overview" | "chat" | "report" | "workpapers";

type NoticeState = {
  tone: "info" | "error";
  text: string;
};

type Workpaper = {
  id: string;
  title: string;
  status: string;
  generatedMarkdown: string;
  updatedAt: string;
};

function projectStatusLabel(status: ProjectData["status"]) {
  return status === "analyzed" ? "已完成分析" : "待分析";
}

function latestActivity(project: ProjectData) {
  return new Date(project.updatedAt).toLocaleString("zh-CN", { hour12: false });
}

function recordCategorySummary(project: ProjectData) {
  return PROJECT_RECORD_CATEGORIES.map((category) => ({
    label: category.label,
    count: project.records.filter((record) => record.category === category.value).length
  })).filter((item) => item.count > 0);
}

function isWorkspaceView(value: string | undefined): value is WorkspaceView {
  return value === "overview" || value === "chat" || value === "report" || value === "workpapers";
}

export function ProjectWorkspace({
  initialProject,
  initialApproval,
  initialWorkpapers,
  initialView,
  user
}: {
  initialProject: ProjectData;
  initialApproval: {
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
  } | null;
  initialWorkpapers: Workpaper[];
  initialView?: string;
  user: SessionUser;
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [workpapers, setWorkpapers] = useState(initialWorkpapers);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>(
    isWorkspaceView(initialView) ? initialView : "overview"
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  useEffect(() => {
    setWorkpapers(initialWorkpapers);
  }, [initialWorkpapers]);

  useEffect(() => {
    if (isWorkspaceView(initialView)) {
      setActiveView(initialView);
    }
  }, [initialView]);

  const categories = useMemo(() => recordCategorySummary(project), [project]);
  const topRisks = useMemo(() => project.risks.slice(0, 3), [project]);
  const primaryProcedures = useMemo(
    () => topRisks.flatMap((risk) => risk.auditProcedures).slice(0, 3),
    [topRisks]
  );

  function setInfo(text: string) {
    setNotice({ tone: "info", text });
  }

  function setError(text: string) {
    setNotice({ tone: "error", text });
  }

  async function refreshProject() {
    const response = await fetch(`/api/projects/${project.id}`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error ?? "刷新项目失败。");
      return;
    }

    setProject(result.project);
  }

  async function refreshWorkpapers() {
    const response = await fetch(`/api/projects/${project.id}/workpapers`);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error ?? "读取底稿失败。");
      return;
    }

    setWorkpapers(result.workpapers);
  }

  async function handleUpload(formData: FormData) {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/upload`, {
      method: "POST",
      body: formData
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error ?? "上传失败。");
      return;
    }

    setProject(result.project);
    setInfo("资料已上传并完成解析。");
    router.refresh();
  }

  async function handleAnalyze() {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/analyze`, { method: "POST" });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error ?? "分析失败。");
      return;
    }

    setProject(result.project);
    await refreshWorkpapers();
    setInfo("风险扫描、报告和底稿已刷新。");
    router.refresh();
  }

  async function handleRegenerateWorkpapers() {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/workpapers`, {
      method: "POST"
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error ?? "重建底稿失败。");
      return;
    }

    setProject(result.project);
    setWorkpapers(result.workpapers);
    setInfo("底稿已重新生成。");
    router.refresh();
  }

  return (
    <div className="stack">
      {notice ? (
        <div className={`message-strip ${notice.tone === "error" ? "message-strip--error" : ""}`}>
          {notice.text}
        </div>
      ) : null}

      <section className="card card--hero stack">
        <div className="card__header">
          <div>
            <h3>统一项目工作台</h3>
            <p className="muted">
              资料上传、风险分析、项目问答、审计报告、底稿和审批都集中在同一工作台里完成。
            </p>
          </div>
          <div className="actions">
            <button
              className="button button--ghost"
              onClick={() => {
                startTransition(() => {
                  void refreshProject();
                  void refreshWorkpapers();
                });
              }}
              type="button"
            >
              刷新数据
            </button>
            <Link className="button button--ghost" href={`/projects/${project.id}/chat`}>
              独立问答页
            </Link>
            <Link className="button button--ghost" href={`/projects/${project.id}/report`}>
              独立报告页
            </Link>
          </div>
        </div>

        <div className="workspace-tabs" role="tablist" aria-label="项目工作台页签">
          {[
            { key: "overview", label: "总览" },
            { key: "chat", label: "问答" },
            { key: "report", label: "报告" },
            { key: "workpapers", label: "底稿" }
          ].map((item) => (
            <button
              aria-selected={activeView === item.key}
              className={`workspace-tab ${activeView === item.key ? "workspace-tab--active" : ""}`}
              key={item.key}
              onClick={() => setActiveView(item.key as WorkspaceView)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="detail-grid">
          <article className="data-point">
            <span>项目状态</span>
            <strong>{projectStatusLabel(project.status)}</strong>
          </article>
          <article className="data-point">
            <span>最近更新</span>
            <strong>{latestActivity(project)}</strong>
          </article>
          <article className="data-point">
            <span>资料数量</span>
            <strong>{project.records.length}</strong>
          </article>
          <article className="data-point">
            <span>识别风险</span>
            <strong>{project.risks.length}</strong>
          </article>
        </div>
      </section>

      {activeView === "overview" ? (
        <section className="project-balanced-grid">
          <section className="card stack project-card">
            <div className="card__header">
              <div>
                <h3>资料处理中心</h3>
                <p className="muted">
                  支持 Excel、CSV、PDF、图片 OCR 和文本资料；上传后自动归档并参与分析。
                </p>
              </div>
            </div>

            <form
              className="stack"
              action={(formData) => {
                startTransition(() => {
                  void handleUpload(formData);
                });
              }}
            >
              <div className="form-grid">
                <label className="label">
                  资料分类
                  <select className="select" defaultValue="financials" name="category">
                    {PROJECT_RECORD_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  上传文件
                  <input className="input" multiple name="files" required type="file" />
                </label>
              </div>
              <div className="actions">
                <button className="button button--primary" disabled={isPending} type="submit">
                  {isPending ? "处理中..." : "上传并解析"}
                </button>
                <button
                  className="button button--secondary"
                  disabled={isPending || project.records.length === 0}
                  onClick={() => {
                    startTransition(() => {
                      void handleAnalyze();
                    });
                  }}
                  type="button"
                >
                  {isPending ? "处理中..." : "执行风险扫描"}
                </button>
              </div>
            </form>

            <div className="checkpoint-list">
              <article className="checkpoint">
                <strong>核心结论</strong>
                <p>{project.summary || "项目已创建，等待上传资料并开始分析。"}</p>
              </article>
              <article className="checkpoint">
                <strong>资料结构</strong>
                <p>
                  {categories.length > 0
                    ? categories.map((item) => `${item.label} ${item.count} 份`).join("，")
                    : "尚未上传资料。"}
                </p>
              </article>
              <article className="checkpoint">
                <strong>优先程序</strong>
                <p>
                  {primaryProcedures.length > 0
                    ? primaryProcedures.join("；")
                    : "建议先上传总账、明细账、合同和业务说明，再执行风险扫描。"}
                </p>
              </article>
            </div>

            <div className="metric-ribbon">
              <span className="pill">营收同比 {formatPercent(project.metrics.revenueGrowthRate)}</span>
              <span className="pill">退货率 {formatPercent(project.metrics.returnRate)}</span>
              <span className="pill">存货同比 {formatPercent(project.metrics.inventoryGrowthRate)}</span>
              <span className="pill">毛利率 {formatPercent(project.metrics.grossMargin)}</span>
            </div>
          </section>

          <section className="card stack project-card">
            <div className="card__header">
              <div>
                <h3>资料台账</h3>
                <p className="muted">快速查看解析结果、关键字段和文本摘要，确认资料质量。</p>
              </div>
              <span className="pill">{project.records.length} 份资料</span>
            </div>

            <div className="record-list">
              {project.records.length === 0 ? (
                <p className="muted">尚未上传资料。</p>
              ) : (
                project.records.map((record) => (
                  <article className="card card--embedded stack" key={record.id}>
                    <div className="split">
                      <div className="stack stack--tight">
                        <h4>{record.fileName}</h4>
                        <p className="muted">
                          {PROJECT_RECORD_CATEGORIES.find((item) => item.value === record.category)?.label ??
                            record.category}
                          {" 路 "}
                          {record.parser}
                          {" 路 "}
                          {Math.max(1, Math.round(record.size / 1024))} KB
                        </p>
                      </div>
                      <div className="pill-row">
                        {record.encodingFixed ? <span className="pill">已修复编码</span> : null}
                        <span className="pill">字段 {record.extractedFields.length}</span>
                        <span className="pill">行数 {record.structuredRows.length}</span>
                      </div>
                    </div>

                    {record.extractedFields.length > 0 ? (
                      <div className="pill-row">
                        {record.extractedFields.slice(0, 6).map((field) => (
                          <span className="pill" key={`${record.id}_${field.name}`}>
                            {field.name}: {field.value}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <p className="muted">{truncate(record.text || "该文件暂无可展示文本。", 220)}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="card stack project-card">
            <div className="card__header">
              <div>
                <h3>风险看板</h3>
                <p className="muted">规则命中、财务信号和证据链都在这里汇总，便于复核。</p>
              </div>
              <span className={`pill pill--${project.risks.length > 0 ? "high" : "low"}`}>
                {project.risks.length > 0 ? `${project.risks.length} 项风险` : "暂无风险"}
              </span>
            </div>

            <div className="risk-list">
              {project.risks.length === 0 ? (
                <p className="muted">执行风险扫描后，这里会展示命中的规则、依据和建议程序。</p>
              ) : (
                project.risks.map((risk) => (
                  <article className="card card--embedded stack" key={risk.id}>
                    <div className="split">
                      <div className="stack stack--tight">
                        <h4>{risk.title}</h4>
                        <p className="muted">{risk.category}</p>
                      </div>
                      <div className="pill-row">
                        <span className={`pill pill--${risk.severity}`}>{risk.severity}</span>
                        <span className="pill">评分 {risk.score}</span>
                      </div>
                    </div>
                    <p>{risk.aiExplanation || risk.summary}</p>
                    <div className="pill-row">
                      {risk.matchedKeywords.map((keyword) => (
                        <span className="pill" key={`${risk.id}_${keyword}`}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <ApprovalPanel initialApproval={initialApproval} projectId={project.id} user={user} />
        </section>
      ) : null}

      {activeView === "chat" ? <ProjectChatWorkspace initialProject={project} /> : null}

      {activeView === "report" ? (
        <section className="report-shell">
          <section className="card stack">
            <div className="card__header">
              <div>
                <h3>审计报告</h3>
                <p className="muted">这里展示当前项目的完整报告草稿，可继续进入独立页面打印或下载。</p>
              </div>
              <div className="actions">
                <a className="button button--secondary" href={`/api/projects/${project.id}/report`} target="_blank">
                  下载 Markdown
                </a>
                <Link className="button button--ghost" href={`/projects/${project.id}/report`}>
                  打开独立报告页
                </Link>
              </div>
            </div>
          </section>
          <ReportView markdown={project.reportMarkdown || "# 报告暂未生成"} />
        </section>
      ) : null}

      {activeView === "workpapers" ? (
        <section className="stack">
          <section className="card stack">
            <div className="card__header">
              <div>
                <h3>审计底稿</h3>
                <p className="muted">自动生成项目底稿与高风险事项复核材料，可在同页查看和重建。</p>
              </div>
              <div className="actions">
                <button
                  className="button button--secondary"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void handleRegenerateWorkpapers();
                    });
                  }}
                  type="button"
                >
                  {isPending ? "生成中..." : "重新生成"}
                </button>
                <Link className="button button--ghost" href={`/projects/${project.id}/workpapers`}>
                  打开独立底稿页
                </Link>
              </div>
            </div>
          </section>

          <section className="card stack">
            <div className="record-list">
              {workpapers.length === 0 ? (
                <p className="muted">当前还没有底稿，请先执行分析或重新生成。</p>
              ) : (
                workpapers.map((workpaper) => (
                  <article className="card card--paper stack" key={workpaper.id}>
                    <div className="split">
                      <strong>{workpaper.title}</strong>
                      <span className="pill">{workpaper.status}</span>
                    </div>
                    <pre className="paper-preview">{workpaper.generatedMarkdown}</pre>
                    <span className="muted">
                      更新时间：{new Date(workpaper.updatedAt).toLocaleString("zh-CN", { hour12: false })}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}
