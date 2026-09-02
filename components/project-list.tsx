import Link from "next/link";

import { ProjectListItem } from "@/lib/types";

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) {
    return (
      <section className="card">
        <h3>暂无项目</h3>
        <p className="muted">先创建一个项目，随后即可上传资料、执行风险扫描和生成报告。</p>
      </section>
    );
  }

  return (
    <section className="card stack">
      <div className="card__header">
        <div>
          <h3>项目列表</h3>
          <p className="muted">按最近更新时间排序，支持直接进入项目执行页、报告页和底稿页。</p>
        </div>
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <Link className="card card--embedded project-item" href={`/projects/${project.id}`} key={project.id}>
            <div className="split">
              <div>
                <h4>{project.name}</h4>
                <p className="muted">
                  {project.companyName} 路 {project.year} 路 {project.industry}
                </p>
              </div>
              <div className="pill-row">
                <span className="pill">{project.status === "analyzed" ? "已分析" : "待分析"}</span>
                <span className="pill">风险 {project.riskCount}</span>
                <span className="pill pill--high">高风险 {project.highRiskCount}</span>
              </div>
            </div>
            <div className="project-item__meta">
              <span>更新时间：{new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
              <span>进入项目执行工作台</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
