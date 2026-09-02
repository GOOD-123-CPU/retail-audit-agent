import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleShell } from "@/components/console-shell";
import { ProjectChatWorkspace } from "@/components/project-chat-workspace";
import { requireCurrentUser } from "@/lib/auth";
import { normalizeInputText } from "@/lib/encoding";
import { getReadableProjectForUser } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectChatPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { draft } = await searchParams;
  const project = await getReadableProjectForUser(id, user);

  if (!project) {
    notFound();
  }

  const initialDraft = normalizeInputText(String(draft ?? ""), {
    preserveNewlines: true,
    maxLength: 500
  });

  return (
    <ConsoleShell
      actions={
        <>
          <Link className="button button--ghost" href={`/projects/${project.id}`}>
            返回项目执行页
          </Link>
          <Link className="button button--ghost" href={`/projects/${project.id}/report`}>
            审计报告
          </Link>
          <Link className="button button--secondary" href={`/projects/${project.id}/workpapers`}>
            审计底稿
          </Link>
        </>
      }
      eyebrow="项目问答"
      section="projects"
      stats={[
        { label: "项目状态", value: project.status === "analyzed" ? "已分析" : "待分析" },
        { label: "资料数量", value: project.records.length },
        { label: "识别风险", value: project.risks.length, tone: project.risks.length > 0 ? "danger" : "ok" }
      ]}
      subtitle={`${project.companyName} · ${project.year} · 多轮对话与检索可视化`}
      title={project.name}
      user={user}
    >
      <ProjectChatWorkspace initialDraft={initialDraft} initialProject={project} />
    </ConsoleShell>
  );
}
