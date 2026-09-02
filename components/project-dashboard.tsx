"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ApprovalPanel } from "@/components/approval-panel";
import { WorkpaperPanel } from "@/components/workpaper-panel";
import { PROJECT_RECORD_CATEGORIES } from "@/lib/constants";
import { ProjectChatMessage, ProjectData, SessionUser } from "@/lib/types";
import { formatPercent, truncate } from "@/lib/utils";

type NoticeState = {
  tone: "info" | "error";
  text: string;
};

function buildSuggestedQuestions(project: ProjectData) {
  const generic = [
    "请总结当前项目的主要高风险点。",
    "最关键的证据链分别来自哪些文件？",
    "系统建议优先执行哪些审计程序？"
  ];

  const riskSpecific = project.risks
    .slice(0, 3)
    .map((risk) => `为什么系统判定“${risk.title}”？`);

  return Array.from(new Set([...riskSpecific, ...generic])).slice(0, 6);
}

function projectStatusLabel(status: ProjectData["status"]) {
  return status === "analyzed" ? "已完成分析" : "待分析";
}

function latestAssistantMessage(project: ProjectData) {
  return [...project.conversation]
    .reverse()
    .find((message) => message.role === "assistant") ?? null;
}

function latestActivity(project: ProjectData) {
  return new Date(project.updatedAt).toLocaleString("zh-CN", { hour12: false });
}

function recordCategorySummary(project: ProjectData) {
  return PROJECT_RECORD_CATEGORIES
    .map((category) => ({
      label: category.label,
      count: project.records.filter((record) => record.category === category.value).length
    }))
    .filter((item) => item.count > 0)
    .slice(0, 4);
}

function confidenceLabel(message: ProjectChatMessage) {
  if (message.role !== "assistant" || !message.meta) {
    return null;
  }

  if (message.meta.confidence === "high") {
    return "高可信";
  }

  if (message.meta.confidence === "medium") {
    return "中可信";
  }

  return "低可信";
}

