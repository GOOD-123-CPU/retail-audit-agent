"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { truncate } from "@/lib/utils";

type Workpaper = {
  id: string;
  title: string;
  status: string;
  generatedMarkdown: string;
  updatedAt: string;
};

export function WorkpaperPanel({
  projectId,
  initialWorkpapers
}: {
  projectId: string;
  initialWorkpapers: Workpaper[];
}) {
  const [workpapers, setWorkpapers] = useState(initialWorkpapers);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setWorkpapers(initialWorkpapers);
  }, [initialWorkpapers]);

  async function regenerate() {
    const response = await fetch(`/api/projects/${projectId}/workpapers`, {
      method: "POST"
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "生成底稿失败。");
      return;
    }

    setWorkpapers(result.workpapers);
    setMessage("底稿已重新生成。");
  }

  return (
    <section className="card stack project-card">
      <div className="card__header">
        <div>
          <h3>审计底稿</h3>
          <p className="muted">自动基于项目风险结果生成总体底稿和风险验证底稿，便于复核与归档。</p>
        </div>
        <div className="actions">
          <Link className="button button--ghost" href={`/projects/${projectId}/workpapers`}>
            进入底稿页
          </Link>
          <button
            className="button button--secondary"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void regenerate();
              });
            }}
            type="button"
          >
            {isPending ? "生成中..." : "重新生成"}
          </button>
        </div>
      </div>

      {message ? <div className="message-strip">{message}</div> : null}

      <div className="record-list">
        {workpapers.length === 0 ? (
          <p className="muted">完成分析后会自动生成底稿。</p>
        ) : (
          workpapers.slice(0, 4).map((workpaper) => (
            <article className="card card--embedded stack" key={workpaper.id}>
              <div className="split">
                <strong>{workpaper.title}</strong>
                <span className="pill">{workpaper.status}</span>
              </div>
              <p className="muted">{truncate(workpaper.generatedMarkdown, 180)}</p>
              <span className="muted">
                更新时间：{new Date(workpaper.updatedAt).toLocaleString("zh-CN", { hour12: false })}
              </span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
