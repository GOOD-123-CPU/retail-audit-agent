import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleShell } from "@/components/console-shell";
import { PrintButton } from "@/components/print-button";
import { ReportView } from "@/components/report-view";
import { requireCurrentUser } from "@/lib/auth";
import { canReadReport } from "@/lib/permissions";
import { getProjectById } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project || !canReadReport(user, project)) {
    notFound();
  }

  return (
    <ConsoleShell
      actions={
        <>
          <Link className="button button--ghost" href={`/projects/${project.id}`}>
            返回项目执行页
          </Link>
          <Link className="button button--ghost" href={`/projects/${project.id}/workpapers`}>
            查看底稿
          </Link>
          <Link className="button button--ghost" href={`/projects/${project.id}/chat`}>
            项目问答
          </Link>
          <a className="button button--secondary" href={`/api/projects/${project.id}/report`} target="_blank">
            下载 Markdown
          </a>
          <PrintButton />
        </>
      }
      eyebrow="审计报告"
      section="projects"
      stats={[
        { label: "项目状态", value: project.status === "analyzed" ? "已分析" : "待分析" },
        { label: "风险数量", value: project.risks.length, tone: project.risks.length > 0 ? "danger" : "ok" },
        { label: "资料数量", value: project.records.length }
      ]}
      subtitle={`${project.companyName} · ${project.year} · 报告与答辩材料`}
      title={project.name}
      user={user}
    >
      <div className="report-shell">
        <ReportView markdown={project.reportMarkdown || "# 报告暂未生成"} />
      </div>
    </ConsoleShell>
  );
}
