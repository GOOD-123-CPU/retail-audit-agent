"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CreateProjectForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="card stack"
      action={(formData) => {
        startTransition(async () => {
          setMessage("");
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: String(formData.get("name") ?? ""),
              companyName: String(formData.get("companyName") ?? ""),
              year: String(formData.get("year") ?? ""),
              industry: String(formData.get("industry") ?? "")
            })
          });

          if (response.ok) {
            setMessage("项目已创建，已进入统一项目台账。");
            router.refresh();
            return;
          }

          const result = await response.json().catch(() => null);
          setMessage(result?.error ?? "创建项目失败。");
        });
      }}
    >
      <div className="card__header">
        <div>
          <h3>创建新项目</h3>
          <p className="muted">绑定被审计单位、年度和行业，系统会自动建立独立项目空间和资料归档路径。</p>
        </div>
      </div>
      <div className="form-grid">
        <label className="label">
          项目名称
          <input className="input" name="name" placeholder="2025 年零售经营审计" required />
        </label>
        <label className="label">
          被审计单位
          <input className="input" name="companyName" placeholder="示例商业集团有限公司" required />
        </label>
        <label className="label">
          年度
          <input className="input" defaultValue="2025" name="year" required />
        </label>
        <label className="label">
          行业
          <input className="input" defaultValue="零售业" name="industry" required />
        </label>
      </div>
      {message ? <div className="pill">{message}</div> : null}
      <button className="button button--primary" disabled={isPending} type="submit">
        {isPending ? "创建中..." : "创建项目"}
      </button>
    </form>
  );
}
