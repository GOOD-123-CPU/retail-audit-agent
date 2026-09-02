"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="button button--ghost"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/auth");
          router.refresh();
        });
      }}
      type="button"
    >
      {isPending ? "退出中..." : "退出登录"}
    </button>
  );
}
