"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Role } from "@/lib/types";

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

export function UserAdminPanel({
  users,
  currentUserId
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runTask(userId: string | null, task: () => Promise<string>) {
    startTransition(async () => {
      setMessage("");
      setPendingUserId(userId);
      try {
        setMessage(await task());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败。");
      } finally {
        setPendingUserId(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="card stack">
      <div className="card__header">
        <div>
          <h3>用户管理</h3>
          <p className="muted">
            管理员可以创建账号、调整角色或移除成员；系统至少保留一名管理员，且不能删除当前登录账号。
          </p>
        </div>
      </div>

      <form
        className="stack"
        action={(formData) => {
          const payload = {
            name: String(formData.get("name") ?? ""),
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
            role: String(formData.get("role") ?? "user")
          };

          runTask(null, async () => {
            const response = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(result?.error ?? "创建账号失败。");
            }
            return `新账号 ${payload.email} 已创建。`;
          });
        }}
      >
        <div className="form-grid">
          <label className="label">
            姓名
            <input className="input" name="name" placeholder="审计专员" required />
          </label>
          <label className="label">
            邮箱
            <input
              className="input"
              name="email"
              placeholder="member@retail-audit.local"
              required
              type="email"
            />
          </label>
          <label className="label">
            初始密码
            <input
              className="input"
              minLength={8}
              name="password"
              placeholder="至少 8 位"
              required
              type="password"
            />
          </label>
          <label className="label">
            角色
            <select className="select" defaultValue="user" name="role">
              <option value="user">企业用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>
        </div>
        <button className="button button--secondary" disabled={isPending} type="submit">
          {isPending ? "处理中..." : "创建账号"}
        </button>
      </form>

      {message ? <div className="pill">{message}</div> : null}

      <div className="user-list">
        <table className="table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>最近登录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = isPending && pendingUserId === user.id;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      className="select"
                      defaultValue={user.role}
                      disabled={busy || isSelf}
                      onChange={(event) => {
                        const role = event.target.value as Role;
                        runTask(user.id, async () => {
                          const response = await fetch(`/api/users/${user.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ role })
                          });
                          const result = await response.json().catch(() => null);
                          if (!response.ok) {
                            throw new Error(result?.error ?? "角色更新失败。");
                          }
                          return `已将 ${user.name} 调整为${role === "admin" ? "管理员" : "企业用户"}。`;
                        });
                      }}
                    >
                      <option value="admin">管理员</option>
                      <option value="user">企业用户</option>
                    </select>
                  </td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    <button
                      className="button button--ghost"
                      disabled={busy || isSelf}
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`确定移除用户「${user.name}」？该操作不可撤销。`)) {
                          return;
                        }

                        runTask(user.id, async () => {
                          const response = await fetch(`/api/users/${user.id}`, {
                            method: "DELETE"
                          });
                          const result = await response.json().catch(() => null);
                          if (!response.ok) {
                            throw new Error(result?.error ?? "删除失败。");
                          }
                          return `已移除 ${user.name}。`;
                        });
                      }}
                    >
                      {isSelf ? "当前账号" : busy ? "处理中..." : "移除"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