export function ProjectDashboard({
  initialProject,
  user,
  initialApproval,
  initialWorkpapers
}: {
  initialProject: ProjectData;
  user: SessionUser;
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
  initialWorkpapers: Array<{
    id: string;
    title: string;
    status: string;
    generatedMarkdown: string;
    updatedAt: string;
  }>;
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const suggestedQuestions = buildSuggestedQuestions(project);
  const topRisks = project.risks.slice(0, 3);
  const latestReply = latestAssistantMessage(project);
  const categories = recordCategorySummary(project);
  const primaryProcedures = topRisks.flatMap((risk) => risk.auditProcedures).slice(0, 3);

  function setInfo(text: string) {
    setNotice({ tone: "info", text });
  }

  function setError(text: string) {
    setNotice({ tone: "error", text });
  }

  async function refreshProject() {
    const response = await fetch(`/api/projects/${project.id}`);
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "刷新项目失败。");
      return;
    }

    setProject(result.project);
  }

  async function handleUpload(formData: FormData) {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/upload`, {
      method: "POST",
      body: formData
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "上传失败。");
      return;
    }

    setProject(result.project);
    setInfo("资料上传并解析完成。");
    router.refresh();
  }

  async function handleAnalyze() {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/analyze`, { method: "POST" });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "分析失败。");
      return;
    }

    setProject(result.project);
    setInfo("风险扫描、报告与底稿已刷新。");
    router.refresh();
  }

  return (
    <div className="stack">
      {notice ? (
        <div className={`message-strip ${notice.tone === "error" ? "message-strip--error" : ""}`}>
          {notice.text}
        </div>
      ) : null}

      <section className="project-balanced-grid">
        <section className="card stack project-card">
          <div className="card__header">
            <div>
              <h3>资料处理中心</h3>
              <p className="muted">
                支持 Excel、CSV、PDF、图片 OCR 与文本资料。上传后自动归档，分析阶段会同步刷新报告与底稿。
              </p>
            </div>
            <button
              className="button button--ghost"
              onClick={() => {
                startTransition(() => {
                  void refreshProject();
                });
              }}
              type="button"
            >
              刷新项目
            </button>
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

          <div className="detail-grid">
            <article className="data-point">
              <span>项目状态</span>
              <strong>{projectStatusLabel(project.status)}</strong>
            </article>
            <article className="data-point">
              <span>最近刷新</span>
              <strong>{latestActivity(project)}</strong>
            </article>
            <article className="data-point">
              <span>当前用户</span>
              <strong>{user.name}</strong>
            </article>
            <article className="data-point">
              <span>问答轮次</span>
              <strong>{Math.ceil(project.conversation.length / 2)}</strong>
            </article>
          </div>
        </section>

        <section className="card stack project-card">
          <div className="card__header">
            <div>
              <h3>项目镜像总览</h3>
              <p className="muted">
                这里集中展示本轮审计的核心结论、指标快照与下一步建议，作为右侧对称镜像区承接全局视角。
              </p>
            </div>
            <span className={`pill pill--${project.risks.length > 0 ? "medium" : "low"}`}>
              {project.risks.length > 0 ? "关注风险闭环" : "资料待补充"}
            </span>
          </div>

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
                  : "建议先上传关键财务台账、合同与业务说明，再触发风险扫描。"}
              </p>
            </article>
          </div>

          <div className="metric-ribbon">
            <span className="pill">营收同比 {formatPercent(project.metrics.revenueGrowthRate)}</span>
            <span className="pill">退货率 {formatPercent(project.metrics.returnRate)}</span>
            <span className="pill">存货同比 {formatPercent(project.metrics.inventoryGrowthRate)}</span>
            <span className="pill">毛利率 {formatPercent(project.metrics.grossMargin)}</span>
            <span className="pill">门店增长 {formatPercent(project.metrics.storeGrowthRate)}</span>
          </div>
        </section>

        <section className="card stack project-card">
          <div className="card__header">
            <div>
              <h3>资料台账</h3>
              <p className="muted">
                展示文件分类、抽取字段、编码修复状态与关键内容摘要，方便快速确认资料质量。
              </p>
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
                        {" · "}
                        {record.parser}
                        {" · "}
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
              <p className="muted">规则命中、财务信号与证据链在这里汇总，便于快速锁定高风险事项。</p>
            </div>
            <span className={`pill pill--${project.risks.length > 0 ? "high" : "low"}`}>
              {project.risks.length > 0 ? `${project.risks.length} 项风险` : "暂无风险"}
            </span>
          </div>

          <div className="risk-list">
            {project.risks.length === 0 ? (
              <p className="muted">执行风险扫描后，这里会展示命中的规则、依据与建议程序。</p>
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
                    {risk.financialSignals.map((signal) => (
                      <span className="pill" key={`${risk.id}_${signal}`}>
                        {signal}
                      </span>
                    ))}
                  </div>

                  <ul className="evidence">
                    {risk.evidence.map((item, index) => (
                      <li key={`${risk.id}_${index}`}>
                        <strong>{item.fileName}</strong>：{item.summary}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        </section>

        <ApprovalPanel initialApproval={initialApproval} projectId={project.id} user={user} />

        <WorkpaperPanel initialWorkpapers={initialWorkpapers} projectId={project.id} />

        <section className="card stack project-card">
          <div className="card__header">
            <div>
              <h3>项目问答工作台</h3>
              <p className="muted">
                问答已经独立成单独界面，支持多轮追问、检索过程可视化、Markdown 导出与点赞点踩反馈。
              </p>
            </div>
            <Link className="button button--primary" href={`/projects/${project.id}/chat`}>
              进入问答界面
            </Link>
          </div>

          <div className="feature-list">
            <span className="pill">多轮对话</span>
            <span className="pill">检索可视化</span>
            <span className="pill">导出 Markdown</span>
            <span className="pill">反馈闭环</span>
          </div>

          {latestReply ? (
            <article className="card card--embedded stack">
              <div className="split">
                <div className="pill-row">
                  <strong>最近一次系统回答</strong>
                  {confidenceLabel(latestReply) ? (
                    <span className={`pill pill--${latestReply.meta?.confidence ?? "low"}`}>
                      {confidenceLabel(latestReply)}
                    </span>
                  ) : null}
                </div>
                <span className="muted">
                  {new Date(latestReply.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
              </div>
              <p>{truncate(latestReply.content, 180)}</p>
              {latestReply.meta?.relatedRiskCodes?.length ? (
                <div className="pill-row">
                  {latestReply.meta.relatedRiskCodes.map((code) => (
                    <span className="pill" key={`${latestReply.id}_${code}`}>
                      {code}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ) : (
            <p className="muted">尚未开始项目问答，可以先从下方引导问题进入。</p>
          )}

          <div className="pill-row">
            {suggestedQuestions.map((question) => (
              <button
                className="button button--ghost"
                key={question}
                onClick={() => {
                  router.push(`/projects/${project.id}/chat?draft=${encodeURIComponent(question)}`);
                }}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
        </section>

        <section className="card stack project-card">
          <div className="card__header">
            <div>
              <h3>执行摘要与下一步</h3>
              <p className="muted">用右侧镜像卡片收口当前状态，保证项目经理和复核人都能快速理解下一步重点。</p>
            </div>
          </div>

          <div className="checkpoint-list">
            <article className="checkpoint">
              <strong>当前重点风险</strong>
              <p>
                {topRisks.length > 0
                  ? topRisks.map((risk) => `${risk.title}（${risk.score}）`).join("；")
                  : "尚未识别到达到阈值的重点风险。"}
              </p>
            </article>
            <article className="checkpoint">
              <strong>建议补充资料</strong>
              <p>
                {project.records.length > 0
                  ? "建议优先补充合同、对账单、返利政策、门店经营说明等能闭合证据链的资料。"
                  : "请先上传总账、明细账、业务说明、合同与异常事项说明。"}
              </p>
            </article>
            <article className="checkpoint">
              <strong>推荐出口</strong>
              <p>
                可继续进入
                <Link className="inline-link" href={`/projects/${project.id}/report`}>
                  审计报告
                </Link>
                、
                <Link className="inline-link" href={`/projects/${project.id}/workpapers`}>
                  审计底稿
                </Link>
                或
                <Link className="inline-link" href={`/projects/${project.id}/chat`}>
                  项目问答
                </Link>
                做进一步复核。
              </p>
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}
