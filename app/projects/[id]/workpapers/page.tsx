import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleShell } from "@/components/console-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getReadableProjectForUser } from "@/lib/projects";
import { listWorkpapers } from "@/lib/workpapers";

export const dynamic = "force-dynamic";

export default async function WorkpapersPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const project = await getReadableProjectForUser(id, user);

  if (!project) {
    notFound();
  }

  const workpapers = await listWorkpapers(project.id);

  return (
    <ConsoleShell
      actions={
        <>
          <Link className="button button--ghost" href={`/projects/${project.id}`}>
            返回项目执行页
          </Link>
          <Link className="button button--secondary" href={`/projects/${project.id}/report`}>
            查看审计报告
          </Link>
          <Link className="button button--ghost" href={`/projects/${project.id}/chat`}>
            项目问答
          </Link>
        </>
      }
      eyebrow="审计底稿"
      section="projects"
      stats={[
        { label: "底稿数量", value: workpapers.length },
        {
          label: "高风险事项",
          value: project.risks.filter((item) => item.severity === "high").length,
          tone: "danger"
        },
        { label: "项目状态", value: project.status === "analyzed" ? "已分析" : "待分析" }
      ]}
      subtitle={`${project.companyName} · ${project.year} · 自动生成底稿与复核材料`}
      title={project.name}
      user={user}
    >
      <section className="card stack">
        <div className="card__header">
          <div>
            <h3>底稿列表</h3>
            <p className="muted">系统按项目整体和高风险事项自动生成底稿，可直接用于复核和归档。</p>
          </div>
        </div>
        <div className="record-list">
          {workpapers.length === 0 ? (
            <p className="muted">当前还没有底稿，请先执行项目分析或在项目页重新生成。</p>
          ) : (
            workpapers.map((workpaper) => (
              <article className="card card--paper" key={workpaper.id}>
                <div className="split">
                  <strong>{workpaper.title}</strong>
                  <span className="pill">{workpaper.status}</span>
                </div>
                <pre className="paper-preview">{workpaper.generatedMarkdown}</pre>
              </article>
            ))
          )}
        </div>
      </section>
    </ConsoleShell>
  );
}
