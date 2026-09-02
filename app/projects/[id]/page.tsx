import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleShell } from "@/components/console-shell";
import { ProjectWorkspace } from "@/components/project-workspace";
import { getApprovalRequest } from "@/lib/approval-store";
import { requireCurrentUser } from "@/lib/auth";
import { getReadableProjectForUser } from "@/lib/projects";
import { listWorkpapers } from "@/lib/workpapers";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { view } = await searchParams;
  const project = await getReadableProjectForUser(id, user);

  if (!project) {
    notFound();
  }

  const [approval, workpapers] = await Promise.all([
    getApprovalRequest(project.id),
    listWorkpapers(project.id)
  ]);

  return (
    <ConsoleShell
      actions={
        <>
          <Link className="button button--ghost" href="/projects">
            返回项目总览
          </Link>
          <Link className="button button--ghost" href={`/projects/${project.id}?view=chat`}>
            项目问答
          </Link>
          <Link className="button button--secondary" href={`/projects/${project.id}?view=report`}>
            审计报告
          </Link>
          <Link className="button button--ghost" href={`/projects/${project.id}?view=workpapers`}>
            审计底稿
          </Link>
          <a className="button button--ghost" href={`/api/projects/${project.id}/report`} target="_blank">
            下载 Markdown
          </a>
        </>
      }
      eyebrow="项目执行"
      section="projects"
      stats={[
        { label: "项目状态", value: project.status === "analyzed" ? "已分析" : "待分析" },
        { label: "资料数量", value: project.records.length },
        { label: "识别风险", value: project.risks.length, tone: project.risks.length > 0 ? "danger" : "ok" },
        { label: "当前用户", value: user.name }
      ]}
      subtitle={`${project.companyName} · ${project.year} · ${project.industry}`}
      title={project.name}
      user={user}
    >
      <ProjectWorkspace
        initialApproval={approval}
        initialProject={project}
        initialView={view}
        initialWorkpapers={workpapers}
        user={user}
      />
    </ConsoleShell>
  );
}
