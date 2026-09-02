"use client";

import { useEffect, useState, useTransition } from "react";

import { ProjectChatMessage, ProjectData } from "@/lib/types";
import { sanitizeFileName, truncate } from "@/lib/utils";

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

function retrievalTypeLabel(type: "rule" | "vector") {
  return type === "rule" ? "规则命中" : "向量检索";
}

function feedbackLabel(feedback: "up" | "down" | null | undefined) {
  if (feedback === "up") {
    return "已点赞";
  }

  if (feedback === "down") {
    return "已点踩";
  }

  return "未反馈";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function buildMarkdown(project: ProjectData) {
  const lines: string[] = [
    `# ${project.name} - 项目问答记录`,
    "",
    `- 公司：${project.companyName}`,
    `- 年度：${project.year}`,
    `- 行业：${project.industry}`,
    `- 导出时间：${formatDateTime(new Date().toISOString())}`,
    ""
  ];

  if (project.conversation.length === 0) {
    lines.push("当前没有可导出的问答记录。");
    return lines.join("\n");
  }

  project.conversation.forEach((message, index) => {
    const title = message.role === "user" ? "用户提问" : "系统回答";
    lines.push(`## ${index + 1}. ${title}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
    lines.push(`- 时间：${formatDateTime(message.createdAt)}`);

    if (message.role === "assistant" && message.meta) {
      lines.push(`- 可信度：${confidenceLabel(message) ?? "未知"}`);
      lines.push(`- 回答来源：${message.meta.answeredBy === "ai" ? "AI" : "规则兜底"}`);
      lines.push(`- 反馈：${feedbackLabel(message.meta.feedback)}`);
      lines.push(
        `- 资料充分性：${message.meta.insufficient ? "当前资料不足，无法完全判断" : "资料基本充分"}`
      );

      if (message.meta.relatedRiskCodes.length > 0) {
        lines.push(`- 相关风险：${message.meta.relatedRiskCodes.join("、")}`);
      }

      if (message.meta.citations.length > 0) {
        lines.push("");
        lines.push("### 证据引用");
        lines.push("");
        message.meta.citations.forEach((citation) => {
          lines.push(
            `- ${citation.fileName} | ${citation.riskTitle} | ${citation.summary} | 评分 ${citation.score}`
          );
        });
      }

      if (message.meta.retrievals.length > 0) {
        lines.push("");
        lines.push("### 检索过程");
        lines.push("");
        message.meta.retrievals.forEach((item, itemIndex) => {
          lines.push(
            `${itemIndex + 1}. ${retrievalTypeLabel(item.type)} | ${item.title} | ${truncate(
              item.detail,
              160
            )}${item.score !== undefined ? ` | 分值 ${item.score}` : ""}`
          );
        });
      }
    }

    lines.push("");
  });

  return lines.join("\n");
}

export function ProjectChatWorkspace({
  initialProject,
  initialDraft = ""
}: {
  initialProject: ProjectData;
  initialDraft?: string;
}) {
  const [project, setProject] = useState(initialProject);
  const [question, setQuestion] = useState(initialDraft);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  useEffect(() => {
    setQuestion(initialDraft);
  }, [initialDraft]);

  const starters = buildSuggestedQuestions(project);
  const assistantMessages = project.conversation.filter((message) => message.role === "assistant");
  const citedFiles = Array.from(
    new Set(
      assistantMessages.flatMap((message) =>
        message.meta?.citations.map((citation) => citation.fileName) ?? []
      )
    )
  );
  const retrievalCount = assistantMessages.reduce(
    (total, message) => total + (message.meta?.retrievals.length ?? 0),
    0
  );
  const latestAssistant = [...assistantMessages].reverse()[0] ?? null;

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

  async function handleAsk(questionOverride?: string) {
    const nextQuestion = (questionOverride ?? question).trim();
    if (!nextQuestion) {
      return;
    }

    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question: nextQuestion })
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "问答失败。");
      return;
    }

    setProject(result.project);
    setQuestion("");
  }

  async function handleClearChat() {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/chat`, {
      method: "DELETE"
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "清空问答记录失败。");
      return;
    }

    setProject(result.project);
    setInfo("问答记录已清空。");
  }

  async function handleFeedback(messageId: string, feedback: "up" | "down" | null) {
    setNotice(null);
    const response = await fetch(`/api/projects/${project.id}/chat`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messageId, feedback })
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "保存反馈失败。");
      return;
    }

    setProject(result.project);
    setInfo("反馈已记录。");
  }

  function handleExportMarkdown() {
    const markdown = buildMarkdown(project);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFileName(project.name)}_项目问答.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setInfo("Markdown 已导出。");
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
            <h3>项目会话中心</h3>
            <p className="muted">
              支持围绕当前项目做连续追问。系统只依据项目内资料、风险命中和向量检索片段作答。
            </p>
          </div>
          <div className="actions">
            <button
              className="button button--ghost"
              onClick={() => {
                startTransition(() => {
                  void refreshProject();
                });
              }}
              type="button"
            >
              刷新会话
            </button>
            <button
              className="button button--ghost"
              disabled={project.conversation.length === 0}
              onClick={handleExportMarkdown}
              type="button"
            >
              导出 Markdown
            </button>
            <button
              className="button button--secondary"
              disabled={isPending || project.conversation.length === 0}
              onClick={() => {
                startTransition(() => {
                  void handleClearChat();
                });
              }}
              type="button"
            >
              清空记录
            </button>
          </div>
        </div>

        <div className="pill-row">
          {starters.map((item) => (
            <button
              className="button button--ghost"
              key={item}
              onClick={() => setQuestion(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <label className="label">
          输入问题
          <textarea
            className="textarea"
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例如：为什么系统判定返利 / 费用舞弊风险较高？"
            value={question}
          />
        </label>

        <div className="split">
          <span className="muted">长度 {question.length}/500</span>
          <span className="muted">异常乱码、无效占位符和越界输入会被接口拒绝写入。</span>
        </div>

        <button
          className="button button--primary"
          disabled={isPending || !question.trim()}
          onClick={() => {
            startTransition(() => {
              void handleAsk();
            });
          }}
          type="button"
        >
          {isPending ? "回答生成中..." : "发送问题"}
        </button>
      </section>

      <section className="chat-layout">
        <div className="chat-thread">
          {project.conversation.length === 0 ? (
            <section className="card stack">
              <h3>还没有问答记录</h3>
              <p className="muted">
                可以先从引导问题开始，或者直接追问某条高风险事项的依据、证据链和建议程序。
              </p>
            </section>
          ) : (
            project.conversation.map((message) => (
              <article
                className={`chat-message ${message.role === "user" ? "chat-message--user" : "chat-message--assistant"}`}
                key={message.id}
              >
                <div className="split">
                  <div className="pill-row">
                    <strong>{message.role === "user" ? "用户提问" : "系统回答"}</strong>
                    {message.role === "assistant" && confidenceLabel(message) ? (
                      <span className={`pill pill--${message.meta?.confidence ?? "low"}`}>
                        {confidenceLabel(message)}
                      </span>
                    ) : null}
                    {message.meta?.insufficient ? <span className="pill">资料不足</span> : null}
                    {message.role === "assistant" && message.meta ? (
                      <span className="pill">
                        {message.meta.answeredBy === "ai" ? "AI 回答" : "规则兜底"}
                      </span>
                    ) : null}
                  </div>
                  <span className="muted">{formatDateTime(message.createdAt)}</span>
                </div>

                <p>{message.content}</p>

                {message.meta?.relatedRiskCodes?.length ? (
                  <div className="pill-row">
                    {message.meta.relatedRiskCodes.map((code) => (
                      <span className="pill" key={`${message.id}_${code}`}>
                        {code}
                      </span>
                    ))}
                  </div>
                ) : null}

                {message.meta?.citations?.length ? (
                  <section className="stack">
                    <strong>证据引用</strong>
                    <div className="record-list">
                      {message.meta.citations.map((citation, index) => (
                        <article className="card card--embedded stack" key={`${message.id}_citation_${index}`}>
                          <div className="split">
                            <strong>{citation.riskTitle}</strong>
                            <span className={`pill pill--${citation.severity}`}>{citation.fileName}</span>
                          </div>
                          <p className="muted">{citation.summary}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {message.meta?.retrievals?.length ? (
                  <section className="stack">
                    <strong>检索过程可视化</strong>
                    <div className="retrieval-list">
                      {message.meta.retrievals.map((item, index) => (
                        <article className="retrieval-step" key={item.id}>
                          <div className="retrieval-step__index">{index + 1}</div>
                          <div className="retrieval-step__body">
                            <div className="split">
                              <div className="pill-row">
                                <span className="pill">{retrievalTypeLabel(item.type)}</span>
                                {item.riskCode ? <span className="pill">{item.riskCode}</span> : null}
                                {item.fileName ? <span className="pill">{item.fileName}</span> : null}
                              </div>
                              {item.score !== undefined ? (
                                <span className="muted">分值 {item.score}</span>
                              ) : null}
                            </div>
                            <strong>{item.title}</strong>
                            <p className="muted">{item.detail}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {message.role === "assistant" && message.meta ? (
                  <div className="chat-feedback">
                    <span className="muted">这条回答是否有帮助？</span>
                    <button
                      aria-pressed={message.meta.feedback === "up"}
                      className={`button button--small ${
                        message.meta.feedback === "up" ? "button--active" : "button--ghost"
                      }`}
                      onClick={() => {
                        startTransition(() => {
                          void handleFeedback(
                            message.id,
                            message.meta?.feedback === "up" ? null : "up"
                          );
                        });
                      }}
                      type="button"
                    >
                      点赞
                    </button>
                    <button
                      aria-pressed={message.meta.feedback === "down"}
                      className={`button button--small ${
                        message.meta.feedback === "down" ? "button--active" : "button--ghost"
                      }`}
                      onClick={() => {
                        startTransition(() => {
                          void handleFeedback(
                            message.id,
                            message.meta?.feedback === "down" ? null : "down"
                          );
                        });
                      }}
                      type="button"
                    >
                      点踩
                    </button>
                    <span className="muted">{feedbackLabel(message.meta.feedback)}</span>
                  </div>
                ) : null}

                {message.meta?.suggestedQuestions?.length ? (
                  <div className="pill-row">
                    {message.meta.suggestedQuestions.map((item) => (
                      <button
                        className="button button--ghost"
                        key={`${message.id}_${item}`}
                        onClick={() => setQuestion(item)}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>

        <aside className="stack">
          <section className="card stack">
            <h3>会话概览</h3>
            <div className="detail-grid">
              <article className="data-point">
                <span>问答轮次</span>
                <strong>{Math.ceil(project.conversation.length / 2)}</strong>
              </article>
              <article className="data-point">
                <span>引用文件</span>
                <strong>{citedFiles.length}</strong>
              </article>
              <article className="data-point">
                <span>检索片段</span>
                <strong>{retrievalCount}</strong>
              </article>
              <article className="data-point">
                <span>项目风险</span>
                <strong>{project.risks.length}</strong>
              </article>
            </div>
          </section>

          <section className="card stack">
            <h3>最新回答快照</h3>
            {latestAssistant ? (
              <>
                <p>{truncate(latestAssistant.content, 180)}</p>
                <div className="pill-row">
                  {latestAssistant.meta?.relatedRiskCodes?.map((code) => (
                    <span className="pill" key={`${latestAssistant.id}_${code}`}>
                      {code}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">暂无系统回答。</p>
            )}
          </section>

          <section className="card stack">
            <h3>使用说明</h3>
            <div className="checkpoint-list">
              <article className="checkpoint">
                <strong>多轮追问</strong>
                <p>围绕同一风险持续追问，系统会保留上下文记录，便于形成完整的答辩线索。</p>
              </article>
              <article className="checkpoint">
                <strong>检索轨迹</strong>
                <p>每条回答都能展开规则命中与向量检索片段，方便核对来源是否可靠。</p>
              </article>
              <article className="checkpoint">
                <strong>反馈闭环</strong>
                <p>对回答点赞或点踩后会写回项目记录，方便后续优化检索与回答质量。</p>
              </article>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
