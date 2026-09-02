export const dynamic = "force-dynamic";

import { ok } from "@/lib/http";
import { activeProvider, testDatabaseConnection } from "@/lib/db";
import { ensureDirectories, readJsonFile, usersFile } from "@/lib/fs";

/**
 * 健康检查端点：供容器编排 / 反向代理 / 运维监控探测。
 * 返回当前存储模式与数据层连通性；文件模式视为始终健康。
 */
export async function GET() {
  const provider = activeProvider();
  const startedAt = Date.now();

  let database = "unavailable";
  if (provider === "json") {
    try {
      await ensureDirectories();
      await readJsonFile(usersFile, []);
      database = "file";
    } catch {
      database = "file-error";
    }
  } else {
    database = (await testDatabaseConnection()) ? provider : `${provider}-error`;
  }

  const healthy = database === "file" || database === provider;

  return ok(
    {
      status: healthy ? "ok" : "degraded",
      storage: database,
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    },
    { status: healthy ? 200 : 503 }
  );
}
