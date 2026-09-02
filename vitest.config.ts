import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // 测试环境强制关闭 MySQL，统一走 JSON 文件回退分支，保证测试可离线重复。
    env: {
      DATABASE_PROVIDER: "json"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
